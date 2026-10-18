using System.Text.Json;
using Esi.Core.Application.Agents;
using Esi.Core.Application.Chat;
using Esi.Core.Application.Problems;
using Esi.Core.Application.Queries;

namespace Esi.Core.Application.Visualizations;

public sealed record VisualizationOptions(int MaxRetries = 2);

/// <summary>
/// Turns result columns and an intent into DSL (SR-5): the agent receives column definitions only, core validates
/// every candidate itself (ADR-0002) and retries with the findings at most <see cref="VisualizationOptions.MaxRetries"/>
/// times. Only a valid document is ever returned.
/// </summary>
public sealed class VisualizationService(ChatService chats, IAgentsClient agents, IDslValidator validator, VisualizationOptions options)
{
    public static readonly string[] Kinds = ["table", "kpi"];

    public async Task<JsonElement> CreateAsync(
        Guid sessionId, IReadOnlyList<ResultColumn>? columns, string? intentKind, string? intentDescription, CancellationToken cancellationToken)
    {
        ValidateRequest(columns, intentKind, intentDescription);
        await chats.GetUsableSessionAsync(sessionId, cancellationToken);

        var names = columns!.Select(c => c.Name).ToArray();
        IReadOnlyList<DslIssue> issues = [];
        for (var attempt = 0; attempt <= options.MaxRetries; attempt++)
        {
            var generation = await agents.GenerateDslAsync(columns!, intentKind!, intentDescription, validator.CatalogId, issues, cancellationToken);
            if (generation.Unsupported || generation.Dsl is not { } dsl)
            {
                throw EsiProblem.VisualizationNotSupported(generation.Reason ?? "This visualization is not supported yet; a table or a KPI is.");
            }

            issues = validator.Validate(dsl, names);
            if (issues.Count == 0)
            {
                return dsl;
            }
        }

        throw EsiProblem.DslValidationFailed(issues);
    }

    private static void ValidateRequest(IReadOnlyList<ResultColumn>? columns, string? intentKind, string? intentDescription)
    {
        if (columns is not { Count: > 0 } || columns.Any(c => string.IsNullOrWhiteSpace(c.Name) || string.IsNullOrWhiteSpace(c.SqlType)))
        {
            throw EsiProblem.InvalidRequest(("columns", "At least one column with a name and a SQL type is required."));
        }

        if (columns.GroupBy(c => c.Name, StringComparer.OrdinalIgnoreCase).Any(g => g.Count() > 1))
        {
            throw EsiProblem.InvalidRequest(("columns", "Column names must be unique."));
        }

        if (intentKind is null || !Kinds.Contains(intentKind))
        {
            throw EsiProblem.InvalidRequest(("intent.kind", "Must be table or kpi."));
        }

        if (intentDescription is { Length: > 2000 })
        {
            throw EsiProblem.InvalidRequest(("intent.description", "At most 2000 characters."));
        }
    }
}
