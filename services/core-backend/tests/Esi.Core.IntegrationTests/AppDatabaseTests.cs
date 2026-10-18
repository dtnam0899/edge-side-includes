using System.Net;
using Esi.Core.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace Esi.Core.IntegrationTests;

public class AppDatabaseTests : IClassFixture<AppDatabaseTests.Factory>
{
    private readonly Factory _factory;

    public AppDatabaseTests(Factory factory) => _factory = factory;

    [Fact]
    public async Task All_migrations_are_applied()
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var cancellationToken = TestContext.Current.CancellationToken;

        Assert.NotEmpty(await db.Database.GetAppliedMigrationsAsync(cancellationToken));
        Assert.Empty(await db.Database.GetPendingMigrationsAsync(cancellationToken));
    }

    [Fact]
    public async Task Readiness_returns_200_when_the_app_database_is_reachable()
    {
        using var client = _factory.CreateClient();

        using var response = await client.GetAsync("/health/ready", TestContext.Current.CancellationToken);

        Assert.Equal(HttpStatusCode.OK, response.StatusCode);
    }

    public sealed class Factory : CoreApiFactory;
}
