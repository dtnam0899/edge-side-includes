using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using Esi.Core.Infrastructure.Persistence;
using Esi.Core.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;

namespace Esi.Core.IntegrationTests;

/// <summary>
/// ADR-0006 against the compose app database: Oidc mode with locally signed tokens maps (issuer, subject) to one
/// row in <c>Users</c>, and owner isolation follows the mapped id.
/// </summary>
public class OidcAuthenticationTests(OidcAuthenticationTests.Factory factory) : IClassFixture<OidcAuthenticationTests.Factory>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Same_subject_maps_to_one_user_row_even_when_first_requests_race()
    {
        var subject = NewSubject();
        using var client = ClientFor(subject);

        var responses = await Task.WhenAll(Enumerable.Range(0, 8).Select(_ => client.GetAsync("/consent/terms", Ct)));
        using var later = await client.GetAsync("/consent/terms", Ct);

        Assert.All(responses, r => Assert.Equal(HttpStatusCode.OK, r.StatusCode));
        Assert.Equal(HttpStatusCode.OK, later.StatusCode);
        Assert.Single(await UserIdsAsync(subject));
    }

    [Fact]
    public async Task Different_subjects_get_different_users()
    {
        var first = NewSubject();
        var second = NewSubject();
        using var a = ClientFor(first);
        using var b = ClientFor(second);

        (await a.GetAsync("/consent/terms", Ct)).EnsureSuccessStatusCode();
        (await b.GetAsync("/consent/terms", Ct)).EnsureSuccessStatusCode();

        Assert.NotEqual(Assert.Single(await UserIdsAsync(first)), Assert.Single(await UserIdsAsync(second)));
    }

    [Fact]
    public async Task Another_users_connection_is_404_and_the_owner_keeps_it_across_tokens()
    {
        var ownerSubject = NewSubject();
        using var owner = ClientFor(ownerSubject);
        using var other = ClientFor(NewSubject());
        await AcceptTermsAsync(owner);
        await AcceptTermsAsync(other);

        using var created = await owner.PostAsJsonAsync("/connections", new { name = "Sales", connectionString = TestDatabases.TargetDb }, Ct);
        Assert.Equal(HttpStatusCode.Created, created.StatusCode);
        var id = JsonDocument.Parse(await created.Content.ReadAsStringAsync(Ct)).RootElement.GetProperty("id").GetGuid();

        using var foreign = await other.GetAsync($"/connections/{id}", Ct);
        using var ownerAgain = ClientFor(ownerSubject); // a fresh token for the same account
        using var own = await ownerAgain.GetAsync($"/connections/{id}", Ct);

        Assert.Equal(HttpStatusCode.NotFound, foreign.StatusCode);
        Assert.Equal(HttpStatusCode.OK, own.StatusCode);
        Assert.Equal(HttpStatusCode.NoContent, (await owner.DeleteAsync($"/connections/{id}", Ct)).StatusCode);
    }

    [Fact]
    public async Task Readiness_needs_no_token_and_operations_do()
    {
        using var client = factory.CreateClient();

        using var ready = await client.GetAsync("/health/ready", Ct);
        using var connections = await client.GetAsync("/connections", Ct);

        Assert.Equal(HttpStatusCode.OK, ready.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, connections.StatusCode);
        Assert.Contains("urn:esi:problem:unauthenticated", await connections.Content.ReadAsStringAsync(Ct), StringComparison.Ordinal);
    }

    private static string NewSubject() => $"auth0|{Guid.NewGuid():N}";

    private HttpClient ClientFor(string subject)
    {
        var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", TestTokens.Create(subject));
        return client;
    }

    private static async Task AcceptTermsAsync(HttpClient client)
    {
        var terms = JsonDocument.Parse(await client.GetStringAsync("/consent/terms", Ct)).RootElement;
        using var response = await client.PostAsJsonAsync("/consent/acceptance", new { termsVersion = terms.GetProperty("version").GetString() }, Ct);
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
    }

    private async Task<List<Guid>> UserIdsAsync(string subject)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        return await db.Users.Where(u => u.Issuer == TestTokens.Issuer && u.Subject == subject).Select(u => u.Id).ToListAsync(Ct);
    }

    public sealed class Factory : WebApplicationFactory<Program>
    {
        protected override IHost CreateHost(IHostBuilder builder)
        {
            var settings = CoreApiFactory.LocalAdminSettings();
            foreach (var (key, value) in TestTokens.OidcSettings)
            {
                settings[key] = value;
            }

            return CoreApiFactory.CreateHostWith(settings, () => base.CreateHost(builder));
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder) =>
            builder.ConfigureTestServices(services => services.UseTestIssuer());
    }
}
