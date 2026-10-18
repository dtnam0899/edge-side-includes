using System.Security.Cryptography;
using System.Text;
using Esi.Core.Application.Queries;
using Microsoft.SqlServer.TransactSql.ScriptDom;

namespace Esi.Core.Infrastructure.Queries;

/// <summary>
/// Enforced read-only check (ADR-0004). The statement is parsed with ScriptDom (SQL Server 2025 grammar); it must be
/// one batch with one plain SELECT, and every node of its syntax tree must be on <see cref="AllowedNodes"/>. Function
/// calls must be system functions on <see cref="AllowedFunctions"/>; user-defined functions, variables, table hints,
/// INTO, FOR XML/JSON, OPTION hints, row-set functions and cross-database or linked-server names are rejected.
/// Unknown node types are rejected by default; each new construct needs a corpus test and an allow-list entry.
/// </summary>
public sealed class SelectStatementValidator : ISqlStatementValidator
{
    public const int MaxLoggedLength = 4000;

    internal static readonly HashSet<string> AllowedNodes = new(StringComparer.Ordinal)
    {
        // Script and query structure
        nameof(TSqlScript), nameof(TSqlBatch), nameof(SelectStatement), nameof(QuerySpecification),
        nameof(BinaryQueryExpression), nameof(QueryParenthesisExpression), nameof(WithCtesAndXmlNamespaces),
        nameof(CommonTableExpression), nameof(SelectScalarExpression), nameof(SelectStarExpression), nameof(FromClause),
        nameof(NamedTableReference), nameof(QualifiedJoin), nameof(UnqualifiedJoin), nameof(QueryDerivedTable),
        nameof(JoinParenthesisTableReference), nameof(WhereClause), nameof(GroupByClause),
        nameof(ExpressionGroupingSpecification), nameof(HavingClause), nameof(OrderByClause),
        nameof(ExpressionWithSortOrder), nameof(TopRowFilter), nameof(OffsetClause),

        // Names
        nameof(SchemaObjectName), nameof(Identifier), nameof(MultiPartIdentifier), nameof(ColumnReferenceExpression),
        nameof(IdentifierOrValueExpression), nameof(SqlDataTypeReference),

        // Literals
        nameof(IntegerLiteral), nameof(NumericLiteral), nameof(RealLiteral), nameof(MoneyLiteral), nameof(StringLiteral),
        nameof(NullLiteral), nameof(BinaryLiteral),
        nameof(IdentifierLiteral), // date parts such as DATEADD(day, ...)
        nameof(MaxLiteral), // type lengths such as nvarchar(max)

        // Expressions and predicates
        nameof(BinaryExpression), nameof(UnaryExpression), nameof(ParenthesisExpression),
        nameof(BooleanComparisonExpression), nameof(BooleanBinaryExpression), nameof(BooleanNotExpression),
        nameof(BooleanParenthesisExpression), nameof(BooleanIsNullExpression), nameof(BooleanTernaryExpression),
        nameof(InPredicate), nameof(LikePredicate), nameof(ExistsPredicate), nameof(SubqueryComparisonPredicate),
        nameof(ScalarSubquery), nameof(SearchedCaseExpression), nameof(SimpleCaseExpression),
        nameof(SearchedWhenClause), nameof(SimpleWhenClause), nameof(CastCall), nameof(ConvertCall),
        nameof(TryCastCall), nameof(TryConvertCall), nameof(CoalesceExpression), nameof(NullIfExpression),
        nameof(IIfCall), nameof(FunctionCall), nameof(LeftFunctionCall), nameof(RightFunctionCall),
        nameof(ParameterlessCall), nameof(OverClause), nameof(WindowFrameClause), nameof(WindowDelimiter),
        nameof(WithinGroupClause),
    };

    internal static readonly HashSet<string> AllowedFunctions = new(StringComparer.OrdinalIgnoreCase)
    {
        // Aggregates
        "COUNT", "COUNT_BIG", "SUM", "AVG", "MIN", "MAX", "STDEV", "STDEVP", "VAR", "VARP", "STRING_AGG", "GROUPING",
        // Ranking and analytic window functions
        "ROW_NUMBER", "RANK", "DENSE_RANK", "NTILE", "LAG", "LEAD", "FIRST_VALUE", "LAST_VALUE", "PERCENT_RANK", "CUME_DIST",
        // Strings
        "LEN", "UPPER", "LOWER", "LTRIM", "RTRIM", "TRIM", "SUBSTRING", "REPLACE", "CHARINDEX", "PATINDEX", "CONCAT",
        "CONCAT_WS", "FORMAT", "REVERSE", "REPLICATE", "STUFF",
        // Math
        "ABS", "ROUND", "CEILING", "FLOOR", "POWER", "SQRT", "SIGN",
        // Date and time
        "GETDATE", "GETUTCDATE", "SYSDATETIME", "SYSUTCDATETIME", "DATEADD", "DATEDIFF", "DATEDIFF_BIG", "DATEPART",
        "DATENAME", "DATEFROMPARTS", "EOMONTH", "YEAR", "MONTH", "DAY",
        // Nulls
        "ISNULL",
    };

