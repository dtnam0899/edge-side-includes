using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Esi.Core.Application.Consent;

namespace Esi.Core.IntegrationTests;

/// <summary>
/// ESI-17 (part 2): saved artifacts and dashboards against the seeded esi_target database. Owner isolation, consent
/// hiding, unavailable or missing items instead of stale data, live execution per item, and layout persistence.
/// </summary>
[Collection(TargetDatabaseCollection.Name)]
public class ArtifactsDashboardsApiTests(ArtifactsDashboardsApiTests.Factory factory, TargetDatabase target)
    : IClassFixture<ArtifactsDashboardsApiTests.Factory>
{
    private const string CustomersSql = "SELECT Name, Country FROM dbo.Customers ORDER BY Name";

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task An_artifact_is_validated_saved_and_run_on_live_data()
    {
        var (client, connectionId) = await ConnectAsync();

        var created = await JsonAsync(await SaveAsync(client, connectionId, "Customers", CustomersSql, "Name", "Country"), HttpStatusCode.Created);
        var id = created.GetProperty("id").GetGuid();
        var list = await JsonAsync(await client.GetAsync($"/connections/{connectionId}/artifacts", Ct));
        var page = await JsonAsync(await client.PostAsJsonAsync($"/artifacts/{id}/executions", new { page = 1 }, Ct));

        Assert.Equal("available", created.GetProperty("status").GetString());
        Assert.Equal("0.1.0", created.GetProperty("dsl").GetProperty("dslSchemaVersion").GetString());
        Assert.Equal(CustomersSql, created.GetProperty("sql").GetString());
        Assert.Contains(list.EnumerateArray(), a => a.GetProperty("id").GetGuid() == id && a.GetProperty("kind").GetString() == "table");
        Assert.Equal(["Contoso Ltd", "Fabrikam Inc"], page.GetProperty("rows").EnumerateArray().Select(r => r.GetProperty("Name").GetString()));
        Assert.Equal(0, page.GetProperty("page").GetProperty("remainingRows").GetInt64());
    }

    [Fact]
    public async Task Invalid_dsl_or_sql_is_not_saved()
    {
        var (client, connectionId) = await ConnectAsync();

        var unknownColumn = await SaveAsync(client, connectionId, "Bad", CustomersSql, "Name", "Country", dslColumns: ["Name", "Revenue"]);
        var write = await SaveAsync(client, connectionId, "Bad", "DELETE FROM dbo.Customers", "Name");
        var list = await JsonAsync(await client.GetAsync($"/connections/{connectionId}/artifacts", Ct));

        Assert.Equal("unknown-column", (await ProblemAsync(unknownColumn, (HttpStatusCode)422, "dsl-validation-failed")).GetProperty("issues")[0].GetProperty("code").GetString());
        await ProblemAsync(write, (HttpStatusCode)422, "sql-rejected");
        Assert.Equal(0, list.GetArrayLength());
    }

    [Fact]
    public async Task Dashboard_layout_is_saved_and_restored()
    {
        var (client, connectionId) = await ConnectAsync();
        var artifact = await SaveIdAsync(client, connectionId, CustomersSql, "Name", "Country");
        var dashboard = (await JsonAsync(await client.PostAsJsonAsync($"/connections/{connectionId}/dashboards", new { name = "Sales" }, Ct), HttpStatusCode.Created)).GetProperty("id").GetGuid();

        var first = await JsonAsync(await client.PostAsJsonAsync($"/dashboards/{dashboard}/items", new { artifactId = artifact, layout = Layout(0, 0, 6, 4) }, Ct), HttpStatusCode.Created);
        var second = await JsonAsync(await client.PostAsJsonAsync($"/dashboards/{dashboard}/items", new { artifactId = artifact, layout = Layout(6, 0, 6, 4) }, Ct), HttpStatusCode.Created);
        var a = first.GetProperty("id").GetGuid();
        var b = second.GetProperty("id").GetGuid();
        (await client.PutAsJsonAsync($"/dashboards/{dashboard}/layout", new { items = new[] { new { itemId = a, layout = Layout(0, 4, 12, 3) }, new { itemId = b, layout = Layout(0, 0, 4, 4) } } }, Ct)).EnsureSuccessStatusCode();
        await client.PutAsJsonAsync($"/dashboards/{dashboard}", new { name = "Sales overview" }, Ct);

        var reopened = await JsonAsync(await client.GetAsync($"/dashboards/{dashboard}", Ct));
        var items = reopened.GetProperty("items").EnumerateArray().ToDictionary(i => i.GetProperty("id").GetGuid());
        Assert.Equal("Sales overview", reopened.GetProperty("name").GetString());
        Assert.Equal((0, 4, 12, 3), LayoutOf(items[a]));
        Assert.Equal((0, 0, 4, 4), LayoutOf(items[b]));
        Assert.Equal("available", items[a].GetProperty("status").GetString());
        Assert.Equal(CustomersSql, items[a].GetProperty("artifact").GetProperty("sql").GetString());
        Assert.False(items[a].TryGetProperty("rows", out _));

        var summary = (await JsonAsync(await client.GetAsync($"/connections/{connectionId}/dashboards", Ct))).EnumerateArray().Single(d => d.GetProperty("id").GetGuid() == dashboard);
        Assert.Equal(2, summary.GetProperty("itemCount").GetInt32());

        await ProblemAsync(await client.PutAsJsonAsync($"/dashboards/{dashboard}/layout", new { items = new[] { new { itemId = a, layout = Layout(0, 0, 1, 1) } } }, Ct), HttpStatusCode.BadRequest, "invalid-request");
        await ProblemAsync(await client.PostAsJsonAsync($"/dashboards/{dashboard}/items", new { artifactId = artifact, layout = Layout(-1, 0, 0, 1) }, Ct), HttpStatusCode.BadRequest, "invalid-request");
        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/dashboards/{dashboard}/items/{b}", Ct)).StatusCode);
        Assert.Equal(1, (await JsonAsync(await client.GetAsync($"/dashboards/{dashboard}", Ct))).GetProperty("items").GetArrayLength());
    }

    [Fact]
    public async Task One_failing_item_does_not_block_the_others()
    {
        var (client, connectionId) = await ConnectAsync();
        var good = await SaveIdAsync(client, connectionId, CustomersSql, "Name", "Country");
        var failing = await SaveIdAsync(client, connectionId, "SELECT 1 / 0 AS Boom", "Boom");
        var dashboard = (await JsonAsync(await client.PostAsJsonAsync($"/connections/{connectionId}/dashboards", new { name = "Mixed" }, Ct), HttpStatusCode.Created)).GetProperty("id").GetGuid();
        await client.PostAsJsonAsync($"/dashboards/{dashboard}/items", new { artifactId = failing, layout = Layout(0, 0, 4, 4) }, Ct);
        await client.PostAsJsonAsync($"/dashboards/{dashboard}/items", new { artifactId = good, layout = Layout(4, 0, 4, 4) }, Ct);

        var opened = await JsonAsync(await client.GetAsync($"/dashboards/{dashboard}", Ct));
        var results = new List<HttpStatusCode>();
        foreach (var item in opened.GetProperty("items").EnumerateArray())
        {
            results.Add((await client.PostAsJsonAsync($"/artifacts/{item.GetProperty("artifactId").GetGuid()}/executions", new { }, Ct)).StatusCode);
        }

        Assert.Equal([(HttpStatusCode)422, HttpStatusCode.OK], results);
    }

    [Fact]
    public async Task Other_users_cannot_read_or_modify_artifacts_or_dashboards()
    {
        var (owner, connectionId) = await ConnectAsync();
        var artifact = await SaveIdAsync(owner, connectionId, CustomersSql, "Name", "Country");
        var dashboard = (await JsonAsync(await owner.PostAsJsonAsync($"/connections/{connectionId}/dashboards", new { name = "Mine" }, Ct), HttpStatusCode.Created)).GetProperty("id").GetGuid();
        var item = (await JsonAsync(await owner.PostAsJsonAsync($"/dashboards/{dashboard}/items", new { artifactId = artifact, layout = Layout(0, 0, 4, 4) }, Ct), HttpStatusCode.Created)).GetProperty("id").GetGuid();
        var (other, otherConnection) = await ConnectAsync();
        var otherDashboard = (await JsonAsync(await other.PostAsJsonAsync($"/connections/{otherConnection}/dashboards", new { name = "Theirs" }, Ct), HttpStatusCode.Created)).GetProperty("id").GetGuid();

        HttpResponseMessage[] attempts =
        [
            await other.GetAsync($"/connections/{connectionId}/artifacts", Ct),
            await SaveAsync(other, connectionId, "x", CustomersSql, "Name", "Country"),
            await other.GetAsync($"/artifacts/{artifact}", Ct),
            await other.PostAsJsonAsync($"/artifacts/{artifact}/executions", new { }, Ct),
            await other.DeleteAsync($"/artifacts/{artifact}", Ct),
            await other.GetAsync($"/connections/{connectionId}/dashboards", Ct),
            await other.PostAsJsonAsync($"/connections/{connectionId}/dashboards", new { name = "x" }, Ct),
            await other.GetAsync($"/dashboards/{dashboard}", Ct),
            await other.PutAsJsonAsync($"/dashboards/{dashboard}", new { name = "x" }, Ct),
            await other.PostAsJsonAsync($"/dashboards/{dashboard}/items", new { artifactId = artifact, layout = Layout(0, 0, 1, 1) }, Ct),
            await other.DeleteAsync($"/dashboards/{dashboard}/items/{item}", Ct),
            await other.PutAsJsonAsync($"/dashboards/{dashboard}/layout", new { items = new[] { new { itemId = item, layout = Layout(0, 0, 1, 1) } } }, Ct),
            await other.DeleteAsync($"/dashboards/{dashboard}", Ct),
        ];
        var stolen = await other.PostAsJsonAsync($"/dashboards/{otherDashboard}/items", new { artifactId = artifact, layout = Layout(0, 0, 1, 1) }, Ct);

        foreach (var attempt in attempts)
        {
            await ProblemAsync(attempt, HttpStatusCode.NotFound, "not-found");
        }

        await ProblemAsync(stolen, HttpStatusCode.BadRequest, "invalid-request");
        var mine = await JsonAsync(await owner.GetAsync($"/dashboards/{dashboard}", Ct));
        Assert.Equal("Mine", mine.GetProperty("name").GetString());
        Assert.Equal(1, mine.GetProperty("items").GetArrayLength());
    }

    [Fact]
    public async Task Withdrawn_consent_hides_artifacts_and_dashboards_until_granted_again()
    {
        var (client, connectionId) = await ConnectAsync();
        var artifact = await SaveIdAsync(client, connectionId, CustomersSql, "Name", "Country");
        var dashboard = (await JsonAsync(await client.PostAsJsonAsync($"/connections/{connectionId}/dashboards", new { name = "D" }, Ct), HttpStatusCode.Created)).GetProperty("id").GetGuid();

        (await client.DeleteAsync($"/connections/{connectionId}/consent", Ct)).EnsureSuccessStatusCode();

        await ProblemAsync(await client.GetAsync($"/connections/{connectionId}/artifacts", Ct), HttpStatusCode.Forbidden, "consent-withdrawn");
        await ProblemAsync(await client.GetAsync($"/artifacts/{artifact}", Ct), HttpStatusCode.Forbidden, "consent-withdrawn");
        await ProblemAsync(await client.PostAsJsonAsync($"/artifacts/{artifact}/executions", new { }, Ct), HttpStatusCode.Conflict, "artifact-unavailable");
        await ProblemAsync(await client.GetAsync($"/connections/{connectionId}/dashboards", Ct), HttpStatusCode.Forbidden, "consent-withdrawn");
        await ProblemAsync(await client.GetAsync($"/dashboards/{dashboard}", Ct), HttpStatusCode.Forbidden, "consent-withdrawn");

        (await client.PutAsync($"/connections/{connectionId}/consent", null, Ct)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.OK, (await client.GetAsync($"/dashboards/{dashboard}", Ct)).StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsJsonAsync($"/artifacts/{artifact}/executions", new { }, Ct)).StatusCode);
    }

    [Fact]
    public async Task A_deleted_connection_or_artifact_gives_an_unavailable_state_not_stale_data()
    {
        var (client, connectionId) = await ConnectAsync();
        var kept = await SaveIdAsync(client, connectionId, CustomersSql, "Name", "Country");
        var removed = await SaveIdAsync(client, connectionId, CustomersSql, "Name", "Country");
        var dashboard = (await JsonAsync(await client.PostAsJsonAsync($"/connections/{connectionId}/dashboards", new { name = "D" }, Ct), HttpStatusCode.Created)).GetProperty("id").GetGuid();
        await client.PostAsJsonAsync($"/dashboards/{dashboard}/items", new { artifactId = kept, layout = Layout(0, 0, 4, 4) }, Ct);
        await client.PostAsJsonAsync($"/dashboards/{dashboard}/items", new { artifactId = removed, layout = Layout(4, 0, 4, 4) }, Ct);

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/artifacts/{removed}", Ct)).StatusCode);
        var withMissing = await JsonAsync(await client.GetAsync($"/dashboards/{dashboard}", Ct));
        Assert.Equal(["available", "missing"], withMissing.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("status").GetString()));

        Assert.Equal(HttpStatusCode.NoContent, (await client.DeleteAsync($"/connections/{connectionId}", Ct)).StatusCode);
        var artifact = await JsonAsync(await client.GetAsync($"/artifacts/{kept}", Ct));
        var orphaned = await JsonAsync(await client.GetAsync($"/dashboards/{dashboard}", Ct));

        Assert.Equal("connection-unavailable", artifact.GetProperty("status").GetString());
        Assert.Equal(["connection-unavailable", "missing"], orphaned.GetProperty("items").EnumerateArray().Select(i => i.GetProperty("status").GetString()));
        await ProblemAsync(await client.PostAsJsonAsync($"/artifacts/{kept}/executions", new { }, Ct), HttpStatusCode.Conflict, "artifact-unavailable");
    }

    private static object Layout(int x, int y, int width, int height) => new { x, y, width, height };

    private static (int, int, int, int) LayoutOf(JsonElement item)
    {
        var l = item.GetProperty("layout");
        return (l.GetProperty("x").GetInt32(), l.GetProperty("y").GetInt32(), l.GetProperty("width").GetInt32(), l.GetProperty("height").GetInt32());
    }

    private static Task<HttpResponseMessage> SaveAsync(HttpClient client, Guid connectionId, string name, string sql, params string[] columns) =>
        SaveAsync(client, connectionId, name, sql, columns, null);

    private static Task<HttpResponseMessage> SaveAsync(HttpClient client, Guid connectionId, string name, string sql, string column1, string column2, string[] dslColumns) =>
        SaveAsync(client, connectionId, name, sql, [column1, column2], dslColumns);

    private static Task<HttpResponseMessage> SaveAsync(HttpClient client, Guid connectionId, string name, string sql, string[] columns, string[]? dslColumns) =>
        client.PostAsJsonAsync($"/connections/{connectionId}/artifacts", new
        {
            name,
            kind = "table",
            dsl = FakeAgents.Table(dslColumns ?? columns),
            sql,
            columns = columns.Select(c => new { name = c, sqlType = "nvarchar(200)", nullable = false }),
        }, Ct);

    private static async Task<Guid> SaveIdAsync(HttpClient client, Guid connectionId, string sql, params string[] columns) =>
        (await JsonAsync(await SaveAsync(client, connectionId, "Saved", sql, columns), HttpStatusCode.Created)).GetProperty("id").GetGuid();

    private async Task<(HttpClient Client, Guid ConnectionId)> ConnectAsync()
    {
        var client = factory.ClientFor(Guid.NewGuid());
        (await client.PostAsJsonAsync("/consent/acceptance", new { termsVersion = EmbeddedConsentTermsProvider.CurrentVersion }, Ct)).EnsureSuccessStatusCode();
        var created = await JsonAsync(await client.PostAsJsonAsync("/connections", new { name = "Target", connectionString = target.ConnectionString }, Ct), HttpStatusCode.Created);
        return (client, created.GetProperty("id").GetGuid());
    }

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

    public sealed class Factory : CoreApiFactory;
}
