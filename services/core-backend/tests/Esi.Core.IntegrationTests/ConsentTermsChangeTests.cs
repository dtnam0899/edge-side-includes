using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Esi.Core.Application.Consent;
using Microsoft.Data.SqlClient;

namespace Esi.Core.IntegrationTests;

/// <summary>SR-1: when the terms version changes, connections cannot be used until the user accepts again.</summary>
public class ConsentTermsChangeTests(ConsentTermsChangeTests.Factory factory) : IClassFixture<ConsentTermsChangeTests.Factory>
{
    [Fact]
    public async Task New_terms_must_be_accepted_before_a_connection_is_used_again()
    {
        var ct = TestContext.Current.CancellationToken;
        var client = factory.ClientFor(Guid.NewGuid());
        var v1 = factory.Terms.Current;
        (await client.PostAsJsonAsync("/consent/acceptance", new { termsVersion = v1.Version }, ct)).EnsureSuccessStatusCode();
        var created = await client.PostAsJsonAsync("/connections", new { name = "Sales", connectionString = new SqlConnectionStringBuilder(TestDatabases.TargetDb).ConnectionString }, ct);
        var id = JsonDocument.Parse(await created.Content.ReadAsStringAsync(ct)).RootElement.GetProperty("id").GetGuid();

        factory.Terms.Current = v1 with { Version = "2099-01-01.1" };

        var blocked = await client.PostAsync($"/connections/{id}/test", null, ct);
        var acceptance = JsonDocument.Parse(await client.GetStringAsync("/consent/acceptance", ct)).RootElement;
        Assert.Equal(HttpStatusCode.Forbidden, blocked.StatusCode);
        Assert.Contains("consent-required", await blocked.Content.ReadAsStringAsync(ct), StringComparison.Ordinal);
        Assert.False(acceptance.GetProperty("isCurrent").GetBoolean());

        (await client.PostAsJsonAsync("/consent/acceptance", new { termsVersion = "2099-01-01.1" }, ct)).EnsureSuccessStatusCode();
        Assert.Equal(HttpStatusCode.OK, (await client.PostAsync($"/connections/{id}/test", null, ct)).StatusCode);
    }

    public sealed class Factory : CoreApiFactory;
}
