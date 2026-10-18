namespace Esi.Core.Application.Queries;

/// <summary>One reason a statement was rejected (contract <c>ValidationIssue</c>).</summary>
public sealed record SqlIssue(string Code, string Message);

/// <summary>A schema-qualified object a statement reads from; checked against the target database before running.</summary>
public sealed record ReferencedObject(string? Schema, string Name);

/// <summary>
/// Result of validating a statement (ADR-0004). <see cref="MaskedText"/> has every literal replaced by <c>?</c> and,
/// with <see cref="Hash"/>, is what gets logged; the original text is never logged.
/// </summary>
public sealed record SqlValidationResult(
    IReadOnlyList<SqlIssue> Issues,
    IReadOnlyList<ReferencedObject> ReferencedObjects,
    string MaskedText,
    string Hash)
{
    public bool IsValid => Issues.Count == 0;
}

/// <summary>Enforced read-only check: one batch, one plain SELECT, only allow-listed syntax and functions.</summary>
public interface ISqlStatementValidator
{
    SqlValidationResult Validate(string sql);
}
