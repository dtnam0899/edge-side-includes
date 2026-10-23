using System.Text.Json;

namespace Esi.Core.Application.Visualizations;

/// <summary>One DSL validation finding (contract <c>ValidationIssue</c>; codes as in <c>@dtnam0899/dsl-core</c>).</summary>
public sealed record DslIssue(string Code, string Message, string Path);

/// <summary>
/// Validates an untrusted DSL document (contract <c>DslDocument</c>) against its catalog (the pinned A2UI basic
/// catalog, or the ESI catalog for charts, ADR-0009) and the ESI rules (ADR-0002). Core runs it itself before
/// returning or saving DSL, even when a producer already validated.
/// </summary>
public interface IDslValidator
{
    /// <summary>The pinned basic catalog id, for tables and KPIs.</summary>
    string CatalogId { get; }

    /// <summary>The ESI catalog id (basic catalog plus <c>EsiChart</c>), for charts.</summary>
    string ChartCatalogId { get; }

    /// <summary>Whether documents of this DSL schema version can be validated and rendered.</summary>
    bool SupportsSchemaVersion(string dslSchemaVersion);

    /// <summary>Checks the document against the result columns; chart rules need their DSL types.</summary>
    IReadOnlyList<DslIssue> Validate(JsonElement document, IReadOnlyCollection<DslColumn> columns);
}
