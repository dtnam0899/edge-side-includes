using System.Collections.Concurrent;
using System.Text.Json;
using Esi.Core.Application.Agents;
using Esi.Core.Application.Problems;
using Esi.Core.Application.Queries;
using Esi.Core.Application.Visualizations;
using Esi.Core.Domain.Schema;

namespace Esi.Core.IntegrationTests;

/// <summary>Scripted stand-in for services/ai-agents that records what core sends.</summary>
public sealed class FakeAgents : IAgentsClient
{
    public ConcurrentQueue<(string Question, SchemaMetadata Schema, IReadOnlyList<ConversationTurn> History)> SqlCalls { get; } = new();

    public ConcurrentQueue<(IReadOnlyList<ResultColumn> Columns, string Kind, IReadOnlyList<DslIssue> PreviousIssues)> DslCalls { get; } = new();

    public Func<string, SqlGeneration> Sql { get; set; } = _ => new SqlGeneration(Domain.Chat.SqlKind.Query, "SELECT Name FROM dbo.Customers", "Lists customers.", ["dbo.Customers"], null);

    public Queue<Func<DslGeneration>> Dsl { get; } = new();

    public bool Unavailable { get; set; }

    public Task<SqlGeneration> GenerateSqlAsync(string question, SchemaMetadata schema, IReadOnlyList<ConversationTurn> history, CancellationToken cancellationToken)
    {
        if (Unavailable)
        {
            throw EsiProblem.AgentsUnavailable("The AI agents service could not be reached.");
        }

        SqlCalls.Enqueue((question, schema, history));
        return Task.FromResult(Sql(question));
    }

    public Task<DslGeneration> GenerateDslAsync(
        IReadOnlyList<ResultColumn> columns, string intentKind, string? intentDescription, string catalogId,
        IReadOnlyList<DslIssue> previousIssues, CancellationToken cancellationToken)
    {
        DslCalls.Enqueue((columns, intentKind, previousIssues));
        return Task.FromResult(Dsl.Count > 0 ? Dsl.Dequeue()() : new DslGeneration(true, null, "nothing scripted"));
    }

    /// <summary>A table over the given columns: Column > header Row + List template Row with relative paths.</summary>
    public static JsonElement Table(params string[] columns)
    {
        var components = new List<object>
        {
            new { id = "root", component = "Column", children = new[] { "header", "rows" } },
            new { id = "header", component = "Row", children = columns.Select(c => $"h-{c}").ToArray() },
            new { id = "rows", component = "List", children = new { componentId = "row", path = "/rows" } },
            new { id = "row", component = "Row", children = columns.Select(c => $"c-{c}").ToArray() },
        };
        components.AddRange(columns.Select(c => (object)new { id = $"h-{c}", component = "Text", text = c, variant = "caption" }));
        components.AddRange(columns.Select(c => (object)new { id = $"c-{c}", component = "Text", text = new { path = c } }));
        return JsonSerializer.SerializeToElement(new
        {
            catalogId = "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json",
            protocolVersion = "v0.9",
            dslSchemaVersion = "0.1.0",
            components,
        });
    }
}
