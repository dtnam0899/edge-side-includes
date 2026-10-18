import pytest

from esi_agents.sql import SchemaIndex, check_procedure_script, check_query
from esi_agents.sql.tokens import TokenKind, tokenize


@pytest.fixture
def schema() -> SchemaIndex:
    index = SchemaIndex()
    index.add_table("dbo", "Customers", ["CustomerId", "Name", "Country"])
    index.add_table("dbo", "Orders", ["OrderId", "CustomerId", "OrderDate", "Status"])
    index.add_table("dbo", "OrderLines", ["OrderLineId", "OrderId", "Quantity", "UnitPrice"])
    index.add_table("sales", "Targets", ["Year", "Amount"])
    index.add_procedure("dbo", "usp_GetCustomerOrders")
    return index


def codes(analysis) -> set[str]:
    return {issue.code for issue in analysis.issues}


VALID_SELECTS = [
    "SELECT 1",
    "SELECT c.Name FROM dbo.Customers AS c",
    "select Name, Country from Customers where Country = N'Viet Nam';",
    "SELECT TOP (10) o.OrderId, o.OrderDate FROM dbo.Orders o ORDER BY o.OrderDate DESC",
    "SELECT c.Name AS Customer, SUM(ol.Quantity * ol.UnitPrice) AS Revenue FROM dbo.Customers AS c "
    "INNER JOIN dbo.Orders AS o ON o.CustomerId = c.CustomerId "
    "LEFT JOIN dbo.OrderLines AS ol ON ol.OrderId = o.OrderId "
    "WHERE YEAR(o.OrderDate) = 2026 GROUP BY c.Name HAVING SUM(ol.Quantity) > 2 "
    "ORDER BY Revenue DESC",
    "WITH totals AS (SELECT o.CustomerId, COUNT(*) AS Orders FROM dbo.Orders AS o "
    "GROUP BY o.CustomerId) "
    "SELECT t.CustomerId, t.Orders FROM totals AS t",
    "WITH t (Id, Total) AS (SELECT OrderId, Quantity FROM dbo.OrderLines) SELECT Id, Total FROM t",
    "SELECT [c].[Name] FROM [dbo].[Customers] AS [c] -- DELETE in a comment\n",
    "SELECT o.Status, DATEPART(month, o.OrderDate) AS M FROM dbo.Orders AS o /* DROP TABLE x */",
    "SELECT x.Total FROM (SELECT COUNT(*) AS Total FROM dbo.Orders) AS x",
    "SELECT o.OrderId, ROW_NUMBER() OVER (PARTITION BY o.CustomerId ORDER BY o.OrderDate) AS N "
    "FROM dbo.Orders AS o",
    "SELECT CAST(ol.UnitPrice AS decimal(18, 2)) AS Price FROM dbo.OrderLines AS ol",
    "SELECT o.OrderId FROM dbo.Orders AS o WHERE o.Status = 'DELETE; EXEC xp_cmdshell'",
    "SELECT t.Amount FROM sales.Targets AS t WHERE t.[Year] = 2026",
    "SELECT c.Name FROM dbo.Customers AS c WHERE EXISTS (SELECT 1 FROM dbo.Orders AS o "
    "WHERE o.CustomerId = c.CustomerId)",
    "SELECT c.Name, o.OrderId FROM dbo.Customers c, dbo.Orders o WHERE o.CustomerId = c.CustomerId",
]


@pytest.mark.parametrize("sql", VALID_SELECTS)
def test_valid_selects_pass(sql: str, schema: SchemaIndex) -> None:
    analysis = check_query(sql, schema)
    assert analysis.ok, analysis.issues


