using System.Data;
using System.Data.Common;
using System.Diagnostics;
using Esi.Core.Application.Problems;
using Esi.Core.Application.Queries;
using Esi.Core.Application.Security;
using Esi.Core.Domain.Schema;
using Esi.Core.Infrastructure.Connections;
using Microsoft.Data.SqlClient;

namespace Esi.Core.Infrastructure.Queries;

/// <summary>Command timeout for work on users' databases (<c>ESI_CORE_Execution__CommandTimeoutSeconds</c>, default 30).</summary>
public sealed record ExecutionOptions(int CommandTimeoutSeconds = 30);

/// <summary>
/// Reads schema metadata from and runs validated SELECTs against a user's database (ADR-0004). Every command runs
/// in a transaction that is always rolled back, with <c>ApplicationIntent=ReadOnly</c>; referenced objects must be
/// user tables (views, functions and synonyms are rejected); pages hold 20 rows and the remaining rows are counted
/// by streaming the reader, never by loading the result. Cells over 64 KB are truncated.
/// </summary>
public sealed class SqlTargetDatabase(ExecutionOptions options) : ITargetDatabase
{
    public const int MaxCellLength = 65536;

    public async Task<SchemaMetadata> ReadSchemaAsync(SecretValue connectionString, CancellationToken cancellationToken)
    {
        return await RunAsync(connectionString, async (connection, transaction) =>
        {
            var columns = await QueryAsync(connection, transaction, SchemaSql.Columns, r => (
                Schema: r.GetString(0), Table: r.GetString(1), Kind: r.GetString(2).Trim(),
                Column: new ColumnMetadata(r.GetString(3), SqlTypeName(r.GetString(4), r.GetInt16(5), r.GetByte(6), r.GetByte(7)), r.GetBoolean(8))), cancellationToken);
            var keys = await QueryAsync(connection, transaction, SchemaSql.PrimaryKeys, r => (Schema: r.GetString(0), Table: r.GetString(1), Column: r.GetString(2)), cancellationToken);
            var foreignKeys = await QueryAsync(connection, transaction, SchemaSql.ForeignKeys, r => (
                Schema: r.GetString(0), Table: r.GetString(1), Name: r.GetString(2), Column: r.GetString(3),
                RefSchema: r.GetString(4), RefTable: r.GetString(5), RefColumn: r.GetString(6)), cancellationToken);
            var procedures = await QueryAsync(connection, transaction, SchemaSql.Procedures, r => (
                Schema: r.GetString(0), Procedure: new ProcedureMetadata(r.GetString(1), r.IsDBNull(2) ? string.Empty : r.GetString(2))), cancellationToken);

            var tables = columns
                .GroupBy(c => (c.Schema, c.Table, c.Kind))
                .Select(t => (t.Key.Schema, Table: new TableMetadata(
                    t.Key.Table,
                    t.Key.Kind == "V" ? TableKind.View : TableKind.Table,
                    [.. t.Select(c => c.Column)],
                    [.. keys.Where(k => k.Schema == t.Key.Schema && k.Table == t.Key.Table).Select(k => k.Column)],
                    [.. foreignKeys.Where(f => f.Schema == t.Key.Schema && f.Table == t.Key.Table)
                        .GroupBy(f => f.Name)
                        .Select(f => new ForeignKeyMetadata(
                            f.Key, [.. f.Select(x => x.Column)], f.First().RefSchema, f.First().RefTable, [.. f.Select(x => x.RefColumn)]))])))
                .ToList();
            var schemaNames = tables.Select(t => t.Schema).Concat(procedures.Select(p => p.Schema)).Distinct().Order(StringComparer.Ordinal);
            return new SchemaMetadata([.. schemaNames.Select(s => new DatabaseSchema(
                s,
                [.. tables.Where(t => t.Schema == s).Select(t => t.Table)],
                [.. procedures.Where(p => p.Schema == s).Select(p => p.Procedure)]))]);
        }, cancellationToken);
    }

    public async Task<QueryPage> ExecutePageAsync(
        SecretValue connectionString, string sql, IReadOnlyList<ReferencedObject> referencedObjects, int page, CancellationToken cancellationToken)
    {
        return await RunAsync(connectionString, async (connection, transaction) =>
        {
            await EnsureUserTablesAsync(connection, transaction, referencedObjects, cancellationToken);

            var stopwatch = Stopwatch.StartNew();
            await using var command = new SqlCommand(sql, connection, transaction) { CommandTimeout = options.CommandTimeoutSeconds };
            await using var reader = await command.ExecuteReaderAsync(cancellationToken);
            var columns = ResultColumns(reader.GetColumnSchema());

            var skip = (long)(page - 1) * QueryService.PageSize;
            var rows = new List<IReadOnlyDictionary<string, object?>>();
            var truncated = new List<CellRef>();
            long seen = 0;
            long remaining = 0;
            while (await reader.ReadAsync(cancellationToken))
            {
                if (seen++ < skip)
                {
                    continue;
                }

                if (rows.Count == QueryService.PageSize)
                {
                    remaining++;
                    continue;
                }

                var row = new Dictionary<string, object?>(StringComparer.Ordinal);
                for (var i = 0; i < columns.Count; i++)
                {
                    row[columns[i].Name] = CellValue(reader, i, out var wasTruncated);
                    if (wasTruncated)
                    {
                        truncated.Add(new CellRef(rows.Count, columns[i].Name));
                    }
                }

                rows.Add(row);
            }

            return new QueryPage(columns, rows, page, QueryService.PageSize, remaining, truncated, (int)stopwatch.ElapsedMilliseconds);
        }, cancellationToken);
    }