    public SqlValidationResult Validate(string sql)
    {
        var parser = new TSql170Parser(initialQuotedIdentifiers: true);
        TSqlFragment? fragment;
        IList<ParseError> errors;
        using (var reader = new StringReader(sql))
        {
            fragment = parser.Parse(reader, out errors);
        }

        var masked = Mask(fragment, sql);
        var hash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(sql)));
        if (errors.Count > 0 || fragment is not TSqlScript script)
        {
            return Rejected(masked, hash, new SqlIssue("parse-error", "The statement could not be parsed as T-SQL."));
        }

        var issues = new List<SqlIssue>();
        if (script.Batches.Count != 1 || script.Batches[0].Statements.Count != 1)
        {
            issues.Add(new SqlIssue("multiple-statements", "Exactly one statement in one batch is allowed."));
            return Rejected(masked, hash, [.. issues]);
        }

        if (script.Batches[0].Statements[0] is not SelectStatement select || select.GetType() != typeof(SelectStatement))
        {
            return Rejected(masked, hash, new SqlIssue("not-a-select", "Only a SELECT statement is allowed."));
        }

        if (select.Into is not null || select.On is not null)
        {
            issues.Add(new SqlIssue("select-into", "SELECT ... INTO is not allowed."));
        }

        if (select.ComputeClauses.Count > 0)
        {
            issues.Add(new SqlIssue("compute-clause", "COMPUTE is not allowed."));
        }

        if (select.OptimizerHints.Count > 0)
        {
            issues.Add(new SqlIssue("query-hint", "OPTION hints are not allowed."));
        }

        var visitor = new AllowListVisitor();
        select.Accept(visitor);
        issues.AddRange(visitor.Issues);

        var referenced = visitor.Tables
            .Where(t => t.Schema is not null || !visitor.CteNames.Contains(t.Name))
            .Distinct()
            .ToArray();
        return issues.Count == 0
            ? new SqlValidationResult([], referenced, masked, hash)
            : Rejected(masked, hash, [.. issues.Distinct()]);
    }

    /// <summary>Statement text for logs: literals become <c>?</c>, comments are dropped, whitespace is collapsed.</summary>
    internal static string Mask(TSqlFragment? fragment, string sql)
    {
        if (fragment?.ScriptTokenStream is not { Count: > 0 } tokens)
        {
            return "[unparsed statement]";
        }

        var builder = new StringBuilder();
        foreach (var token in tokens)
        {
            switch (token.TokenType)
            {
                case TSqlTokenType.Integer or TSqlTokenType.Numeric or TSqlTokenType.Real or TSqlTokenType.Money
                    or TSqlTokenType.HexLiteral or TSqlTokenType.AsciiStringLiteral or TSqlTokenType.UnicodeStringLiteral:
                    builder.Append('?');
                    break;
                case TSqlTokenType.SingleLineComment or TSqlTokenType.MultilineComment or TSqlTokenType.WhiteSpace:
                    if (builder.Length > 0 && builder[^1] != ' ')
                    {
                        builder.Append(' ');
                    }

                    break;
                case TSqlTokenType.EndOfFile:
                    break;
                default:
                    builder.Append(token.Text);
                    break;
            }
        }

        var text = builder.ToString().Trim();
        return text.Length <= MaxLoggedLength ? text : string.Concat(text.AsSpan(0, MaxLoggedLength), "...");
    }

    private static SqlValidationResult Rejected(string masked, string hash, params SqlIssue[] issues) => new(issues, [], masked, hash);

    private sealed class AllowListVisitor : TSqlFragmentVisitor
    {
        public List<SqlIssue> Issues { get; } = [];

        public List<ReferencedObject> Tables { get; } = [];

        public HashSet<string> CteNames { get; } = new(StringComparer.OrdinalIgnoreCase);

        public override void Visit(TSqlFragment fragment)
        {
            var name = fragment.GetType().Name;
            if (!AllowedNodes.Contains(name))
            {
                Issues.Add(new SqlIssue("construct-not-allowed", $"The construct '{name}' is not allowed in an executed SELECT."));
            }
        }

        public override void ExplicitVisit(CommonTableExpression node)
        {
            CteNames.Add(node.ExpressionName.Value);
            base.ExplicitVisit(node);
        }

        public override void ExplicitVisit(NamedTableReference node)
        {
            var name = node.SchemaObject;
            if (name.ServerIdentifier is not null || name.DatabaseIdentifier is not null)
            {
                Issues.Add(new SqlIssue("cross-database-name", "Only objects of the connected database can be read (no database or server prefix)."));
            }
            else
            {
                Tables.Add(new ReferencedObject(name.SchemaIdentifier?.Value, name.BaseIdentifier.Value));
            }

            base.ExplicitVisit(node);
        }

        public override void ExplicitVisit(FunctionCall node)
        {
            if (node.CallTarget is not null)
            {
                Issues.Add(new SqlIssue("function-not-allowed", "User-defined and method function calls are not allowed."));
            }
            else if (!AllowedFunctions.Contains(node.FunctionName.Value))
            {
                Issues.Add(new SqlIssue("function-not-allowed", $"The function '{node.FunctionName.Value}' is not on the allowed list."));
            }

            base.ExplicitVisit(node);
        }
    }
}
