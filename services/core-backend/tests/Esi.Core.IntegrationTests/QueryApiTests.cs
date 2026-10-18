using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Esi.Core.Application.Consent;
using Esi.Core.Infrastructure.Queries;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.DependencyInjection;

namespace Esi.Core.IntegrationTests;

/// <summary>
/// ESI-16 acceptance against the seeded esi_target database: schema metadata, the bypass corpus never reaches the
/// database, valid SELECTs run with 20-row pages and a remaining count, failures are errors (never empty
/// successes), execution needs a usable connection, and the inline log masks literals.
/// </summary>
[Collection(TargetDatabaseCollection.Name)]
public class QueryApiTests(QueryApiTests.Factory factory, TargetDatabase target) : IClassFixture<QueryApiTests.Factory>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Schema_lists_tables_views_keys_and_procedure_definitions_without_rows()
    {
        var (client, id) = await ConnectAsync();

        var response = await client.GetAsync($"/connections/{id}/schema", Ct);
        var text = await response.Content.ReadAsStringAsync(Ct);
        var dbo = JsonDocument.Parse(text).RootElement.GetProperty("schemas").EnumerateArray().Single(s => s.GetProperty("name").GetString() == "dbo");
        var tables = dbo.GetProperty("tables").EnumerateArray().ToDictionary(t => t.GetProperty("name").GetString()!);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
        Assert.Equal(["Customers", "OrderLines", "Orders", "Products", "vw_CustomerRevenue"], tables.Keys.Order());
        Assert.Equal("view", tables["vw_CustomerRevenue"].GetProperty("kind").GetString());
        Assert.Equal(["OrderId", "LineNumber"], tables["OrderLines"].GetProperty("primaryKey").EnumerateArray().Select(c => c.GetString()));
        Assert.Equal(2, tables["OrderLines"].GetProperty("foreignKeys").GetArrayLength());
        Assert.Contains(tables["Products"].GetProperty("columns").EnumerateArray(),
            c => c.GetProperty("name").GetString() == "UnitPrice" && c.GetProperty("sqlType").GetString() == "decimal(18,2)");
        var procedure = dbo.GetProperty("procedures").EnumerateArray().Single();
        Assert.Contains("CREATE PROCEDURE dbo.usp_GetCustomerOrders", procedure.GetProperty("definition").GetString());
        Assert.DoesNotContain("Contoso", text, StringComparison.Ordinal);
    }

    [Fact]
    public async Task A_valid_select_returns_typed_columns_and_rows_keyed_by_column()
    {
        var (client, id) = await ConnectAsync();

        var result = await ExecuteAsync(client, id, "SELECT c.Name, SUM(l.Quantity * l.UnitPrice) AS Revenue FROM dbo.Customers AS c JOIN dbo.Orders AS o ON o.CustomerId = c.CustomerId JOIN dbo.OrderLines AS l ON l.OrderId = o.OrderId WHERE c.Country = N'Vietnam' GROUP BY c.Name");

        Assert.Equal(["Name", "Revenue"], result.GetProperty("columns").EnumerateArray().Select(c => c.GetProperty("name").GetString()));
        Assert.Equal("nvarchar(200)", result.GetProperty("columns")[0].GetProperty("sqlType").GetString());
        var row = Assert.Single(result.GetProperty("rows").EnumerateArray());
        Assert.Equal("Contoso Ltd", row.GetProperty("Name").GetString());
        Assert.Equal(56.5m, row.GetProperty("Revenue").GetDecimal());
        Assert.Equal(0, result.GetProperty("page").GetProperty("remainingRows").GetInt64());
    }

    [Fact]
    public async Task Pages_hold_20_rows_and_report_the_remaining_rows()
    {
        var (client, id) = await ConnectAsync();
        const string sql = "SELECT a.OrderId AS A, a.LineNumber AS AL, b.LineNumber AS BL, c.LineNumber AS CL FROM dbo.OrderLines a CROSS JOIN dbo.OrderLines b CROSS JOIN dbo.OrderLines c ORDER BY A, AL, BL, CL";

        var first = await ExecuteAsync(client, id, sql, page: 1);
        var second = await ExecuteAsync(client, id, sql, page: 2);
        var third = await ExecuteAsync(client, id, sql, page: 3);

        Assert.Equal((20, 7L), (first.GetProperty("rows").GetArrayLength(), first.GetProperty("page").GetProperty("remainingRows").GetInt64()));
        Assert.Equal((7, 0L), (second.GetProperty("rows").GetArrayLength(), second.GetProperty("page").GetProperty("remainingRows").GetInt64()));
        Assert.Equal((0, 0L), (third.GetProperty("rows").GetArrayLength(), third.GetProperty("page").GetProperty("remainingRows").GetInt64()));
        Assert.Equal(20, first.GetProperty("page").GetProperty("size").GetInt32());
    }

    [Theory]
    [InlineData("DROP TABLE dbo.Products")]
    [InlineData("DELETE FROM dbo.Products")]
    [InlineData("SELECT * INTO dbo.ProductsCopy FROM dbo.Products")]
    [InlineData("SELECT 1; DELETE FROM dbo.Products")]
    [InlineData("EXEC dbo.usp_GetCustomerOrders @CustomerId = 1")]
    public async Task Rejected_statements_never_reach_the_database(string sql)
    {
        var (client, id) = await ConnectAsync();

        var response = await PostAsync(client, id, sql);

        var problem = await ProblemAsync(response, (HttpStatusCode)422, "sql-rejected");
        Assert.True(problem.GetProperty("issues").GetArrayLength() > 0);
        Assert.Equal(2, await CountAsync("SELECT COUNT(*) FROM dbo.Products"));
        Assert.Equal(0, await CountAsync("SELECT COUNT(*) FROM sys.tables WHERE name = 'ProductsCopy'"));
    }

    [Theory]
    [InlineData("SELECT * FROM dbo.vw_CustomerRevenue")]
    [InlineData("SELECT name FROM sys.objects")]
    public async Task Views_and_system_objects_are_rejected(string sql)
    {
        var (client, id) = await ConnectAsync();

        var problem = await ProblemAsync(await PostAsync(client, id, sql), (HttpStatusCode)422, "sql-rejected");

        Assert.Equal("object-not-allowed", problem.GetProperty("issues")[0].GetProperty("code").GetString());
    }

    [Theory]
    [InlineData("SELECT * FROM dbo.NoSuchTable", "execution-failed", 422)]
    [InlineData("SELECT 1 / 0 AS Boom", "execution-failed", 422)]
    [InlineData("SELECT 1, 2", "invalid-result-columns", 422)]
    [InlineData("SELECT Name, Name FROM dbo.Customers", "invalid-result-columns", 422)]
    public async Task Failures_are_errors_not_empty_results(string sql, string problemName, int status)
    {
        var (client, id) = await ConnectAsync();

        await ProblemAsync(await PostAsync(client, id, sql), (HttpStatusCode)status, problemName);
    }

    [Fact]
    public async Task Cells_over_64_KB_are_truncated_and_reported()
    {
        var (client, id) = await ConnectAsync();

        var result = await ExecuteAsync(client, id, "SELECT REPLICATE(CAST(N'x' AS nvarchar(max)), 70000) AS Big");

        Assert.Equal(65536, result.GetProperty("rows")[0].GetProperty("Big").GetString()!.Length);
        var cell = Assert.Single(result.GetProperty("truncatedCells").EnumerateArray());
        Assert.Equal("Big", cell.GetProperty("column").GetString());
    }

    [Fact]
    public async Task Execution_and_schema_need_an_owned_connection_with_consent()
    {
        var (owner, id) = await ConnectAsync();
        var other = factory.ClientFor(Guid.NewGuid());
        await AcceptAsync(other);

        await ProblemAsync(await PostAsync(other, id, "SELECT 1 AS One"), HttpStatusCode.NotFound, "not-found");
        await ProblemAsync(await other.GetAsync($"/connections/{id}/schema", Ct), HttpStatusCode.NotFound, "not-found");

        (await owner.DeleteAsync($"/connections/{id}/consent", Ct)).EnsureSuccessStatusCode();
        await ProblemAsync(await PostAsync(owner, id, "SELECT 1 AS One"), HttpStatusCode.Forbidden, "consent-withdrawn");
        await ProblemAsync(await owner.GetAsync($"/connections/{id}/schema", Ct), HttpStatusCode.Forbidden, "consent-withdrawn");
    }

    [Fact]
    public async Task Executions_are_logged_with_masked_statements_and_no_results()
    {
        var (client, id) = await ConnectAsync();

        await ExecuteAsync(client, id, "SELECT Name FROM dbo.Customers WHERE Country = N'Japan'");
        await PostAsync(client, id, "DELETE FROM dbo.Customers WHERE Name = N'Contoso Ltd'");

        var logs = factory.Logs.Where(l => l.StartsWith("SQL execution by", StringComparison.Ordinal)).ToArray();
        Assert.Contains(logs, l => l.Contains($"on connection {id}: succeeded", StringComparison.Ordinal)
            && l.Contains("SELECT Name FROM dbo.Customers WHERE Country = ?", StringComparison.Ordinal));
        Assert.Contains(logs, l => l.Contains($"on connection {id}: rejected", StringComparison.Ordinal));
        Assert.DoesNotContain(factory.Logs, l => l.Contains("Japan", StringComparison.Ordinal)
            || l.Contains("Fabrikam", StringComparison.Ordinal) || l.Contains(new SqlConnectionStringBuilder(TestDatabases.TargetDb).Password, StringComparison.Ordinal));
    }

    private async Task<(HttpClient Client, Guid ConnectionId)> ConnectAsync()
    {
        var client = factory.ClientFor(Guid.NewGuid());
        await AcceptAsync(client);
        var created = await client.PostAsJsonAsync("/connections", new { name = "Target", connectionString = target.ConnectionString }, Ct);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        return (client, JsonDocument.Parse(await created.Content.ReadAsStringAsync(Ct)).RootElement.GetProperty("id").GetGuid());
    }

    private static async Task AcceptAsync(HttpClient client) =>
        (await client.PostAsJsonAsync("/consent/acceptance", new { termsVersion = EmbeddedConsentTermsProvider.CurrentVersion }, Ct)).EnsureSuccessStatusCode();

    private static Task<HttpResponseMessage> PostAsync(HttpClient client, Guid id, string sql, int page = 1) =>
        client.PostAsJsonAsync($"/connections/{id}/executions", new { sql, page }, Ct);

    private static async Task<JsonElement> ExecuteAsync(HttpClient client, Guid id, string sql, int page = 1)
    {
        var response = await PostAsync(client, id, sql, page);
        var text = await response.Content.ReadAsStringAsync(Ct);
        Assert.True(response.StatusCode == HttpStatusCode.OK, $"{(int)response.StatusCode}: {text}");
        return JsonDocument.Parse(text).RootElement.Clone();
    }

    private static async Task<JsonElement> ProblemAsync(HttpResponseMessage response, HttpStatusCode status, string name)
    {
        var text = await response.Content.ReadAsStringAsync(Ct);
        Assert.True(response.StatusCode == status, $"Expected {(int)status}, got {(int)response.StatusCode}: {text}");
        var problem = JsonDocument.Parse(text).RootElement.Clone();
        Assert.Equal($"urn:esi:problem:{name}", problem.GetProperty("type").GetString());
        return problem;
    }

    private async Task<int> CountAsync(string sql)
    {
        await using var connection = new SqlConnection(target.ConnectionString);
        await connection.OpenAsync(Ct);
        await using var command = new SqlCommand(sql, connection);
        return (int)(await command.ExecuteScalarAsync(Ct))!;
    }

    public sealed class Factory : CoreApiFactory;
}