    internal static string SqlTypeName(string type, int maxLength, int precision, int scale) => type switch
    {
        "nvarchar" or "nchar" => maxLength == -1 ? $"{type}(max)" : $"{type}({maxLength / 2})",
        "varchar" or "char" or "varbinary" or "binary" => maxLength == -1 ? $"{type}(max)" : $"{type}({maxLength})",
        "decimal" or "numeric" => $"{type}({precision},{scale})",
        "datetime2" or "datetimeoffset" or "time" => $"{type}({scale})",
        _ => type,
    };

    private async Task<T> RunAsync<T>(SecretValue connectionString, Func<SqlConnection, SqlTransaction, Task<T>> work, CancellationToken cancellationToken)
    {
        SqlConnectionStringBuilder builder;
        try
        {
            builder = new SqlConnectionStringBuilder(connectionString.Reveal())
            {
                ApplicationIntent = ApplicationIntent.ReadOnly,
                ApplicationName = "esi-core",
                ConnectTimeout = SqlConnectionProbe.ConnectTimeoutSeconds,
            };
        }
        catch (Exception exception) when (exception is ArgumentException or FormatException or KeyNotFoundException)
        {
            throw EsiProblem.ExecutionFailed("The stored connection string is not valid.");
        }

        try
        {
            await using var connection = new SqlConnection(builder.ConnectionString);
            await connection.OpenAsync(cancellationToken);
            await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);
            try
            {
                return await work(connection, transaction);
            }
            finally
            {
                // Read-only by design: nothing is ever committed.
                await transaction.RollbackAsync(CancellationToken.None);
            }
        }
        catch (SqlException exception) when (exception.Number == -2)
        {
            throw EsiProblem.ExecutionTimeout(options.CommandTimeoutSeconds);
        }
        catch (SqlException exception)
        {
            // Login and network failures get the fixed reasons; statement errors are the user's own SQL Server message.
            var reason = SqlConnectionProbe.Reason(exception.Number);
            throw EsiProblem.ExecutionFailed(reason.StartsWith("The connection failed", StringComparison.Ordinal) ? exception.Message : reason);
        }
    }

    private async Task EnsureUserTablesAsync(
        SqlConnection connection, SqlTransaction transaction, IReadOnlyList<ReferencedObject> referencedObjects, CancellationToken cancellationToken)
    {
        foreach (var reference in referencedObjects)
        {
            await using var command = new SqlCommand(
                // sys.all_objects also lists system objects (sys.objects does not), which are rejected too.
                "SELECT CASE WHEN o.is_ms_shipped = 1 THEN 'MS' ELSE o.type END FROM sys.all_objects AS o WHERE o.object_id = OBJECT_ID(CASE WHEN @schema IS NULL THEN QUOTENAME(@name) ELSE QUOTENAME(@schema) + N'.' + QUOTENAME(@name) END)",
                connection,
                transaction)
            {
                CommandTimeout = options.CommandTimeoutSeconds,
            };
            command.Parameters.Add(new SqlParameter("@schema", SqlDbType.NVarChar, 128) { Value = (object?)reference.Schema ?? DBNull.Value });
            command.Parameters.Add(new SqlParameter("@name", SqlDbType.NVarChar, 128) { Value = reference.Name });
            var type = (await command.ExecuteScalarAsync(cancellationToken) as string)?.Trim();
            if (type is not null && type != "U")
            {
                var name = reference.Schema is null ? reference.Name : $"{reference.Schema}.{reference.Name}";
                throw EsiProblem.SqlRejected([new SqlIssue("object-not-allowed", $"'{name}' is not a user table; views, functions, synonyms and system objects cannot be read.")]);
            }
        }
    }

    private static List<ResultColumn> ResultColumns(IReadOnlyCollection<DbColumn> schema)
    {
        var columns = schema.Select(c => new ResultColumn(
            c.ColumnName,
            SqlTypeName(c.DataTypeName ?? "sql_variant", ColumnLength(c), c.NumericPrecision ?? 0, c.NumericScale ?? 0),
            c.AllowDBNull ?? true)).ToList();
        if (columns.Any(c => string.IsNullOrWhiteSpace(c.Name)))
        {
            throw EsiProblem.InvalidResultColumns("Every result column needs a name; add an alias (AS ...) to computed columns.");
        }

        var duplicate = columns.GroupBy(c => c.Name, StringComparer.OrdinalIgnoreCase).FirstOrDefault(g => g.Count() > 1);
        return duplicate is null
            ? columns
            : throw EsiProblem.InvalidResultColumns($"The column name '{duplicate.Key}' appears more than once; give each column a unique alias.");
    }

    private static int ColumnLength(DbColumn column)
    {
        var size = column.ColumnSize ?? 0;
        return column.DataTypeName switch
        {
            _ when size >= int.MaxValue / 2 => -1,
            "nvarchar" or "nchar" => size * 2,
            _ => size,
        };
    }

    private static object? CellValue(DbDataReader reader, int ordinal, out bool truncated)
    {
        truncated = false;
        if (reader.IsDBNull(ordinal))
        {
            return null;
        }

        object value;
        try
        {
            value = reader.GetValue(ordinal);
        }
        catch (Exception exception) when (exception is InvalidCastException or IOException or FileNotFoundException or NotSupportedException)
        {
            return "[unsupported SQL type]";
        }

        switch (value)
        {
            case string text when text.Length > MaxCellLength:
                truncated = true;
                return text[..MaxCellLength];
            case byte[] bytes:
                truncated = bytes.Length > MaxCellLength;
                return Convert.ToBase64String(bytes, 0, Math.Min(bytes.Length, MaxCellLength));
            case DateTime dateTime:
                return dateTime.ToString("o", System.Globalization.CultureInfo.InvariantCulture);
            case DateTimeOffset dateTimeOffset:
                return dateTimeOffset.ToString("o", System.Globalization.CultureInfo.InvariantCulture);
            case TimeSpan time:
                return time.ToString("c", System.Globalization.CultureInfo.InvariantCulture);
            case Guid guid:
                return guid.ToString();
            case string or bool or byte or short or int or long or decimal or double or float:
                return value;
            default:
                var text2 = Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture) ?? string.Empty;
                truncated = text2.Length > MaxCellLength;
                return truncated ? text2[..MaxCellLength] : text2;
        }
    }

    private static async Task<List<T>> QueryAsync<T>(
        SqlConnection connection, SqlTransaction transaction, string sql, Func<SqlDataReader, T> map, CancellationToken cancellationToken)
    {
        await using var command = new SqlCommand(sql, connection, transaction) { CommandTimeout = 30 };
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        var result = new List<T>();
        while (await reader.ReadAsync(cancellationToken))
        {
            result.Add(map(reader));
        }

        return result;
    }

    private static class SchemaSql
    {
        public const string Columns = """
            SELECT s.name, o.name, o.type, c.name, t.name, c.max_length, c.precision, c.scale, c.is_nullable
            FROM sys.objects AS o
            JOIN sys.schemas AS s ON s.schema_id = o.schema_id
            JOIN sys.columns AS c ON c.object_id = o.object_id
            JOIN sys.types AS t ON t.user_type_id = c.user_type_id
            WHERE o.type IN ('U', 'V') AND o.is_ms_shipped = 0
            ORDER BY s.name, o.name, c.column_id
            """;

        public const string PrimaryKeys = """
            SELECT s.name, o.name, c.name
            FROM sys.indexes AS i
            JOIN sys.objects AS o ON o.object_id = i.object_id
            JOIN sys.schemas AS s ON s.schema_id = o.schema_id
            JOIN sys.index_columns AS ic ON ic.object_id = i.object_id AND ic.index_id = i.index_id
            JOIN sys.columns AS c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
            WHERE i.is_primary_key = 1 AND o.is_ms_shipped = 0
            ORDER BY s.name, o.name, ic.key_ordinal
            """;

        public const string ForeignKeys = """
            SELECT s.name, o.name, fk.name, pc.name, rs.name, ro.name, rc.name
            FROM sys.foreign_keys AS fk
            JOIN sys.objects AS o ON o.object_id = fk.parent_object_id
            JOIN sys.schemas AS s ON s.schema_id = o.schema_id
            JOIN sys.objects AS ro ON ro.object_id = fk.referenced_object_id
            JOIN sys.schemas AS rs ON rs.schema_id = ro.schema_id
            JOIN sys.foreign_key_columns AS fkc ON fkc.constraint_object_id = fk.object_id
            JOIN sys.columns AS pc ON pc.object_id = fkc.parent_object_id AND pc.column_id = fkc.parent_column_id
            JOIN sys.columns AS rc ON rc.object_id = fkc.referenced_object_id AND rc.column_id = fkc.referenced_column_id
            WHERE fk.is_ms_shipped = 0
            ORDER BY s.name, o.name, fk.name, fkc.constraint_column_id
            """;

        // Definitions are read as text only; nothing executes these procedures.
        public const string Procedures = """
            SELECT s.name, p.name, OBJECT_DEFINITION(p.object_id)
            FROM sys.procedures AS p
            JOIN sys.schemas AS s ON s.schema_id = p.schema_id
            WHERE p.is_ms_shipped = 0
            ORDER BY s.name, p.name
            """;
    }
}
