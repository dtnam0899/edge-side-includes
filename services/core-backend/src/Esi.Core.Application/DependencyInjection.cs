using Esi.Core.Application.Artifacts;
using Esi.Core.Application.Chat;
using Esi.Core.Application.Connections;
using Esi.Core.Application.Consent;
using Esi.Core.Application.Dashboards;
using Esi.Core.Application.Queries;
using Esi.Core.Application.Schema;
using Esi.Core.Application.Scripts;
using Esi.Core.Application.Visualizations;
using Microsoft.Extensions.DependencyInjection;

namespace Esi.Core.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddApplication(this IServiceCollection services)
    {
        services.AddSingleton(TimeProvider.System);
        services.AddSingleton<IConsentTermsProvider, EmbeddedConsentTermsProvider>();
        services.AddScoped<ConsentService>();
        services.AddScoped<ConnectionAccess>();
        services.AddScoped<ConnectionService>();
        services.AddScoped<SchemaService>();
        services.AddScoped<QueryService>();
        services.AddScoped<ChatService>();
        services.AddScoped<ScriptService>();
        services.AddScoped<VisualizationService>();
        services.AddScoped<ArtifactService>();
        services.AddScoped<DashboardService>();
        return services;
    }
}
