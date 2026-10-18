using Esi.Core.Application.Security;
using Esi.Core.Domain.Schema;

namespace Esi.Core.Application.Queries;

public sealed record ResultColumn(string Name, string SqlType, bool Nullable);

public sealed record CellRef(int RowIndex, string Column);

/// <summary>One page of a SELECT result; rows are keyed by column name.</summary>
public sealed record QueryPage(
    IReadOnlyList<ResultColumn> Columns,
    IReadOnlyList<IReadOnlyDictionary<string, object?>> Rows,
    int PageNumber,
    int PageSize,
    long RemainingRows,
    IReadOnlyList<CellRef> TruncatedCells,
    int DurationMs);

/// <summary>
/// A user's database (the target). Implementations open the decrypted connection only for the call, never write,
/// and throw <see cref="Problems.EsiProblem"/> for rejected, failed or timed-out work.
/// </summary>
public interface ITargetDatabase
{
    Task<SchemaMetadata> ReadSchemaAsync(SecretValue connectionString, CancellationToken cancellationToken);

    Task<QueryPage> ExecutePageAsync(
        SecretValue connectionString, string sql, IReadOnlyList<ReferencedObject> referencedObjects, int page, CancellationToken cancellationToken);
}
