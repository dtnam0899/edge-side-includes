using Esi.Core.Testing;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.Hosting;

namespace Esi.Core.UnitTests;

/// <summary>ADR-0006: the API refuses to start with LocalAdmin outside Development or with an incomplete Oidc setup.</summary>
public class AuthStartupTests
{
    [Theory]
    [InlineData("Production")]
    [InlineData("Staging")]
    public void LocalAdmin_outside_Development_fails_to_start(string environment)
    {
        using var factory = new Factory(environment, TestEnvironment.LocalAdmin("Host=unused;Database=esi_core"));

        var error = StartupError(factory);

        Assert.Contains("ASPNETCORE_ENVIRONMENT=Development", error, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(null, TestTokens.Audience)]
    [InlineData("issuer.esi.test", TestTokens.Audience)]
    [InlineData(TestTokens.Issuer, null)]
    public void Oidc_without_authority_or_audience_fails_to_start(string? authority, string? audience)
    {
        var settings = TestEnvironment.LocalAdmin("Host=unused;Database=esi_core");
        settings["Auth__Mode"] = "Oidc";
        settings["Auth__Authority"] = authority;
        settings["Auth__Audience"] = audience;
        using var factory = new Factory("Production", settings);

        var error = StartupError(factory);

        Assert.Contains("ESI_CORE_Auth__Authority", error, StringComparison.Ordinal);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("None")]
    public void Missing_or_unknown_mode_fails_to_start(string? mode)
    {
        var settings = TestEnvironment.LocalAdmin("Host=unused;Database=esi_core");
        settings["Auth__Mode"] = mode;
        using var factory = new Factory("Development", settings);

        var error = StartupError(factory);

        Assert.Contains("ESI_CORE_Auth__Mode", error, StringComparison.Ordinal);
    }

    [Fact]
    public void Oidc_starts_outside_Development()
    {
        var settings = TestEnvironment.LocalAdmin("Host=unused;Database=esi_core");
        foreach (var (key, value) in TestTokens.OidcSettings)
        {
            settings[key] = value;
        }

        using var factory = new Factory("Production", settings);

        Assert.NotNull(factory.Services);
    }

    /// <summary>All exception messages from starting the host (the startup error may arrive wrapped).</summary>
    private static string StartupError(Factory factory)
    {
        var error = Assert.ThrowsAny<Exception>(() => factory.Services);
        var messages = new List<string>();
        for (var e = error; e is not null; e = e.InnerException)
        {
            messages.Add(e.Message);
        }

        return string.Join(" | ", messages);
    }

    private sealed class Factory(string environment, IReadOnlyDictionary<string, string?> settings) : WebApplicationFactory<Program>
    {
        protected override IHost CreateHost(IHostBuilder builder) =>
            TestEnvironment.CreateHost(settings, () => base.CreateHost(builder));

        protected override void ConfigureWebHost(IWebHostBuilder builder) => builder.UseEnvironment(environment);
    }
}