BYPASS_ATTEMPTS = [
    ("DELETE FROM dbo.Orders", "write-statement"),
    ("delete from dbo.Orders", "write-statement"),
    ("UPDATE dbo.Orders SET Status = 'x'", "write-statement"),
    ("INSERT INTO dbo.Orders (OrderId) VALUES (1)", "write-statement"),
    (
        "MERGE dbo.Orders AS t USING dbo.Orders AS s ON 1 = 1 WHEN MATCHED THEN DELETE;",
        "write-statement",
    ),
    ("TRUNCATE TABLE dbo.Orders", "write-statement"),
    ("DROP TABLE dbo.Orders", "ddl"),
    ("ALTER TABLE dbo.Orders ADD x int", "ddl"),
    ("CREATE VIEW v AS SELECT 1 AS One", "ddl"),
    ("GRANT SELECT ON dbo.Orders TO public", "ddl"),
    ("EXEC dbo.usp_GetCustomerOrders 1", "exec"),
    ("EXECUTE('SELECT 1')", "exec"),
    ("SELECT 1; EXEC('DROP TABLE dbo.Orders')", "exec"),
    ("SELECT 1 AS One; DROP TABLE dbo.Orders", "multiple-statements"),
    ("SELECT 1 AS One;/**/DELETE/**/FROM dbo.Orders", "write-statement"),
    ("SELECT 1 AS One\nGO\nSELECT 2 AS Two", "forbidden-construct"),
    ("SELECT o.OrderId INTO #tmp FROM dbo.Orders AS o", "select-into"),
    ("SELECT o.OrderId INTO dbo.Copy FROM dbo.Orders AS o", "select-into"),
    ("SELECT * FROM OPENROWSET('SQLNCLI', 'Server=x;', 'SELECT 1')", "external-data"),
    ("SELECT * FROM OPENQUERY(Remote, 'SELECT 1')", "external-data"),
    ("SELECT * FROM OPENDATASOURCE('SQLNCLI', 'Data Source=x').db.dbo.t", "external-data"),
    ("SELECT o.OrderId FROM Remote.Sales.dbo.Orders AS o", "linked-server"),
    ("SELECT * FROM sys.sp_who", "system-procedure"),
    ("SELECT 1 AS One WHERE 1 = (SELECT 1 FROM xp_cmdshell)", "system-procedure"),
    ("WAITFOR DELAY '00:00:10'", "forbidden-construct"),
    ("SELECT o.OrderId FROM dbo.Orders AS o OPTION (MAXDOP 1)", "forbidden-construct"),
    ("DECLARE @x int; SELECT @x", "forbidden-construct"),
    ("SELECT @x = o.OrderId FROM dbo.Orders AS o", "variable"),
    ("SELECT * FROM dbo.usp_GetCustomerOrders", "procedure-reference"),
    ("SELECT * FROM usp_GetCustomerOrders", "procedure-reference"),
    ("BEGIN TRAN; DELETE FROM dbo.Orders; COMMIT", "write-statement"),
    ("SELECT 1 /* unterminated", "parse-error"),
    ("SELECT 'unterminated", "parse-error"),
    ("", "empty"),
    (
        "\u00a0SELECT\u2003o.OrderId FROM dbo.Orders AS o;\u3000DELETE FROM dbo.Orders",
        "write-statement",
    ),
    ("SHUTDOWN", "forbidden-construct"),
    ("DBCC CHECKDB", "forbidden-construct"),
]


@pytest.mark.parametrize(("sql", "code"), BYPASS_ATTEMPTS)
def test_bypass_attempts_are_rejected(sql: str, code: str, schema: SchemaIndex) -> None:
    analysis = check_query(sql, schema)
    assert code in codes(analysis)


@pytest.mark.parametrize(
    ("sql", "code"),
    [
        ("SELECT i.Amount FROM dbo.Invoices AS i", "unknown-table"),
        ("SELECT x.Name FROM other.Customers AS x", "unknown-table"),
        ("SELECT c.Email FROM dbo.Customers AS c", "unknown-column"),
        ("SELECT Email FROM dbo.Customers", "unknown-column"),
        ("SELECT z.Name FROM dbo.Customers AS c", "unknown-table"),
        ("SELECT dbo.fn_Tax(ol.UnitPrice) AS T FROM dbo.OrderLines AS ol", "unknown-table"),
        ("SELECT fn_Tax(ol.UnitPrice) AS T FROM dbo.OrderLines AS ol", "unknown-function"),
        ("SELECT * FROM dbo.fn_Orders(1)", "unknown-function"),
        ("SELECT o.OrderId FROM Sales.dbo.Orders AS o", "unknown-table"),
    ],
)
def test_ungrounded_identifiers_are_rejected(sql: str, code: str, schema: SchemaIndex) -> None:
    assert code in codes(check_query(sql, schema))


