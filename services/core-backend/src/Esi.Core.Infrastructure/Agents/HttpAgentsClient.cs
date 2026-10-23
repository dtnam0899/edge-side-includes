using System.Text.Json;
using Esi.Core.Application.Agents;
using Esi.Core.Application.Problems;
using Esi.Core.Application.Queries;
using Esi.Core.Application.Visualizations;
using Esi.Core.Domain.Chat;
using Esi.Core.Infrastructure.Agents.Contracts;
using Microsoft.Extensions.Logging;
using Model = Esi.Core.Domain.Schema;

namespace Esi.Core.Infrastructure.Agents;

/// <summary>Agents service base URL (<c>ESI_CORE_Agents__BaseUrl</c>) and request timeout.</summary>
public sealed record AgentsOptions(Uri? BaseUrl, int TimeoutSeconds = 120);

/// <summary>
/// Calls services/ai-agents through the client generated from the pinned agents-api contract. Requests are built only
/// from typed fields (question, history, schema structure, column definitions), so rows and secrets cannot be sent.
/// Transport failures, timeouts and 5xx answers become <c>agents-unavailable</c>; an agent-side
/// <c>dsl-validation-failed</c> keeps its issues. Response bodies are never logged.
/// </summary>
public sealed partial class HttpAgentsClient(IAgentsApiClient client, AgentsOptions options, ILogger<HttpAgentsClient> logger) : IAgentsClient
{
    public async Task<SqlGeneration> GenerateSqlAsync(
        string question, Model.SchemaMetadata schema, IReadOnlyList<ConversationTurn> history, CancellationToken cancellationToken)
    {
        var request = new SqlGenerationRequest
        {
            Question = question,
            Schema = ToContract(schema),
            History = [.. history.Select(h => new ConversationMessage
            {
                Role = h.Role == ChatRole.User ? ConversationMessageRole.User : ConversationMessageRole.Assistant,
                Text = h.Text,
            })],
        };
        var result = await CallAsync(ct => client.GenerateSqlAsync(request, ct), cancellationToken);
        var kind = result.Kind switch
        {
            SqlOutputKind.Query => SqlKind.Query,
            SqlOutputKind.StoredProcedure => SqlKind.StoredProcedure,
            _ => SqlKind.None,
        };
        return new SqlGeneration(kind, result.Sql ?? string.Empty, result.Explanation ?? string.Empty, result.ReferencedTables ?? [], result.ProcedureName);
    }

    public async Task<DslGeneration> GenerateDslAsync(
        IReadOnlyList<ResultColumn> columns, string intentKind, string? intentDescription, string catalogId,
        IReadOnlyList<DslIssue> previousIssues, CancellationToken cancellationToken)
    {
        var request = new DslGenerationRequest
        {
            Columns = [.. columns.Select(c => new ColumnDefinition { Name = c.Name, SqlType = c.SqlType, Nullable = c.Nullable })],
            Intent = new VisualizationIntent
            {
                Kind = intentKind switch
                {
                    "table" => VisualizationIntentKind.Table,
                    "kpi" => VisualizationIntentKind.Kpi,
                    "chart" => VisualizationIntentKind.Chart,
                    _ => throw new ArgumentOutOfRangeException(nameof(intentKind), intentKind, "Not a visualization kind of the agents contract."),
                },
                Description = intentDescription,
            },
            CatalogId = catalogId,
            PreviousIssues = previousIssues.Count == 0
                ? null
                : [.. previousIssues.Select(i => new ValidationIssue { Code = i.Code, Message = i.Message, Path = i.Path })],
        };
        var result = await CallAsync(ct => client.GenerateDslAsync(request, ct), cancellationToken);
        return result.Status == DslGenerationResultStatus.Unsupported || result.Dsl is null
            ? new DslGeneration(true, null, result.Reason)
            : new DslGeneration(false, JsonSerializer.SerializeToElement(result.Dsl), null);
    }

