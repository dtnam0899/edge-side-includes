using Esi.Core.Application.Abstractions;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;

namespace Esi.Core.Api.Auth;

/// <summary>
/// Authentication modes (ADR-0006), chosen by <c>ESI_CORE_Auth__Mode</c>; any other value refuses to start.
/// <c>Oidc</c>: JWT bearer tokens from <c>ESI_CORE_Auth__Authority</c> for <c>ESI_CORE_Auth__Audience</c>, every
/// endpoint except the health checks requires one. <c>LocalAdmin</c>: one assumed local admin, Development only.
/// </summary>
public static class AuthExtensions
{
    public const string OidcMode = "Oidc";

    public static IServiceCollection AddCurrentUser(this IServiceCollection services, IConfiguration configuration, IHostEnvironment environment)
    {
        var mode = configuration["Auth:Mode"];
        if (string.Equals(mode, OidcMode, StringComparison.Ordinal))
        {
            return services.AddOidc(configuration);
        }

        if (!string.Equals(mode, LocalAdminCurrentUser.Mode, StringComparison.Ordinal))
        {
            throw new InvalidOperationException(
                $"Set ESI_CORE_Auth__Mode to {OidcMode} (with ESI_CORE_Auth__Authority and ESI_CORE_Auth__Audience), or to {LocalAdminCurrentUser.Mode} for local development.");
        }

        if (!environment.IsDevelopment())
        {
            throw new InvalidOperationException(
                $"ESI_CORE_Auth__Mode={LocalAdminCurrentUser.Mode} is allowed only with ASPNETCORE_ENVIRONMENT=Development (current: {environment.EnvironmentName}). Use {OidcMode} in a deployment.");
        }

        var userId = Guid.TryParse(configuration["Auth:LocalUserId"], out var configured) ? configured : LocalAdminCurrentUser.DefaultUserId;
        services.AddSingleton<ICurrentUser>(new LocalAdminCurrentUser(userId));
        return services;
    }

    /// <summary>Authentication, authorization and user mapping; no-op in <c>LocalAdmin</c> mode.</summary>
    public static WebApplication UseCurrentUser(this WebApplication app)
    {
        if (string.Equals(app.Configuration["Auth:Mode"], OidcMode, StringComparison.Ordinal))
        {
            app.UseAuthentication();
            app.UseAuthorization();
            app.UseMiddleware<OidcUserMappingMiddleware>();
        }

        return app;
    }

    private static IServiceCollection AddOidc(this IServiceCollection services, IConfiguration configuration)
    {
        var authority = configuration["Auth:Authority"];
        var audience = configuration["Auth:Audience"];
        if (!Uri.TryCreate(authority, UriKind.Absolute, out _) || string.IsNullOrWhiteSpace(audience))
        {
            throw new InvalidOperationException(
                $"ESI_CORE_Auth__Mode={OidcMode} needs ESI_CORE_Auth__Authority (absolute URL of the issuer, e.g. https://<tenant>.auth0.com/) and ESI_CORE_Auth__Audience.");
        }

        services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                // Issuer, signing keys and lifetime come from the authority's discovery document.
                options.Authority = authority;
                options.Audience = audience;
                options.MapInboundClaims = false; // keep "sub" and "iss" as issued
                options.TokenValidationParameters.ValidAlgorithms = ["RS256"];
                options.Events = new JwtBearerEvents { OnChallenge = UnauthenticatedProblem.WriteAsync };
            });
        services.AddAuthorization(options =>
            options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());
        services.AddScoped<OidcCurrentUser>();
        services.AddScoped<ICurrentUser>(sp => sp.GetRequiredService<OidcCurrentUser>());
        return services;
    }
}
