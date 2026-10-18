using System.Net;
using System.Text;
using System.Text.Json;
using Esi.Core.Application.Agents;
using Esi.Core.Application.Problems;
using Esi.Core.Application.Queries;
using Esi.Core.Domain.Chat;
using Esi.Core.Domain.Schema;
using Esi.Core.Infrastructure.Agents;
using Microsoft.Extensions.Logging.Abstractions;

namespace Esi.Core.UnitTests;

public class HttpAgentsClientTests
{
    private static readonly SchemaMetadata Schema = new(
    [
        new DatabaseSchema("dbo",
            [new TableMetadata("Customers", TableKind.Table, [new ColumnMetadata("Name", "nvarchar(200)", false)], ["CustomerId"], [])],
            [new ProcedureMetadata("usp_X", "CREATE PROCEDURE dbo.usp_X AS SELECT 1")]),
    ]);

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Generate_sql_sends_typed_fields_only_and_maps_the_result()
    {
        var handler = new Handler(HttpStatusCode.OK, """{"kind":"stored-procedure","sql":"CREATE PROCEDURE dbo.usp_R AS SELECT 1","explanation":"uses Customers","referencedTables":["dbo.Customers"],"procedureName":"usp_R"}""");

        var result = await Client(handler).GenerateSqlAsync("revenue?", Schema, [new ConversationTurn(ChatRole.User, "earlier")], Ct);

        Assert.Equal(SqlKind.StoredProcedure, result.Kind);
        Assert.Equal("usp_R", result.ProcedureName);
        Assert.Equal("/sql-generations", handler.Path);
        using var body = JsonDocument.Parse(handler.Body!);
        Assert.Equal(["history", "question", "schema"], body.RootElement.EnumerateObject().Select(p => p.Name).Order().ToArray());
        Assert.Equal("user", body.RootElement.GetProperty("history")[0].GetProperty("role").GetString());
        Assert.Equal("table", body.RootElement.GetProperty("schema").GetProperty("schemas")[0].GetProperty("tables")[0].GetProperty("kind").GetString());
    }

    [Fact]
    public async Task Generate_dsl_maps_generated_and_unsupported_results()
    {
        var generated = new Handler(HttpStatusCode.OK, """{"status":"generated","dsl":{"catalogId":"c","protocolVersion":"v0.9","dslSchemaVersion":"0.1.0","components":[{"id":"root","component":"Text","text":"x"}]}}""");
        var unsupported = new Handler(HttpStatusCode.OK, """{"status":"unsupported","reason":"charts are not available yet"}""");
        ResultColumn[] columns = [new("Name", "nvarchar(200)", false)];

        var dsl = await Client(generated).GenerateDslAsync(columns, "kpi", "total", "c", [], Ct);
        var refused = await Client(unsupported).GenerateDslAsync(columns, "table", "a pie chart", "c", [], Ct);

        Assert.False(dsl.Unsupported);
        Assert.Equal("root", dsl.Dsl!.Value.GetProperty("components")[0].GetProperty("id").GetString());
        Assert.Equal("kpi", JsonDocument.Parse(generated.Body!).RootElement.GetProperty("intent").GetProperty("kind").GetString());
        Assert.True(refused.Unsupported);
        Assert.Equal("charts are not available yet", refused.Reason);
    }

    [Fact]
    public async Task An_agent_side_dsl_failure_keeps_its_issues()
    {
        var handler = new Handler((HttpStatusCode)422, """{"type":"urn:esi:problem:dsl-validation-failed","title":"x","status":422,"issues":[{"code":"unknown-column","message":"m","path":"/components/1/text"}]}""");

        var problem = await Assert.ThrowsAsync<EsiProblem>(() => Client(handler).GenerateDslAsync([new("A", "int", false)], "table", null, "c", [], Ct));

        Assert.Equal("dsl-validation-failed", problem.Name);
        Assert.Equal(("unknown-column", "m", "/components/1/text"), Assert.Single(problem.Issues));
    }

    [Theory]
    [InlineData(HttpStatusCode.ServiceUnavailable)]
    [InlineData(HttpStatusCode.InternalServerError)]
    [InlineData(HttpStatusCode.BadRequest)]
    public async Task Agent_errors_become_agents_unavailable(HttpStatusCode status)
    {
        var handler = new Handler(status, """{"type":"urn:esi:problem:model-unavailable","title":"x","status":503}""");

        var problem = await Assert.ThrowsAsync<EsiProblem>(() => Client(handler).GenerateSqlAsync("q", Schema, [], Ct));

        Assert.Equal(("agents-unavailable", 503), (problem.Name, problem.Status));
    }

    [Fact]
    public async Task Unreachable_or_unconfigured_agents_are_unavailable()
    {
        var unreachable = await Assert.ThrowsAsync<EsiProblem>(() => Client(new Handler(throws: true)).GenerateSqlAsync("q", Schema, [], Ct));
        var unconfigured = await Assert.ThrowsAsync<EsiProblem>(() =>
            new HttpAgentsClient(new Esi.Core.Infrastructure.Agents.Contracts.AgentsApiClient(new HttpClient(new Handler(HttpStatusCode.OK, "{}"))), new AgentsOptions(null), NullLogger<HttpAgentsClient>.Instance)
                .GenerateSqlAsync("q", Schema, [], Ct));

        Assert.Equal("agents-unavailable", unreachable.Name);
        Assert.Contains("ESI_CORE_Agents__BaseUrl", unconfigured.Detail, StringComparison.Ordinal);
    }

    private static HttpAgentsClient Client(Handler handler) =>
        new(new Esi.Core.Infrastructure.Agents.Contracts.AgentsApiClient(new HttpClient(handler) { BaseAddress = new Uri("http://agents.test/") }),
            new AgentsOptions(new Uri("http://agents.test/")),
            NullLogger<HttpAgentsClient>.Instance);

    private sealed class Handler(HttpStatusCode status = HttpStatusCode.OK, string response = "{}", bool throws = false) : HttpMessageHandler
    {
        public string? Path { get; private set; }

        public string? Body { get; private set; }

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            if (throws)
            {
                throw new HttpRequestException("connection refused");
            }

            Path = request.RequestUri!.AbsolutePath;
            Body = request.Content is null ? null : await request.Content.ReadAsStringAsync(cancellationToken);
            return new HttpResponseMessage(status) { Content = new StringContent(response, Encoding.UTF8, "application/json") };
        }
    }
}
