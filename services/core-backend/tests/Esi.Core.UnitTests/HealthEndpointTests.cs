using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Hosting;

namespace Esi.Core.UnitTests;

public class HealthEndpointTests : IClassFixture<HealthEndpointTests.Factory>
{
    private readonly Factory _factory;

    public HealthEndpointTests(Factory factory) => _factory = factory;

    [Fact]
    public async Task Liveness_returns_200_without_touching_the_database()
    {
        using var client = _factory.CreateClient();

        using var response = await client.GetAsync("/health", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    public sealed class Factory : WebApplicationFactory<Program>
    {
        // The app database is never opened by the liveness check.
        protected override IHost CreateHost(IHostBuilder builder) =>
            TestEnvironment.CreateHost(TestEnvironment.LocalAdmin("Host=unused;Database=esi_core"), () => base.CreateHost(builder));
    }
}
