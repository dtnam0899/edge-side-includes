using Esi.Core.Application.Abstractions;

namespace Esi.Core.Api.Auth;

public static class AuthExtensions
{
    public static IServiceCollection AddCurrentUser(this IServiceCollection services, IConfiguration configuration)
    {
        var mode = configuration["Auth:Mode"];
        if (!string.Equals(mode, LocalAdminCurrentUser.Mode, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                "No authentication is implemented yet. Set ESI_CORE_Auth__Mode=LocalAdmin for local use only; it must not reach production.");
        }

        var userId = Guid.TryParse(configuration["Auth:LocalUserId"], out var configured) ? configured : LocalAdminCurrentUser.DefaultUserId;
        services.AddSingleton<ICurrentUser>(new LocalAdminCurrentUser(userId));
        return services;
    }
}
