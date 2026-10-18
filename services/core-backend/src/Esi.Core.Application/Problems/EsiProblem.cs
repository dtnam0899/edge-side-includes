namespace Esi.Core.Application.Problems;

/// <summary>
/// A documented API problem (`urn:esi:problem:&lt;name&gt;` in the core-api contract). The detail must never contain a
/// secret; it is returned to the client as is.
/// </summary>
public sealed class EsiProblem : Exception
{
    private EsiProblem(string name, int status, string title, string? detail)
        : base(title)
    {
        Name = name;
        Status = status;
        Title = title;
        Detail = detail;
    }

    public string Name { get; }

    public int Status { get; }

    public string Title { get; }

    public string? Detail { get; }

    public IReadOnlyList<(string Field, string Message)> FieldErrors { get; private init; } = [];

    /// <summary>Validation findings for <c>sql-rejected</c> and <c>dsl-validation-failed</c>.</summary>
    public IReadOnlyList<(string Code, string Message)> Issues { get; private init; } = [];

    public static EsiProblem NotFound(string what) => new("not-found", 404, "Not found", $"{what} was not found.");

    public static EsiProblem ConsentRequired() =>
        new("consent-required", 403, "Consent required", "Accept the current consent terms first.");

    public static EsiProblem ConsentWithdrawn() =>
        new("consent-withdrawn", 403, "Consent withdrawn", "Consent for this connection was withdrawn; grant it again to use it.");

    public static EsiProblem TermsVersionOutdated(string current) =>
        new("terms-version-outdated", 409, "Terms version outdated", $"Only the current terms version ({current}) can be accepted.");

    public static EsiProblem ConnectionFailed(string reason) => new("connection-failed", 422, "Connection failed", reason);

    public static EsiProblem SqlRejected(IEnumerable<Queries.SqlIssue> issues) =>
        new("sql-rejected", 422, "SQL rejected", "Only a single read-only SELECT statement can be executed.")
        {
            Issues = issues.Select(i => (i.Code, i.Message)).ToArray(),
        };

    public static EsiProblem ExecutionFailed(string detail) => new("execution-failed", 422, "Execution failed", detail);

    public static EsiProblem ExecutionTimeout(int seconds) =>
        new("execution-timeout", 504, "Execution timed out", $"The statement did not finish within {seconds} seconds.");

    public static EsiProblem InvalidResultColumns(string detail) => new("invalid-result-columns", 422, "Invalid result columns", detail);

    public static EsiProblem InvalidRequest(params (string Field, string Message)[] errors) =>
        new("invalid-request", 400, "Invalid request", "One or more fields are invalid.") { FieldErrors = errors };
}
