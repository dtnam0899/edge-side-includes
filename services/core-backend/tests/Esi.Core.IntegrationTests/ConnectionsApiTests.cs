using System.Net;
using System.Net.Http.Json;
using System.Text;
using System.Text.Json;
using Esi.Core.Application.Consent;
using Esi.Core.Infrastructure.Persistence;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Esi.Core.IntegrationTests;

/// <summary>
/// ESI-15 acceptance: consent before connecting, owner isolation on every operation, withdrawn consent blocks use,
/// connection tests give non-secret errors, and no connection string or password appears in responses or logs.
/// The "user's database" is the compose SQL Server (master); its sa password is the seeded secret.
/// </summary>
public class ConnectionsApiTests(ConnectionsApiTests.Factory factory) : IClassFixture<ConnectionsApiTests.Factory>
{
    private static readonly SqlConnectionStringBuilder Target = new(TestDatabases.TargetDb);

    private readonly List<string> _responses = [];

    private static CancellationToken Ct => TestContext.Current.CancellationToken;

    [Fact]
    public async Task Adding_a_connection_requires_the_current_terms()
    {
        var client = factory.ClientFor(Guid.NewGuid());

        var withoutConsent = await SendAsync(client, HttpMethod.Post, "/connections", new { name = "Sales", connectionString = Target.ConnectionString });
        var outdated = await SendAsync(client, HttpMethod.Post, "/consent/acceptance", new { termsVersion = "1999-01-01.1" });

        await AssertProblemAsync(withoutConsent, HttpStatusCode.Forbidden, "consent-required");
        await AssertProblemAsync(outdated, HttpStatusCode.Conflict, "terms-version-outdated");
        Assert.Equal(HttpStatusCode.NotFound, (await SendAsync(client, HttpMethod.Get, "/consent/acceptance")).StatusCode);

        await AcceptTermsAsync(client);
        var acceptance = await ReadJsonAsync(await SendAsync(client, HttpMethod.Get, "/consent/acceptance"));
        Assert.True(acceptance.GetProperty("isCurrent").GetBoolean());
        Assert.Equal(HttpStatusCode.Created, (await SendAsync(client, HttpMethod.Post, "/connections", new { name = "Sales", connectionString = Target.ConnectionString })).StatusCode);
        AssertNoSecretLeaked();
    }

    [Fact]
    public async Task Owner_can_create_list_test_update_and_delete_without_the_secret_leaking()
    {
        var client = factory.ClientFor(Guid.NewGuid());
        await AcceptTermsAsync(client);

        var created = await ReadJsonAsync(await SendAsync(client, HttpMethod.Post, "/connections", new { name = "  Sales DB  ", connectionString = Target.ConnectionString }), HttpStatusCode.Created);
        var id = created.GetProperty("id").GetGuid();
        Assert.Equal("Sales DB", created.GetProperty("name").GetString());
        Assert.Equal(Target.DataSource, created.GetProperty("server").GetString());
        Assert.Equal(Target.InitialCatalog, created.GetProperty("database").GetString());
        Assert.Equal("granted", created.GetProperty("consent").GetString());
        Assert.False(created.TryGetProperty("connectionString", out _));

        var list = await ReadJsonAsync(await SendAsync(client, HttpMethod.Get, "/connections"));
        Assert.Contains(list.EnumerateArray(), c => c.GetProperty("id").GetGuid() == id);

        var tested = await ReadJsonAsync(await SendAsync(client, HttpMethod.Post, $"/connections/{id}/test"));
        Assert.False(string.IsNullOrEmpty(tested.GetProperty("serverVersion").GetString()));

        var renamed = await ReadJsonAsync(await SendAsync(client, HttpMethod.Put, $"/connections/{id}", new { name = "Renamed" }));
        Assert.Equal("Renamed", renamed.GetProperty("name").GetString());

        await AssertStoredEncryptedAsync(id);

        Assert.Equal(HttpStatusCode.NoContent, (await SendAsync(client, HttpMethod.Delete, $"/connections/{id}")).StatusCode);
        Assert.Equal(HttpStatusCode.NotFound, (await SendAsync(client, HttpMethod.Get, $"/connections/{id}")).StatusCode);
        AssertNoSecretLeaked();
    }

