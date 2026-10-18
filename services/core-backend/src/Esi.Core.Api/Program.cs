using Esi.Core.Api.Logging;
using Esi.Core.Infrastructure;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.Extensions.Configuration.Json;
using Microsoft.Extensions.Logging.Console;

// Container HEALTHCHECK: the runtime image has no curl, so the app probes itself.
if (args is ["healthcheck"])
{
    var port = Environment.GetEnvironmentVariable("ASPNETCORE_HTTP_PORTS")?.Split(';')[0] ?? "8080";
    using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(2) };
    try
    {
        using var response = await http.GetAsync($"http://127.0.0.1:{port}/health");
        return response.IsSuccessStatusCode ? 0 : 1;
    }
    catch (Exception)
    {
        return 1;
    }
}

var builder = WebApplication.CreateBuilder(args);

// Configuration comes only from environment variables (ESI_CORE_*, plus the standard ASPNETCORE_*/DOTNET_*)
// and, in Development, user-secrets (also a JSON source, so only appsettings files are removed).
foreach (var json in builder.Configuration.Sources.OfType<JsonConfigurationSource>()
             .Where(source => source.Path?.StartsWith("appsettings", StringComparison.OrdinalIgnoreCase) == true).ToList())
{
    builder.Configuration.Sources.Remove(json);
}

builder.Configuration.AddEnvironmentVariables("ESI_CORE_");

builder.Logging.ClearProviders();
builder.Logging.AddConsole(options => options.FormatterName = RedactingJsonConsoleFormatter.Name);
builder.Logging.AddConsoleFormatter<RedactingJsonConsoleFormatter, JsonConsoleFormatterOptions>();

builder.Services.AddInfrastructure(builder.Configuration);

var app = builder.Build();

// Liveness: the process serves HTTP. Readiness: dependencies (app database) are reachable.
app.MapHealthChecks("/health", new HealthCheckOptions { Predicate = _ => false });
app.MapHealthChecks("/health/ready", new HealthCheckOptions { Predicate = check => check.Tags.Contains(DependencyInjection.ReadyTag) });

await app.RunAsync();
return 0;
