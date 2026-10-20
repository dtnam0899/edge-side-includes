using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace Esi.Core.Testing;

/// <summary>
/// Locally signed access tokens standing in for the identity provider (Auth0, ADR-0006) in Oidc-mode tests.
/// Shared by the unit and integration test projects (linked file).
/// </summary>
public static class TestTokens
{
    public const string Issuer = "https://issuer.esi.test/";
    public const string Audience = "https://api.esi.test";

    public static readonly SecurityKey SigningKey = new RsaSecurityKey(RSA.Create(2048)) { KeyId = "test-key" };

    /// <summary>Same key id as <see cref="SigningKey"/>, different key: a forged signature.</summary>
    public static readonly SecurityKey ForeignKey = new RsaSecurityKey(RSA.Create(2048)) { KeyId = "test-key" };

    /// <summary><c>ESI_CORE_Auth__*</c> settings for Oidc mode against the test issuer.</summary>
    public static Dictionary<string, string?> OidcSettings => new()
    {
        ["Auth__Mode"] = "Oidc",
        ["Auth__Authority"] = Issuer,
        ["Auth__Audience"] = Audience,
    };

    /// <summary>Gives the API the issuer's metadata (what it would read from the discovery document) without HTTP.</summary>
    public static IServiceCollection UseTestIssuer(this IServiceCollection services) =>
        services.Configure<JwtBearerOptions>(JwtBearerDefaults.AuthenticationScheme, options =>
        {
            options.Configuration = new OpenIdConnectConfiguration { Issuer = Issuer };
            options.Configuration.SigningKeys.Add(SigningKey);
        });

    public static string Create(
        string subject,
        string issuer = Issuer,
        string audience = Audience,
        DateTime? expires = null,
        SecurityKey? key = null,
        string algorithm = SecurityAlgorithms.RsaSha256)
    {
        var expiresAt = expires ?? DateTime.UtcNow.AddHours(1);
        return new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = issuer,
            Audience = audience,
            Subject = new ClaimsIdentity([new Claim("sub", subject)]),
            IssuedAt = expiresAt.AddHours(-1),
            NotBefore = expiresAt.AddHours(-1),
            Expires = expiresAt,
            SigningCredentials = new SigningCredentials(key ?? SigningKey, algorithm),
        });
    }
}