/// <summary>A statement that runs longer than the configured command timeout is a 504 error, not a partial result.</summary>
[Collection(TargetDatabaseCollection.Name)]
public class QueryTimeoutTests(QueryTimeoutTests.Factory factory, TargetDatabase target) : IClassFixture<QueryTimeoutTests.Factory>
{
    [Fact]
    public async Task A_timeout_is_reported_as_an_error()
    {
        var ct = TestContext.Current.CancellationToken;
        var client = factory.ClientFor(Guid.NewGuid());
        (await client.PostAsJsonAsync("/consent/acceptance", new { termsVersion = EmbeddedConsentTermsProvider.CurrentVersion }, ct)).EnsureSuccessStatusCode();
        var created = await client.PostAsJsonAsync("/connections", new { name = "Target", connectionString = target.ConnectionString }, ct);
        var id = JsonDocument.Parse(await created.Content.ReadAsStringAsync(ct)).RootElement.GetProperty("id").GetGuid();
        var crossJoins = string.Join(" CROSS JOIN ", Enumerable.Range(0, 18).Select(i => $"dbo.OrderLines AS t{i}"));

        var response = await client.PostAsJsonAsync($"/connections/{id}/executions", new { sql = $"SELECT COUNT_BIG(*) AS n FROM {crossJoins}" }, ct);

        Assert.Equal(HttpStatusCode.GatewayTimeout, response.StatusCode);
        Assert.Contains("urn:esi:problem:execution-timeout", await response.Content.ReadAsStringAsync(ct), StringComparison.Ordinal);
    }

    public sealed class Factory : CoreApiFactory
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            base.ConfigureWebHost(builder);
            builder.ConfigureTestServices(services => services.AddSingleton(new ExecutionOptions(CommandTimeoutSeconds: 1)));
        }
    }
}
