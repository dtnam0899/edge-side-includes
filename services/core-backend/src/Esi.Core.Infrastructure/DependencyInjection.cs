using Esi.Core.Application.Agents;
using Esi.Core.Application.Artifacts;
using Esi.Core.Application.Chat;
using Esi.Core.Application.Connections;
using Esi.Core.Application.Consent;
using Esi.Core.Application.Queries;
using Esi.Core.Application.Security;
using Esi.Core.Application.Users;
using Esi.Core.Application.Visualizations;
using Esi.Core.Infrastructure.Agents.Contracts;
using Esi.Core.Infrastructure.Agents;
using Esi.Core.Infrastructure.Connections;
using Esi.Core.Infrastructure.Dsl;
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

        services.AddDbContext<AppDbContext>(options => ConfigureNpgsql(options, connectionString));
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
        services.AddScoped<IChatRepository, ChatRepository>();
        services.AddScoped<IArtifactRepository, ArtifactRepository>();
        services.AddSingleton<IDslValidator, DslValidator>();
        services.AddSingleton(new VisualizationOptions(
            int.TryParse(configuration["Visualization:MaxRetries"], out var retries) && retries >= 0 ? retries : 2));

        // services/ai-agents (agents-api contract). Missing base URL: chat and visualizations answer agents-unavailable.
        var agentsUrl = Uri.TryCreate(configuration["Agents:BaseUrl"], UriKind.Absolute, out var url) ? url : null;
        var agentsOptions = new AgentsOptions(agentsUrl, int.TryParse(configuration["Agents:TimeoutSeconds"], out var t) && t > 0 ? t : 120);
        services.AddSingleton(agentsOptions);
        services.AddHttpClient<IAgentsApiClient, AgentsApiClient>(http =>
        {
            http.BaseAddress = agentsOptions.BaseUrl ?? new Uri("http://agents.invalid/");
            http.Timeout = Timeout.InfiniteTimeSpan; // HttpAgentsClient applies the configured timeout
        });
        services.AddScoped<IAgentsClient, HttpAgentsClient>();
        services.AddScoped<IConsentAcceptanceRepository, ConsentAcceptanceRepository>();
        services.AddScoped<IUserRepository, UserRepository>();
        return services;
    }

    // The app database is PostgreSQL (ADR-0008); users' target databases are SQL Server through SqlClient.
    internal static void ConfigureNpgsql(DbContextOptionsBuilder options, string connectionString) =>
        options.UseNpgsql(connectionString, sql => sql.MigrationsAssembly(typeof(AppDbContext).Assembly.FullName));
}
