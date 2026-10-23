using System.Text.RegularExpressions;
using Esi.Core.Application.Queries;

namespace Esi.Core.Application.Visualizations;

/// <summary>A result column as the DSL sees it: its name and DSL type (<c>@dtnam0899/dsl-schema</c> <c>ColumnType</c>).</summary>
public sealed record DslColumn(string Name, string Type);

/// <summary>
/// Maps SQL Server type names to DSL column types (<c>string</c>, <c>number</c>, <c>boolean</c>, <c>date</c>,
/// <c>datetime</c>). Same rules as the portal's <c>toColumnType</c>, so core and the renderer agree on which columns
/// a chart may plot (ADR-0009: series columns must be numbers).
/// </summary>
public static partial class DslColumnTypes
{
    public static string FromSqlType(string sqlType)
    {
        var type = sqlType.Trim();
        return NumberTypes().IsMatch(type) ? "number"
            : BitType().IsMatch(type) ? "boolean"
            : DateType().IsMatch(type) ? "date"
            : DateTimeTypes().IsMatch(type) ? "datetime"
            : "string";
    }

    public static IReadOnlyList<DslColumn> From(IEnumerable<ResultColumn> columns) =>
        [.. columns.Select(c => new DslColumn(c.Name, FromSqlType(c.SqlType)))];

    [GeneratedRegex(@"^(tinyint|smallint|int|bigint|decimal|numeric|money|smallmoney|float|real)\b", RegexOptions.IgnoreCase)]
    private static partial Regex NumberTypes();

    [GeneratedRegex(@"^bit\b", RegexOptions.IgnoreCase)]
    private static partial Regex BitType();

    [GeneratedRegex("^date$", RegexOptions.IgnoreCase)]
    private static partial Regex DateType();

    [GeneratedRegex(@"^(datetime|datetime2|smalldatetime|datetimeoffset)\b", RegexOptions.IgnoreCase)]
    private static partial Regex DateTimeTypes();
}
