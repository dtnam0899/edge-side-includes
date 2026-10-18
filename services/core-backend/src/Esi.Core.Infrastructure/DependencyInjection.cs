using Esi.Core.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Esi.Core.Infrastructure;

public static class DependencyInjection
{
    /// <summary>Configuration key for the app database; set through <see cref="ConnectionStringVariable"/>.</summary>
    public const string ConnectionStringKey = "AppDb:ConnectionString";

    public const string ConnectionStringVariable = "ESI_CORE_AppDb__ConnectionString";

    public const string ReadyTag = "ready";

    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration[ConnectionStringKey];
        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException($"{ConnectionStringVariable} is not set.");
        }

        services.AddDbContext<AppDbContext>(options => ConfigureSqlServer(options, connectionString));
        services.AddHealthChecks().AddDbContextCheck<AppDbContext>("appdb", tags: [ReadyTag]);
        return services;
    }

    internal static void ConfigureSqlServer(DbContextOptionsBuilder options, string connectionString) =>
        options.UseSqlServer(connectionString, sql => sql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName));
}
