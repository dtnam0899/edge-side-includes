using Esi.Core.Application.Connections;
using Esi.Core.Application.Consent;
using Esi.Core.Application.Queries;
using Esi.Core.Application.Schema;
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
        return services;
    }
}
