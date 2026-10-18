using System.Diagnostics;
using Esi.Core.Application.Abstractions;
using Esi.Core.Application.Connections;
using Esi.Core.Application.Problems;
using Esi.Core.Application.Security;
using Microsoft.Extensions.Logging;

namespace Esi.Core.Application.Queries;

/// <summary>
/// Runs an approved SELECT on explicit user request (SR-4, ADR-0004): owner and consent are checked, the statement
/// is validated before it reaches the database, and every attempt is logged inline with the masked statement.
/// </summary>
public sealed partial class QueryService(
    ICurrentUser user,
    ConnectionAccess access,
    ISecretProtector protector,
    ISqlStatementValidator validator,
    ITargetDatabase target,
    ILogger<QueryService> logger)
{
    public const int PageSize = 20;

    public async Task<QueryPage> ExecuteAsync(Guid connectionId, string? sql, int? page, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(sql))
        {
            throw EsiProblem.InvalidRequest(("sql", "Required."));
        }

        var pageNumber = page ?? 1;
        if (pageNumber < 1)
        {
            throw EsiProblem.InvalidRequest(("page", "Must be 1 or greater."));
        }

        var connection = await access.GetUsableAsync(connectionId, cancellationToken);
        var validation = validator.Validate(sql);
        var stopwatch = Stopwatch.StartNew();
        if (!validation.IsValid)
        {
            LogExecution(logger, user.UserId, connectionId, 0, "rejected", validation.MaskedText, validation.Hash);
            throw EsiProblem.SqlRejected(validation.Issues);
        }

        try
        {
            var secret = protector.Unprotect(connection.Secret, new SecretBinding(connection.Id, connection.OwnerId));
            var result = await target.ExecutePageAsync(secret, sql, validation.ReferencedObjects, pageNumber, cancellationToken);
            LogExecution(logger, user.UserId, connectionId, stopwatch.ElapsedMilliseconds, "succeeded", validation.MaskedText, validation.Hash);
            return result;
        }
        catch (EsiProblem problem)
        {
            LogExecution(logger, user.UserId, connectionId, stopwatch.ElapsedMilliseconds, problem.Name, validation.MaskedText, validation.Hash);
            throw;
        }
    }

    // SR-9 / ADR-0004: who, which connection, when (log timestamp), duration, outcome, masked statement and hash.
    [LoggerMessage(Level = LogLevel.Information,
        Message = "SQL execution by {UserId} on connection {ConnectionId}: {Outcome} in {DurationMs} ms; statement {Statement} (sha256 {StatementHash})")]
    private static partial void LogExecution(
        ILogger logger, Guid userId, Guid connectionId, long durationMs, string outcome, string statement, string statementHash);
}
