using System.Text.Json;
using Esi.Core.Application.Abstractions;
using Esi.Core.Application.Connections;
using Esi.Core.Application.Consent;
using Esi.Core.Application.Problems;
using Esi.Core.Application.Queries;
using Esi.Core.Application.Visualizations;
using Esi.Core.Domain.Artifacts;
using Esi.Core.Domain.Connections;

namespace Esi.Core.Application.Artifacts;

public enum ArtifactStatus
{
    Available = 0,
    ConnectionUnavailable = 1,
    MigrationRequired = 2,
}

public sealed record ArtifactView(Artifact Artifact, ArtifactStatus Status, JsonElement Dsl, IReadOnlyList<ResultColumn> Columns);

/// <summary>
/// Saved DSL artifacts (SR-7). Saving validates the SELECT (ADR-0004) and the DSL against the expected columns
/// (ADR-0002) in core. A deleted connection shows as <c>connection-unavailable</c>; withdrawn consent hides artifacts;
/// running one goes through the same policy and paging as <see cref="QueryService"/>.
/// </summary>
public sealed class ArtifactService(
    ICurrentUser user,
    ConnectionAccess access,
    IConnectionRepository connections,
    ConsentService consent,
    IArtifactRepository artifacts,
    ISqlStatementValidator sqlValidator,
    IDslValidator dslValidator,
    QueryService queries,
    TimeProvider clock)
{
    public async Task<IReadOnlyList<ArtifactView>> ListAsync(Guid connectionId, CancellationToken cancellationToken)
    {
        await access.GetUsableAsync(connectionId, cancellationToken);
        var list = await artifacts.ListArtifactsAsync(user.UserId, connectionId, cancellationToken);
        return [.. list.Select(a => View(a, connectionExists: true))];
    }

    public async Task<ArtifactView> CreateAsync(
        Guid connectionId, string? name, string? kind, JsonElement? dsl, string? sql, IReadOnlyList<ResultColumn>? columns, CancellationToken cancellationToken)
    {
        var validName = ValidName(name);
        var artifactKind = kind switch
        {
            "table" => ArtifactKind.Table,
            "kpi" => ArtifactKind.Kpi,
            "chart" => ArtifactKind.Chart,
            _ => throw EsiProblem.InvalidRequest(("kind", "Must be table, kpi or chart.")),
        };
        if (dsl is not { ValueKind: JsonValueKind.Object } document)
        {
            throw EsiProblem.InvalidRequest(("dsl", "Required."));
        }

        if (string.IsNullOrWhiteSpace(sql))
        {
            throw EsiProblem.InvalidRequest(("sql", "Required."));
        }

        if (columns is not { Count: > 0 } || columns.Any(c => string.IsNullOrWhiteSpace(c.Name) || string.IsNullOrWhiteSpace(c.SqlType))
            || columns.GroupBy(c => c.Name, StringComparer.OrdinalIgnoreCase).Any(g => g.Count() > 1))
        {
            throw EsiProblem.InvalidRequest(("columns", "At least one column with a unique name and a SQL type is required."));
        }

        await access.GetUsableAsync(connectionId, cancellationToken);
        var sqlCheck = sqlValidator.Validate(sql);
        if (!sqlCheck.IsValid)
        {
            throw EsiProblem.SqlRejected(sqlCheck.Issues);
        }

        var dslIssues = dslValidator.Validate(document, DslColumnTypes.From(columns));
        if (dslIssues.Count > 0)
        {
            throw EsiProblem.DslValidationFailed(dslIssues);
        }

        // The kind must say what the document renders (ADR-0010): a chart is exactly a document on the ESI catalog.
        var isChartDocument = document.GetProperty("catalogId").GetString() == dslValidator.ChartCatalogId;
        if (isChartDocument != (artifactKind == ArtifactKind.Chart))
        {
            throw EsiProblem.InvalidRequest(("kind", isChartDocument
                ? "The DSL is a chart (ESI catalog); kind must be chart."
                : "The DSL uses the basic catalog; kind must be table or kpi."));
        }

        var artifact = new Artifact(
            Guid.NewGuid(), user.UserId, connectionId, validName, artifactKind, document.GetRawText(),
            document.GetProperty("dslSchemaVersion").GetString()!, sql, JsonSerializer.Serialize(columns), clock.GetUtcNow());
        artifacts.Add(artifact);
        await artifacts.SaveChangesAsync(cancellationToken);
        return View(artifact, connectionExists: true);
    }

    public async Task<ArtifactView> GetAsync(Guid artifactId, CancellationToken cancellationToken)
    {
        var artifact = await artifacts.FindArtifactForOwnerAsync(artifactId, user.UserId, cancellationToken)
            ?? throw EsiProblem.NotFound("The artifact");
        return View(artifact, await EnsureVisibleAsync(artifact.ConnectionId, cancellationToken));
    }

    /// <summary>The owner can always delete an artifact; dashboard items that used it then show as missing.</summary>
    public async Task DeleteAsync(Guid artifactId, CancellationToken cancellationToken)
    {
        var artifact = await artifacts.FindArtifactForOwnerAsync(artifactId, user.UserId, cancellationToken)
            ?? throw EsiProblem.NotFound("The artifact");
        artifacts.Remove(artifact);
        await artifacts.SaveChangesAsync(cancellationToken);
    }

    /// <summary>Runs the saved SELECT on live data; an artifact without a usable connection is <c>artifact-unavailable</c>.</summary>
    public async Task<QueryPage> ExecuteAsync(Guid artifactId, int? page, CancellationToken cancellationToken)
    {
        var artifact = await artifacts.FindArtifactForOwnerAsync(artifactId, user.UserId, cancellationToken)
            ?? throw EsiProblem.NotFound("The artifact");
        var connection = await connections.FindForOwnerAsync(artifact.ConnectionId, user.UserId, cancellationToken);
        if (connection is null || connection.Consent == ConsentState.Withdrawn)
        {
            throw EsiProblem.ArtifactUnavailable();
        }

        if (!dslValidator.SupportsSchemaVersion(artifact.DslSchemaVersion))
        {
            throw EsiProblem.ArtifactUnavailable("The artifact was saved with a DSL version this version cannot render yet.");
        }

        return await queries.ExecuteAsync(artifact.ConnectionId, artifact.Sql, page, cancellationToken);
    }

    /// <summary>
    /// Owned connection with consent and current terms: visible (true). Deleted connection: visible but unavailable
    /// (false). Withdrawn consent or outdated terms: hidden (403).
    /// </summary>
    internal async Task<bool> EnsureVisibleAsync(Guid connectionId, CancellationToken cancellationToken)
    {
        var connection = await connections.FindForOwnerAsync(connectionId, user.UserId, cancellationToken);
        if (connection is null)
        {
            return false;
        }

        if (connection.Consent == ConsentState.Withdrawn)
        {
            throw EsiProblem.ConsentWithdrawn();
        }

        await consent.EnsureCurrentTermsAcceptedAsync(cancellationToken);
        return true;
    }

    internal ArtifactView View(Artifact artifact, bool connectionExists)
    {
        var status = !connectionExists ? ArtifactStatus.ConnectionUnavailable
            : !dslValidator.SupportsSchemaVersion(artifact.DslSchemaVersion) ? ArtifactStatus.MigrationRequired
            : ArtifactStatus.Available;
        using var dsl = JsonDocument.Parse(artifact.DslJson);
        return new ArtifactView(artifact, status, dsl.RootElement.Clone(), JsonSerializer.Deserialize<List<ResultColumn>>(artifact.ColumnsJson) ?? []);
    }

    private static string ValidName(string? name)
    {
        var trimmed = name?.Trim();
        return string.IsNullOrEmpty(trimmed) || trimmed.Length > Artifact.MaxNameLength
            ? throw EsiProblem.InvalidRequest(("name", $"Required, 1 to {Artifact.MaxNameLength} characters."))
            : trimmed;
    }
}
