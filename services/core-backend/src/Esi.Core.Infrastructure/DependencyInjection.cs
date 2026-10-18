using Esi.Core.Application.Connections;
using Esi.Core.Application.Consent;
using Esi.Core.Application.Queries;
using Esi.Core.Application.Security;
using Esi.Core.Infrastructure.Connections;
using Esi.Core.Infrastructure.Persistence.Repositories;
using Esi.Core.Infrastructure.Persistence;
using Esi.Core.Infrastructure.Queries;
using Esi.Core.Infrastructure.Security;
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

        // Fails at startup when the master keys are missing or invalid (ADR-0003).
        services.AddSingleton(MasterKeyRing.FromConfiguration(configuration));
        services.AddSingleton<ISecretProtector, AesGcmSecretProtector>();
        services.AddSingleton<IConnectionStringInspector, SqlConnectionStringInspector>();
        services.AddSingleton<IConnectionProbe, SqlConnectionProbe>();
        services.AddSingleton(new ExecutionOptions(
            int.TryParse(configuration["Execution:CommandTimeoutSeconds"], out var timeout) && timeout > 0 ? timeout : 30));
        services.AddSingleton<ISqlStatementValidator, SelectStatementValidator>();
        services.AddSingleton<ITargetDatabase, SqlTargetDatabase>();
        services.AddScoped<IConnectionRepository, ConnectionRepository>();
        services.AddScoped<IConsentAcceptanceRepository, ConsentAcceptanceRepository>();
        return services;
    }

    internal static void ConfigureSqlServer(DbContextOptionsBuilder options, string connectionString) =>
        options.UseSqlServer(connectionString, sql => sql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName));
}
