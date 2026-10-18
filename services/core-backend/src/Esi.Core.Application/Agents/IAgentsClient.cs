using System.Text.Json;
using Esi.Core.Application.Queries;
using Esi.Core.Application.Visualizations;
using Esi.Core.Domain.Chat;
using Esi.Core.Domain.Schema;

namespace Esi.Core.Application.Agents;

public sealed record ConversationTurn(ChatRole Role, string Text);

public sealed record SqlGeneration(SqlKind Kind, string Sql, string Explanation, IReadOnlyList<string> ReferencedTables, string? ProcedureName);

/// <summary>A DSL candidate (<see cref="Dsl"/>) or a refusal with <see cref="Reason"/> (charts, forms).</summary>
public sealed record DslGeneration(bool Unsupported, JsonElement? Dsl, string? Reason);

/// <summary>
/// services/ai-agents over the agents-api contract. Only schema metadata, questions and column definitions are sent:
/// never connection strings or row values (SR-3, SR-5). Failures surface as <c>agents-unavailable</c> problems.
/// </summary>
public interface IAgentsClient
{
    Task<SqlGeneration> GenerateSqlAsync(
        string question, SchemaMetadata schema, IReadOnlyList<ConversationTurn> history, CancellationToken cancellationToken);

    Task<DslGeneration> GenerateDslAsync(
        IReadOnlyList<ResultColumn> columns, string intentKind, string? intentDescription, string catalogId,
        IReadOnlyList<DslIssue> previousIssues, CancellationToken cancellationToken);
}