    [Fact]
    public async Task Another_user_cannot_see_or_use_a_connection_through_any_operation()
    {
        var owner = factory.ClientFor(Guid.NewGuid());
        var other = factory.ClientFor(Guid.NewGuid());
        await AcceptTermsAsync(owner);
        await AcceptTermsAsync(other);
        var id = await CreateAsync(owner);

        var list = await ReadJsonAsync(await SendAsync(other, HttpMethod.Get, "/connections"));
        Assert.DoesNotContain(list.EnumerateArray(), c => c.GetProperty("id").GetGuid() == id);
        foreach (var (method, path, body) in OwnedOperations(id))
        {
            var response = await SendAsync(other, method, path, body);
            await AssertProblemAsync(response, HttpStatusCode.NotFound, "not-found");
        }

        // The owner still has the untouched connection.
        var mine = await ReadJsonAsync(await SendAsync(owner, HttpMethod.Get, $"/connections/{id}"));
        Assert.Equal("granted", mine.GetProperty("consent").GetString());
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(owner, HttpMethod.Post, $"/connections/{id}/test")).StatusCode);
        AssertNoSecretLeaked();
    }

    [Fact]
    public async Task Withdrawn_consent_blocks_use_until_it_is_granted_again()
    {
        var client = factory.ClientFor(Guid.NewGuid());
        await AcceptTermsAsync(client);
        var id = await CreateAsync(client);

        Assert.Equal(HttpStatusCode.NoContent, (await SendAsync(client, HttpMethod.Delete, $"/connections/{id}/consent")).StatusCode);

        var shown = await ReadJsonAsync(await SendAsync(client, HttpMethod.Get, $"/connections/{id}"));
        Assert.Equal("withdrawn", shown.GetProperty("consent").GetString());
        await AssertProblemAsync(await SendAsync(client, HttpMethod.Post, $"/connections/{id}/test"), HttpStatusCode.Forbidden, "consent-withdrawn");
        await AssertProblemAsync(await SendAsync(client, HttpMethod.Put, $"/connections/{id}", new { name = "x", connectionString = Target.ConnectionString }), HttpStatusCode.Forbidden, "consent-withdrawn");

        var granted = await ReadJsonAsync(await SendAsync(client, HttpMethod.Put, $"/connections/{id}/consent"));
        Assert.Equal("granted", granted.GetProperty("consent").GetString());
        Assert.Equal(HttpStatusCode.OK, (await SendAsync(client, HttpMethod.Post, $"/connections/{id}/test")).StatusCode);
        AssertNoSecretLeaked();
    }

    [Fact]
    public async Task A_failed_connection_test_returns_a_useful_non_secret_error()
    {
        var client = factory.ClientFor(Guid.NewGuid());
        await AcceptTermsAsync(client);
        var wrongPassword = new SqlConnectionStringBuilder(Target.ConnectionString) { Password = "Wrong-Pa55word-" + Guid.NewGuid().ToString("N")[..8] };
        var id = await CreateAsync(client, wrongPassword.ConnectionString);

        var response = await SendAsync(client, HttpMethod.Post, $"/connections/{id}/test");

        var problem = await AssertProblemAsync(response, (HttpStatusCode)422, "connection-failed");
        Assert.Equal("Login failed: check the user name and password.", problem.GetProperty("detail").GetString());
        AssertNoSecretLeaked(wrongPassword.Password);
    }

    [Fact]
    public async Task Invalid_input_is_rejected_without_echoing_the_connection_string()
    {
        var client = factory.ClientFor(Guid.NewGuid());
        await AcceptTermsAsync(client);
        const string garbage = "this is not valid Password=Leak-Me-123";

        var invalid = await SendAsync(client, HttpMethod.Post, "/connections", new { name = "x", connectionString = garbage });
        var noName = await SendAsync(client, HttpMethod.Post, "/connections", new { name = " ", connectionString = Target.ConnectionString });

        await AssertProblemAsync(invalid, HttpStatusCode.BadRequest, "invalid-request");
        await AssertProblemAsync(noName, HttpStatusCode.BadRequest, "invalid-request");
        AssertNoSecretLeaked("Leak-Me-123");
    }

    private static IEnumerable<(HttpMethod Method, string Path, object? Body)> OwnedOperations(Guid id) =>
    [
        (HttpMethod.Get, $"/connections/{id}", null),
        (HttpMethod.Put, $"/connections/{id}", new { name = "taken" }),
        (HttpMethod.Post, $"/connections/{id}/test", null),
        (HttpMethod.Put, $"/connections/{id}/consent", null),
        (HttpMethod.Delete, $"/connections/{id}/consent", null),
        (HttpMethod.Delete, $"/connections/{id}", null),
    ];

    private async Task AcceptTermsAsync(HttpClient client) =>
        await ReadJsonAsync(await SendAsync(client, HttpMethod.Post, "/consent/acceptance", new { termsVersion = EmbeddedConsentTermsProvider.CurrentVersion }), HttpStatusCode.Created);

    private async Task<Guid> CreateAsync(HttpClient client, string? connectionString = null)
    {
        var created = await ReadJsonAsync(
            await SendAsync(client, HttpMethod.Post, "/connections", new { name = "Sales", connectionString = connectionString ?? Target.ConnectionString }),
            HttpStatusCode.Created);
        return created.GetProperty("id").GetGuid();
    }

    private async Task<HttpResponseMessage> SendAsync(HttpClient client, HttpMethod method, string path, object? body = null)
    {
        using var request = new HttpRequestMessage(method, path) { Content = body is null ? null : JsonContent.Create(body) };
        var response = await client.SendAsync(request, Ct);
        _responses.Add(await response.Content.ReadAsStringAsync(Ct));
        return response;
    }

    private static async Task<JsonElement> ReadJsonAsync(HttpResponseMessage response, HttpStatusCode expected = HttpStatusCode.OK)
    {
        var text = await response.Content.ReadAsStringAsync(Ct);
        Assert.True(response.StatusCode == expected, $"Expected {expected}, got {(int)response.StatusCode}: {text}");
        return JsonDocument.Parse(text).RootElement.Clone();
    }

    private static async Task<JsonElement> AssertProblemAsync(HttpResponseMessage response, HttpStatusCode status, string name)
    {
        var problem = await ReadJsonAsync(response, status);
        Assert.Equal("application/problem+json", response.Content.Headers.ContentType?.MediaType);
        Assert.Equal($"urn:esi:problem:{name}", problem.GetProperty("type").GetString());
        return problem;
    }

    private async Task AssertStoredEncryptedAsync(Guid id)
    {
        using var scope = factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var row = await db.Connections.AsNoTracking().SingleAsync(c => c.Id == id, Ct);

        Assert.Equal(1, row.Secret.KeyVersion);
        Assert.Equal(60, row.Secret.WrappedDataKey.Length);
        Assert.DoesNotContain(Target.Password, Encoding.UTF8.GetString(row.Secret.Ciphertext), StringComparison.Ordinal);
    }

    private void AssertNoSecretLeaked(params string[] extraSecrets)
    {
        var secrets = extraSecrets.Append(Target.Password).Append(Target.ConnectionString).ToArray();
        foreach (var text in _responses.Concat(factory.Logs))
        {
            foreach (var secret in secrets)
            {
                Assert.DoesNotContain(secret, text, StringComparison.Ordinal);
            }
        }
    }

    public sealed class Factory : CoreApiFactory;
}