    private async Task<T> CallAsync<T>(Func<CancellationToken, Task<T>> call, CancellationToken cancellationToken)
    {
        if (options.BaseUrl is null)
        {
            throw EsiProblem.AgentsUnavailable("The AI agents service is not configured (ESI_CORE_Agents__BaseUrl).");
        }

        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
        timeout.CancelAfter(TimeSpan.FromSeconds(options.TimeoutSeconds));
        try
        {
            return await call(timeout.Token);
        }
        catch (AgentsApiException<Problem> exception) when (exception.StatusCode == 422
            && exception.Result?.Type == "urn:esi:problem:dsl-validation-failed" && exception.Result.Issues is { Count: > 0 } issues)
        {
            throw EsiProblem.DslValidationFailed(issues.Select(i => new DslIssue(i.Code, i.Message, i.Path ?? string.Empty)));
        }
        catch (AgentsApiException exception) when (exception.StatusCode == 422 && DslIssues(exception.Response) is { Count: > 0 } issues)
        {
            throw EsiProblem.DslValidationFailed(issues);
        }
        catch (AgentsApiException exception)
        {
            LogFailure(logger, exception.StatusCode);
            throw EsiProblem.AgentsUnavailable(exception.StatusCode == 503
                ? "The AI agents service has no usable model right now."
                : $"The AI agents service answered with status {exception.StatusCode}.");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            throw EsiProblem.AgentsUnavailable($"The AI agents service did not answer within {options.TimeoutSeconds} seconds.");
        }
        catch (HttpRequestException)
        {
            LogFailure(logger, 0);
            throw EsiProblem.AgentsUnavailable("The AI agents service could not be reached.");
        }
    }

    private static List<DslIssue> DslIssues(string? problemJson)
    {
        try
        {
            using var problem = JsonDocument.Parse(problemJson ?? "{}");
            var root = problem.RootElement;
            if (!root.TryGetProperty("type", out var type) || type.GetString() != "urn:esi:problem:dsl-validation-failed"
                || !root.TryGetProperty("issues", out var issues) || issues.ValueKind != JsonValueKind.Array)
            {
                return [];
            }

            return [.. issues.EnumerateArray().Select(i => new DslIssue(
                i.TryGetProperty("code", out var c) ? c.GetString() ?? "schema" : "schema",
                i.TryGetProperty("message", out var m) ? m.GetString() ?? string.Empty : string.Empty,
                i.TryGetProperty("path", out var p) ? p.GetString() ?? string.Empty : string.Empty))];
        }
        catch (JsonException)
        {
            return [];
        }
    }

    private static SchemaMetadata ToContract(Model.SchemaMetadata schema) => new()
    {
        Schemas = [.. schema.Schemas.Select(s => new DatabaseSchema
        {
            Name = s.Name,
            Tables = [.. s.Tables.Select(t => new TableMetadata
            {
                Name = t.Name,
                Kind = t.Kind == Model.TableKind.View ? TableMetadataKind.View : TableMetadataKind.Table,
                Columns = [.. t.Columns.Select(c => new ColumnDefinition { Name = c.Name, SqlType = c.SqlType, Nullable = c.Nullable })],
                PrimaryKey = [.. t.PrimaryKey],
                ForeignKeys = [.. t.ForeignKeys.Select(f => new ForeignKey
                {
                    Name = f.Name,
                    Columns = [.. f.Columns],
                    ReferencedSchema = f.ReferencedSchema,
                    ReferencedTable = f.ReferencedTable,
                    ReferencedColumns = [.. f.ReferencedColumns],
                })],
            })],
            Procedures = [.. s.Procedures.Select(p => new ProcedureMetadata { Name = p.Name, Definition = p.Definition })],
        })],
    };

    [LoggerMessage(Level = LogLevel.Warning, Message = "AI agents call failed with status {StatusCode}")]
    private static partial void LogFailure(ILogger logger, int statusCode);
}