def test_referenced_tables_are_schema_qualified(schema: SchemaIndex) -> None:
    analysis = check_query(
        "SELECT c.Name FROM Customers AS c JOIN dbo.Orders AS o ON o.CustomerId = c.CustomerId",
        schema,
    )
    assert analysis.ok
    assert analysis.referenced_tables == ["dbo.Customers", "dbo.Orders"]


READ_ONLY_PROCEDURE = (
    "CREATE PROCEDURE dbo.usp_Revenue @Year int = 2026 AS BEGIN SET NOCOUNT ON; "
    "DECLARE @min int = 1; SET @min = 2; "
    "SELECT c.Name AS Customer, SUM(ol.Quantity * ol.UnitPrice) AS Revenue FROM dbo.Customers AS c "
    "JOIN dbo.Orders AS o ON o.CustomerId = c.CustomerId "
    "JOIN dbo.OrderLines AS ol ON ol.OrderId = o.OrderId "
    "WHERE YEAR(o.OrderDate) = @Year GROUP BY c.Name HAVING SUM(ol.Quantity) >= @min; END"
)


def test_read_only_procedure_script_passes(schema: SchemaIndex) -> None:
    analysis = check_procedure_script(READ_ONLY_PROCEDURE, schema)
    assert analysis.ok, analysis.issues
    assert analysis.procedure_name == "dbo.usp_Revenue"
    assert analysis.referenced_tables == ["dbo.Customers", "dbo.OrderLines", "dbo.Orders"]


@pytest.mark.parametrize(
    ("sql", "code"),
    [
        (
            "CREATE PROCEDURE dbo.p AS BEGIN DELETE FROM dbo.Orders; SELECT 1 AS One; END",
            "write-statement",
        ),
        ("CREATE PROCEDURE dbo.p AS UPDATE dbo.Orders SET Status = 'x'", "write-statement"),
        ("CREATE PROCEDURE dbo.p AS BEGIN EXEC dbo.usp_GetCustomerOrders 1; END", "exec"),
        ("CREATE PROCEDURE dbo.p AS BEGIN CREATE TABLE #t (x int); SELECT 1 AS One; END", "ddl"),
        ("CREATE PROCEDURE dbo.p AS SELECT o.OrderId INTO #t FROM dbo.Orders AS o", "select-into"),
        (
            "CREATE PROCEDURE dbo.p AS BEGIN SET XACT_ABORT ON; SELECT 1 AS One; END",
            "forbidden-construct",
        ),
        ("CREATE PROCEDURE dbo.p WITH EXECUTE AS OWNER AS SELECT 1 AS One", "forbidden-construct"),
        (
            "CREATE OR ALTER PROCEDURE dbo.usp_GetCustomerOrders AS SELECT 1 AS One",
            "procedure-exists",
        ),
        ("CREATE PROCEDURE dbo.p AS SET NOCOUNT ON", "no-select"),
        ("SELECT 1", "not-procedure"),
        ("CREATE PROCEDURE dbo.p AS SELECT x.Email FROM dbo.Customers AS x", "unknown-column"),
        ("CREATE PROCEDURE dbo.p AS SELECT 1 AS One\nGO\nDROP TABLE dbo.Orders", "ddl"),
    ],
)
def test_unsafe_procedure_scripts_are_rejected(sql: str, code: str, schema: SchemaIndex) -> None:
    assert code in codes(check_procedure_script(sql, schema))


def test_tokenizer_drops_comments_and_keeps_literals() -> None:
    tokens = tokenize("SELECT /* a /* nested */ b */ 'it''s' -- tail\n, N'x' FROM [a]]b]")
    assert [t.kind for t in tokens] == [
        TokenKind.WORD,
        TokenKind.STRING,
        TokenKind.PUNCT,
        TokenKind.STRING,
        TokenKind.WORD,
        TokenKind.QUOTED,
    ]
    assert tokens[-1].value == "a]b"
