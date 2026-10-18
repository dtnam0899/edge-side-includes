using Esi.Core.Infrastructure.Queries;

namespace Esi.Core.UnitTests;

/// <summary>ADR-0004 corpus: valid SELECTs pass, bypass attempts are rejected before anything reaches a database.</summary>
public class SelectStatementValidatorTests
{
    private readonly SelectStatementValidator _validator = new();

    public static TheoryData<string> ValidSelects =>
    [
        "SELECT 1 AS One",
        "SELECT c.Name, SUM(l.Quantity * l.UnitPrice) AS Revenue FROM dbo.Customers AS c JOIN dbo.Orders AS o ON o.CustomerId = c.CustomerId JOIN dbo.OrderLines AS l ON l.OrderId = o.OrderId GROUP BY c.Name ORDER BY Revenue DESC",
        "WITH counts AS (SELECT CustomerId, COUNT(*) AS n FROM dbo.Orders GROUP BY CustomerId) SELECT * FROM counts WHERE n > 1",
        "SELECT TOP (10) * FROM dbo.Products ORDER BY UnitPrice DESC",
        "SELECT ProductId, Name FROM dbo.Products ORDER BY Name OFFSET 20 ROWS FETCH NEXT 20 ROWS ONLY",
        "select o.OrderId, CASE WHEN o.Status = N'Open' THEN 'yes' ELSE 'no' END AS IsOpen from dbo.Orders o where o.OrderDate BETWEEN '2026-01-01' AND '2026-12-31'",
        "SELECT CAST(UnitPrice AS int) AS P, CONVERT(nvarchar(20), UnitPrice) AS S, ISNULL(Name, '') AS N, COALESCE(Name, Sku) AS C, NULLIF(Sku, '') AS K, IIF(UnitPrice > 10, 1, 0) AS Big, LEFT(Name, 3) AS L FROM dbo.Products",
        "SELECT * FROM dbo.Customers WHERE Country IN ('Vietnam', 'Japan') AND Name LIKE N'%Ltd' AND Country IS NOT NULL",
        "SELECT c.Name FROM dbo.Customers AS c WHERE EXISTS (SELECT 1 FROM dbo.Orders AS o WHERE o.CustomerId = c.CustomerId)",
        "SELECT Name FROM dbo.Customers UNION ALL SELECT Name FROM dbo.Products",
        "SELECT OrderId, ROW_NUMBER() OVER (PARTITION BY CustomerId ORDER BY OrderDate DESC) AS rn FROM dbo.Orders",
        "SELECT YEAR(OrderDate) AS Y, DATEADD(day, 30, OrderDate) AS Due, EOMONTH(OrderDate) AS MonthEnd FROM dbo.Orders",
        "SELECT STRING_AGG(Name, ', ') WITHIN GROUP (ORDER BY Name) AS Names FROM dbo.Customers",
        "SELECT (SELECT COUNT(*) FROM dbo.Orders) AS Total, x.n FROM (SELECT COUNT(*) AS n FROM dbo.Products) AS x",
        "SELECT c.Name, o.OrderId FROM dbo.Customers c LEFT JOIN dbo.Orders o ON o.CustomerId = c.CustomerId CROSS JOIN dbo.Products p",
        "SELECT CURRENT_TIMESTAMP AS Now",
        "SELECT CAST(Name AS nvarchar(max)) AS LongName FROM dbo.Customers",
        "-- top customers\nSELECT /* inline */ Name FROM dbo.Customers;",
    ];

