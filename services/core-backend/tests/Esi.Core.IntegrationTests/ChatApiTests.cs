using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Esi.Core.Application.Agents;
using Esi.Core.Application.Consent;
using Esi.Core.Domain.Chat;

namespace Esi.Core.IntegrationTests;

/// <summary>
/// ESI-17 (part 1): chat sessions, the script library and visualizations, with a scripted agent. The schema the
/// agent receives is read from the seeded esi_target database.
/// </summary>
[Collection(TargetDatabaseCollection.Name)]
public class ChatApiTests(ChatApiTests.Factory factory, TargetDatabase target) : IClassFixture<ChatApiTests.Factory>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Asking_stores_the_turn_and_sends_schema_and_history_but_never_executes()
    {
        var (client, connectionId) = await ConnectAsync();
        var session = await CreateSessionAsync(client, connectionId);

        var turn = await JsonAsync(await client.PostAsJsonAsync($"/chat-sessions/{session}/messages", new { text = "Who are our customers?" }, Ct), HttpStatusCode.Created);
        await client.PostAsJsonAsync($"/chat-sessions/{session}/messages", new { text = "Only in Japan" }, Ct);
        var reopened = await JsonAsync(await client.GetAsync($"/chat-sessions/{session}", Ct));

        Assert.Equal("user", turn.GetProperty("question").GetProperty("role").GetString());
        var sql = turn.GetProperty("answer").GetProperty("generatedSql");
        Assert.Equal("query", sql.GetProperty("kind").GetString());
        Assert.Equal("SELECT Name FROM dbo.Customers", sql.GetProperty("sql").GetString());
        Assert.Equal("Who are our customers?", reopened.GetProperty("title").GetString());
        Assert.Equal(4, reopened.GetProperty("messages").GetArrayLength());

        var calls = factory.Agents.SqlCalls.Where(c => c.Question is "Who are our customers?" or "Only in Japan").ToArray();
        Assert.Contains(calls[0].Schema.Schemas.Single().Tables, t => t.Name == "Customers");
        Assert.Empty(calls[0].History);
        Assert.Equal(["Who are our customers?", "Lists customers."], calls[1].History.Select(h => h.Text));
        Assert.Equal(2, await CountAsync("SELECT COUNT(*) FROM dbo.Customers"));
    }

    [Fact]
    public async Task A_stored_procedure_answer_is_saved_to_the_script_library()
    {
        var (client, connectionId) = await ConnectAsync();
        var session = await CreateSessionAsync(client, connectionId);
        factory.Agents.Sql = q => q.Contains("procedure", StringComparison.Ordinal)
            ? new SqlGeneration(SqlKind.StoredProcedure, "CREATE PROCEDURE dbo.usp_Revenue AS SELECT 1 AS X", "Aggregates revenue.", ["dbo.Orders"], "usp_Revenue")
            : new SqlGeneration(SqlKind.Query, "SELECT 1 AS X", "x", [], null);

        var turn = await JsonAsync(await client.PostAsJsonAsync($"/chat-sessions/{session}/messages", new { text = "Write a procedure for revenue" }, Ct), HttpStatusCode.Created);
        var scriptId = turn.GetProperty("answer").GetProperty("generatedSql").GetProperty("savedScriptId").GetGuid();
        var scripts = await JsonAsync(await client.GetAsync($"/connections/{connectionId}/scripts", Ct));
        var script = await JsonAsync(await client.GetAsync($"/scripts/{scriptId}", Ct));

        Assert.Contains(scripts.EnumerateArray(), s => s.GetProperty("id").GetGuid() == scriptId);
        Assert.Equal("usp_Revenue", script.GetProperty("name").GetString());
        Assert.Equal(session, script.GetProperty("sessionId").GetGuid());
        Assert.Equal(0, await CountAsync("SELECT COUNT(*) FROM sys.procedures WHERE name = 'usp_Revenue'"));
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/scripts/{scriptId}", Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await client.GetAsync($"/scripts/{scriptId}", Ct)).StatusCode);
    }

    [Fact]
    public async Task Visualizations_are_validated_and_retried_with_the_findings()
    {
        var (client, connectionId) = await ConnectAsync();
        var session = await CreateSessionAsync(client, connectionId);
        factory.Agents.Dsl.Clear();
        factory.Agents.Dsl.Enqueue(() => new DslGeneration(false, FakeAgents.Table("Name", "Missing"), null));
        factory.Agents.Dsl.Enqueue(() => new DslGeneration(false, FakeAgents.Table("Name", "Revenue"), null));
        var before = factory.Agents.DslCalls.Count;

        var result = await JsonAsync(await client.PostAsJsonAsync($"/chat-sessions/{session}/visualizations", Request("table"), Ct));

        var calls = factory.Agents.DslCalls.Skip(before).ToArray();
        Assert.Equal(2, calls.Length);
        Assert.Empty(calls[0].PreviousIssues);
        Assert.Contains(calls[1].PreviousIssues, i => i.Code == "unknown-column");
        Assert.Equal(["Name", "Revenue"], calls[1].Columns.Select(c => c.Name));
        Assert.Equal("root", result.GetProperty("dsl").GetProperty("components")[0].GetProperty("id").GetString());
        Assert.Equal(2, result.GetProperty("columns").GetArrayLength());
    }

    [Fact]
    public async Task Invalid_dsl_after_the_retries_and_unsupported_requests_are_errors()
    {
        var (client, connectionId) = await ConnectAsync();
        var session = await CreateSessionAsync(client, connectionId);
        factory.Agents.Dsl.Clear();
        for (var i = 0; i < 3; i++)
        {
            factory.Agents.Dsl.Enqueue(() => new DslGeneration(false, FakeAgents.Table("Nope"), null));
        }

        var invalid = await client.PostAsJsonAsync($"/chat-sessions/{session}/visualizations", Request("table"), Ct);
        factory.Agents.Dsl.Enqueue(() => new DslGeneration(true, null, "Charts are not available yet; a table or a KPI is."));
        var unsupported = await client.PostAsJsonAsync($"/chat-sessions/{session}/visualizations", Request("kpi"), Ct);

        var problem = await ProblemAsync(invalid, (HttpStatusCode)422, "dsl-validation-failed");
        Assert.Equal("unknown-column", problem.GetProperty("issues")[0].GetProperty("code").GetString());
        Assert.StartsWith("/components/", problem.GetProperty("issues")[0].GetProperty("path").GetString(), StringComparison.Ordinal);
        var refused = await ProblemAsync(unsupported, (HttpStatusCode)422, "visualization-not-supported");
        Assert.Equal("Charts are not available yet; a table or a KPI is.", refused.GetProperty("detail").GetString());
    }

    [Fact]
    public async Task Other_users_cannot_read_or_change_sessions_or_scripts()
    {
        var (owner, connectionId) = await ConnectAsync();
        var session = await CreateSessionAsync(owner, connectionId);
        factory.Agents.Sql = _ => new SqlGeneration(SqlKind.StoredProcedure, "CREATE PROCEDURE dbo.usp_A AS SELECT 1 AS X", "x", [], "usp_A");
        var turn = await JsonAsync(await owner.PostAsJsonAsync($"/chat-sessions/{session}/messages", new { text = "procedure please" }, Ct), HttpStatusCode.Created);
        var scriptId = turn.GetProperty("answer").GetProperty("generatedSql").GetProperty("savedScriptId").GetGuid();
        var other = factory.ClientFor(Guid.NewGuid());
        await AcceptAsync(other);

        await ProblemAsync(await other.GetAsync($"/connections/{connectionId}/chat-sessions", Ct), HttpStatusCode.NotFound, "not-found");
        await ProblemAsync(await other.PostAsJsonAsync($"/connections/{connectionId}/chat-sessions", new { }, Ct), HttpStatusCode.NotFound, "not-found");
        await ProblemAsync(await other.GetAsync($"/chat-sessions/{session}", Ct), HttpStatusCode.NotFound, "not-found");
        await ProblemAsync(await other.PostAsJsonAsync($"/chat-sessions/{session}/messages", new { text = "hi" }, Ct), HttpStatusCode.NotFound, "not-found");
        await ProblemAsync(await other.PostAsJsonAsync($"/chat-sessions/{session}/visualizations", Request("table"), Ct), HttpStatusCode.NotFound, "not-found");
        await ProblemAsync(await other.GetAsync($"/connections/{connectionId}/scripts", Ct), HttpStatusCode.NotFound, "not-found");
        await ProblemAsync(await other.GetAsync($"/scripts/{scriptId}", Ct), HttpStatusCode.NotFound, "not-found");
        await ProblemAsync(await other.DeleteAsync($"/scripts/{scriptId}", Ct), HttpStatusCode.NotFound, "not-found");
        Assert.Equal(HttpStatusCode.OK, (await owner.GetAsync($"/scripts/{scriptId}", Ct)).StatusCode);
    }

    [Fact]
    public async Task Withdrawn_consent_hides_history_and_scripts_until_granted_again()
    {
        var (client, connectionId) = await ConnectAsync();
        var session = await CreateSessionAsync(client, connectionId);
        factory.Agents.Sql = _ => new SqlGeneration(SqlKind.StoredProcedure, "CREATE PROCEDURE dbo.usp_B AS SELECT 1 AS X", "x", [], "usp_B");
        var turn = await JsonAsync(await client.PostAsJsonAsync($"/chat-sessions/{session}/messages", new { text = "procedure please" }, Ct), HttpStatusCode.Created);
        var scriptId = turn.GetProperty("answer").GetProperty("generatedSql").GetProperty("savedScriptId").GetGuid();

        (await client.DeleteAsync($"/connections/{connectionId}/consent", Ct)).EnsureSuccessStatusCode();

        await ProblemAsync(await client.GetAsync($"/connections/{connectionId}/chat-sessions", Ct), HttpStatusCode.Forbidden, "consent-withdrawn");
        await ProblemAsync(await client.GetAsync($"/chat-sessions/{session}", Ct), HttpStatusCode.Forbidden, "consent-withdrawn");
        await ProblemAsync(await client.PostAsJsonAsync($"/chat-sessions/{session}/messages", new { text = "again" }, Ct), HttpStatusCode.Forbidden, "consent-withdrawn");
        await ProblemAsync(await client.GetAsync($"/connections/{connectionId}/scripts", Ct), HttpStatusCode.Forbidden, "consent-withdrawn");
        await ProblemAsync(await client.GetAsync($"/scripts/{scriptId}", Ct), HttpStatusCode.Forbidden, "consent-withdrawn");

        (await client.PutAsync($"/connections/{connectionId}/consent", null, Ct)).EnsureSuccessStatusCode();
        var restored = await JsonAsync(await client.GetAsync($"/chat-sessions/{session}", Ct));
        Assert.Equal(2, restored.GetProperty("messages").GetArrayLength());
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/scripts/{scriptId}", Ct)).StatusCode);
    }

    [Fact]
    public async Task An_unavailable_agent_is_an_error_and_stores_nothing()
    {
        var (client, connectionId) = await ConnectAsync();
        var session = await CreateSessionAsync(client, connectionId);
        factory.Agents.Unavailable = true;
        try
        {
            var response = await client.PostAsJsonAsync($"/chat-sessions/{session}/messages", new { text = "anything" }, Ct);

            await ProblemAsync(response, HttpStatusCode.ServiceUnavailable, "agents-unavailable");
            var reopened = await JsonAsync(await client.GetAsync($"/chat-sessions/{session}", Ct));
            Assert.Equal(0, reopened.GetProperty("messages").GetArrayLength());
        }
        finally
        {
            factory.Agents.Unavailable = false;
        }
    }

    private static object Request(string kind) => new
    {
        columns = new[] { new { name = "Name", sqlType = "nvarchar(200)", nullable = false }, new { name = "Revenue", sqlType = "decimal(38,2)", nullable = true } },
        intent = new { kind, description = "revenue per customer" },
    };

    private async Task<(HttpClient Client, Guid ConnectionId)> ConnectAsync()
    {
        factory.Agents.Sql = _ => new SqlGeneration(SqlKind.Query, "SELECT Name FROM dbo.Customers", "Lists customers.", ["dbo.Customers"], null);
        var client = factory.ClientFor(Guid.NewGuid());
        await AcceptAsync(client);
        var created = await JsonAsync(await client.PostAsJsonAsync("/connections", new { name = "Target", connectionString = target.ConnectionString }, Ct), HttpStatusCode.Created);
        return (client, created.GetProperty("id").GetGuid());
    }

    private static async Task<Guid> CreateSessionAsync(HttpClient client, Guid connectionId) =>
        (await JsonAsync(await client.PostAsJsonAsync($"/connections/{connectionId}/chat-sessions", new { }, Ct), HttpStatusCode.Created)).GetProperty("id").GetGuid();

    private static async Task AcceptAsync(HttpClient client) =>
        (await client.PostAsJsonAsync("/consent/acceptance", new { termsVersion = EmbeddedConsentTermsProvider.CurrentVersion }, Ct)).EnsureSuccessStatusCode();

    private static async Task<JsonElement> JsonAsync(HttpResponseMessage response, HttpStatusCode expected = HttpStatusCode.OK)
    {
        var text = await response.Content.ReadAsStringAsync(Ct);
        Assert.True(response.StatusCode == expected, $"Expected {(int)expected}, got {(int)response.StatusCode}: {text}");
        return JsonDocument.Parse(text).RootElement.Clone();
    }

    private static async Task<JsonElement> ProblemAsync(HttpResponseMessage response, HttpStatusCode status, string name)
    {
        var problem = await JsonAsync(response, status);
        Assert.Equal($"urn:esi:problem:{name}", problem.GetProperty("type").GetString());
        return problem;
    }

    private async Task<int> CountAsync(string sql)
    {
        await using var connection = new Microsoft.Data.SqlClient.SqlConnection(target.ConnectionString);
        await connection.OpenAsync(Ct);
        await using var command = new Microsoft.Data.SqlClient.SqlCommand(sql, connection);
        return (int)(await command.ExecuteScalarAsync(Ct))!;
    }

    public sealed class Factory : CoreApiFactory;
}
