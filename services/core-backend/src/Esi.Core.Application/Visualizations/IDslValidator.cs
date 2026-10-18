using System.Text.Json;

namespace Esi.Core.Application.Visualizations;

/// <summary>One DSL validation finding (contract <c>ValidationIssue</c>; codes as in <c>@dtnam0899/dsl-core</c>).</summary>
public sealed record DslIssue(string Code, string Message, string Path);

/// <summary>
/// Validates an untrusted DSL document (contract <c>DslDocument</c>) against the pinned A2UI catalog and the ESI rules
/// (ADR-0002). Core runs it itself before returning or saving DSL, even when a producer already validated.
/// </summary>
public interface IDslValidator
{
    /// <summary>The pinned catalog id agents must use.</summary>
    string CatalogId { get; }

    IReadOnlyList<DslIssue> Validate(JsonElement document, IReadOnlyCollection<string> columnNames);
}