    public static TheoryData<string, string> BypassAttempts => new()
    {
        { "INSERT INTO dbo.Orders (CustomerId) VALUES (1)", "not-a-select" },
        { "UPDATE dbo.Orders SET Status = 'x'", "not-a-select" },
        { "DELETE FROM dbo.Orders", "not-a-select" },
        { "MERGE dbo.Orders AS t USING dbo.Orders AS s ON 1 = 0 WHEN NOT MATCHED THEN INSERT (CustomerId) VALUES (1);", "not-a-select" },
        { "DROP TABLE dbo.Orders", "not-a-select" },
        { "CREATE TABLE dbo.X (Id int)", "not-a-select" },
        { "TRUNCATE TABLE dbo.Orders", "not-a-select" },
        { "EXEC sp_who", "not-a-select" },
        { "EXECUTE ('SEL' + 'ECT 1')", "not-a-select" },
        { "SELECT 1; EXEC xp_cmdshell 'dir'", "multiple-statements" },
        { "SELECT 1\nGO\nSELECT 2", "multiple-statements" },
        { "SELECT/**/1;/**/DROP TABLE dbo.Orders", "multiple-statements" },
        { "SELECT 1 DROP TABLE dbo.Orders", "multiple-statements" },
        { "SELECT * INTO dbo.Copy FROM dbo.Orders", "select-into" },
        { "SELECT * FROM OPENROWSET('SQLNCLI', 'Server=x;Trusted_Connection=yes;', 'SELECT 1')", "construct-not-allowed" },
        { "SELECT * FROM OPENQUERY(remote, 'SELECT 1')", "construct-not-allowed" },
        { "SELECT * FROM OPENDATASOURCE('SQLNCLI', 'Data Source=x').db.dbo.t", "construct-not-allowed" },
        { "SELECT * FROM remote.Sales.dbo.Orders", "cross-database-name" },
        { "SELECT * FROM Other.dbo.Orders", "cross-database-name" },
        { "WAITFOR DELAY '00:00:05'", "not-a-select" },
        { "SELECT @x = 1", "construct-not-allowed" },
        { "DECLARE @x int", "not-a-select" },
        { "SELECT * FROM dbo.Orders OPTION (MAXDOP 1)", "query-hint" },
        { "SELECT * FROM dbo.Orders WITH (NOLOCK)", "construct-not-allowed" },
        { "SELECT dbo.fn_Revenue(1) AS r", "function-not-allowed" },
        { "SELECT * FROM dbo.fn_Orders(1)", "construct-not-allowed" },
        { "SELECT @@VERSION AS v", "construct-not-allowed" },
        { "SELECT * FROM dbo.Orders FOR XML AUTO", "construct-not-allowed" },
        { "SELECT HASHBYTES('SHA2_256', 'x') AS h", "function-not-allowed" },
        { "SELECT * FROM dbo.Orders WHERE", "parse-error" },
    };

    [Theory]
    [MemberData(nameof(ValidSelects))]
    public void Valid_selects_pass(string sql)
    {
        var result = _validator.Validate(sql);

        Assert.True(result.IsValid, string.Join("; ", result.Issues.Select(i => $"{i.Code}: {i.Message}")));
    }

    [Theory]
    [MemberData(nameof(BypassAttempts))]
    public void Bypass_attempts_are_rejected(string sql, string expectedCode)
    {
        var result = _validator.Validate(sql);

        Assert.False(result.IsValid);
        Assert.Contains(result.Issues, i => i.Code == expectedCode);
    }

    [Fact]
    public void Referenced_tables_exclude_cte_names()
    {
        var result = _validator.Validate("WITH x AS (SELECT CustomerId FROM dbo.Orders) SELECT * FROM x JOIN Customers c ON c.CustomerId = x.CustomerId");

        Assert.Equal(
            [(null, "Customers"), ("dbo", "Orders")],
            result.ReferencedObjects.Select(o => (o.Schema, o.Name)).OrderBy(o => o.Name).ToArray());
    }

    [Fact]
    public void Logged_text_masks_literals_and_comments_and_the_hash_is_stable()
    {
        const string sql = "SELECT Name -- note: S3cret\nFROM dbo.Customers WHERE Country = N'Vietnam' AND CustomerId > 42 AND Tag = 0xFF";

        var first = _validator.Validate(sql);
        var second = _validator.Validate(sql);

        Assert.Equal("SELECT Name FROM dbo.Customers WHERE Country = ? AND CustomerId > ? AND Tag = ?", first.MaskedText);
        Assert.Equal(first.Hash, second.Hash);
        Assert.Equal(64, first.Hash.Length);
        Assert.DoesNotContain("Vietnam", first.MaskedText, StringComparison.Ordinal);
    }

    [Fact]
    public void Unparseable_text_is_not_logged()
    {
        var result = _validator.Validate("SELEC 'S3cret' FRM x");

        Assert.False(result.IsValid);
        Assert.DoesNotContain("S3cret", result.MaskedText, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData("nvarchar", 400, 0, 0, "nvarchar(200)")]
    [InlineData("nvarchar", -1, 0, 0, "nvarchar(max)")]
    [InlineData("varchar", 50, 0, 0, "varchar(50)")]
    [InlineData("decimal", 9, 18, 2, "decimal(18,2)")]
    [InlineData("datetime2", 8, 27, 7, "datetime2(7)")]
    [InlineData("int", 4, 10, 0, "int")]
    public void Sql_type_names_include_length_and_precision(string type, int maxLength, int precision, int scale, string expected) =>
        Assert.Equal(expected, SqlTargetDatabase.SqlTypeName(type, maxLength, precision, scale));
}
