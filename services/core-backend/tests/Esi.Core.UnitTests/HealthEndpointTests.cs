using System.Net;
using Microsoft.AspNetCore.Mvc.Testing;

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
        public Factory() => TestEnvironment.Apply("Server=unused;Database=esi_core"); // never opened by the liveness check
    }
}
