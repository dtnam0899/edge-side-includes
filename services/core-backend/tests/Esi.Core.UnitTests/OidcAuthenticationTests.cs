using System.Collections.Concurrent;
using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using Esi.Core.Application.Users;
using Esi.Core.Domain.Users;
using Esi.Core.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;

namespace Esi.Core.UnitTests;

/// <summary>ADR-0006 verification in memory: Oidc mode with locally signed tokens; the users table is a fake.</summary>
public class OidcAuthenticationTests(OidcAuthenticationTests.Factory factory) : IClassFixture<OidcAuthenticationTests.Factory>
{
    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    public static TheoryData<string, string> InvalidTokens => new()
    {
        { "malformed", "not-a-jwt" },
        { "wrong audience", TestTokens.Create("auth0|a", audience: "https://other-api.test") },
        { "wrong issuer", TestTokens.Create("auth0|a", issuer: "https://other-issuer.test/") },
        { "expired", TestTokens.Create("auth0|a", expires: DateTime.UtcNow.AddHours(-1)) },
        { "foreign signing key", TestTokens.Create("auth0|a", key: TestTokens.ForeignKey) },
        { "tampered payload", Tamper(TestTokens.Create("auth0|a"), TestTokens.Create("auth0|b")) },
        { "symmetric algorithm", TestTokens.Create("auth0|a", key: new SymmetricSecurityKey(new byte[32]), algorithm: SecurityAlgorithms.HmacSha256) },
    };

    [Fact]
    public async Task No_token_is_401_unauthenticated()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/connections", Ct);

        await AssertUnauthenticatedAsync(response);
        Assert.Empty(factory.Users.Rows);
    }

    [Theory]
    [MemberData(nameof(InvalidTokens))]
    public async Task Invalid_token_is_401_unauthenticated(string reason, string token)
    {
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await client.GetAsync("/consent/terms", Ct);

        await AssertUnauthenticatedAsync(response);
        Assert.DoesNotContain(factory.Users.Rows.Keys, k => k.Subject == "auth0|a" || k.Subject == "auth0|b");
        _ = reason; // names the case in the test output
    }

    [Fact]
    public async Task Liveness_needs_no_token()
    {
        using var client = factory.CreateClient();

        using var response = await client.GetAsync("/health", Ct);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    [Fact]
    public async Task Valid_token_is_mapped_to_one_internal_user()
    {
        var subject = $"auth0|{Guid.NewGuid():N}";
        using var client = factory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", TestTokens.Create(subject));

        using var first = await client.GetAsync("/consent/terms", Ct);
        using var second = await client.GetAsync("/consent/terms", Ct);

        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        Assert.Equal(HttpStatusCode.OK, second.StatusCode);
        Assert.Single(factory.Users.Rows.Keys, k => k == (TestTokens.Issuer, subject));
    }

    private static async Task AssertUnauthenticatedAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Contains(response.Headers.WwwAuthenticate, h => h.Scheme == "Bearer");
        using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync(Ct));
        Assert.Equal("urn:esi:problem:unauthenticated", body.RootElement.GetProperty("type").GetString());
        Assert.Equal(401, body.RootElement.GetProperty("status").GetInt32());
    }

    /// <summary>Header and payload of <paramref name="token"/> with the signature of <paramref name="other"/>.</summary>
    private static string Tamper(string token, string other) =>
        string.Join('.', token.Split('.')[..2].Append(other.Split('.')[2]));

    public sealed class Factory : WebApplicationFactory<Program>
    {
        public FakeUserRepository Users { get; } = new();

        protected override IHost CreateHost(IHostBuilder builder)
        {
            var settings = TestEnvironment.LocalAdmin("Host=unused;Database=esi_core"); // never opened
            foreach (var (key, value) in TestTokens.OidcSettings)
            {
                settings[key] = value;
            }

            return TestEnvironment.CreateHost(settings, () => base.CreateHost(builder));
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder) =>
            builder.ConfigureTestServices(services =>
            {
                services.UseTestIssuer();
                services.AddSingleton<IUserRepository>(Users);
            });
    }

    public sealed class FakeUserRepository : IUserRepository
    {
        public ConcurrentDictionary<(string Issuer, string Subject), Guid> Rows { get; } = new();

        public Task<Guid?> FindIdAsync(string issuer, string subject, CancellationToken cancellationToken) =>
            Task.FromResult(Rows.TryGetValue((issuer, subject), out var id) ? id : (Guid?)null);

        public Task<Guid> AddOrGetIdAsync(User user, CancellationToken cancellationToken) =>
            Task.FromResult(Rows.GetOrAdd((user.Issuer, user.Subject), user.Id));
    }
}
