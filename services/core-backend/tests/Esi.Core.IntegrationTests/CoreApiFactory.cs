using System.Collections.Concurrent;
using Esi.Core.Application.Abstractions;
using Esi.Core.Application.Consent;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace Esi.Core.IntegrationTests;

/// <summary>
/// API host against the compose app database. Test-only additions: the current user comes from the
/// <c>X-Test-User</c> header (so isolation between users can be tested), every log entry is captured unredacted,
/// and the consent terms version can be changed.
/// </summary>
public class CoreApiFactory : WebApplicationFactory<Program>
{
    public const string UserHeader = "X-Test-User";
    public const string MasterKey = "dGVzdC1vbmx5LW1hc3Rlci1rZXktMzItYnl0ZXMhISE="; // "test-only-master-key-32-bytes!!!"

    public CoreApiFactory()
    {
        Environment.SetEnvironmentVariable("ESI_CORE_AppDb__ConnectionString", TestDatabases.AppDb);
        Environment.SetEnvironmentVariable("ESI_CORE_Auth__Mode", "LocalAdmin");
        Environment.SetEnvironmentVariable("ESI_CORE_Encryption__ActiveKeyVersion", "1");
        Environment.SetEnvironmentVariable("ESI_CORE_Encryption__MasterKeys__1", MasterKey);
    }

    public ConcurrentQueue<string> Logs { get; } = new();

    public TestTermsProvider Terms { get; } = new();

    public FakeAgents Agents { get; } = new();

    public HttpClient ClientFor(Guid userId)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Add(UserHeader, userId.ToString());
        return client;
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder) =>
        builder.ConfigureTestServices(services =>
        {
            services.AddHttpContextAccessor();
            services.AddScoped<ICurrentUser, HeaderCurrentUser>();
            services.AddSingleton<IConsentTermsProvider>(Terms);
            services.AddSingleton<ILoggerProvider>(new CapturingLoggerProvider(Logs));
            services.AddSingleton<Esi.Core.Application.Agents.IAgentsClient>(Agents);
        });

    private sealed class HeaderCurrentUser(IHttpContextAccessor accessor) : ICurrentUser
    {
        public Guid UserId { get; } = Guid.Parse(accessor.HttpContext!.Request.Headers[UserHeader].ToString());
    }

    public sealed class TestTermsProvider : IConsentTermsProvider
    {
        public ConsentTerms Current { get; set; } = new(EmbeddedConsentTermsProvider.CurrentVersion, "terms", ConsentTermsStatus.Draft, DateTimeOffset.UnixEpoch);
    }

    private sealed class CapturingLoggerProvider(ConcurrentQueue<string> sink) : ILoggerProvider
    {
        public ILogger CreateLogger(string categoryName) => new CapturingLogger(sink);

        public void Dispose()
        {
        }

        private sealed class CapturingLogger(ConcurrentQueue<string> sink) : ILogger
        {
            public IDisposable? BeginScope<TState>(TState state)
                where TState : notnull => null;

            public bool IsEnabled(LogLevel logLevel) => true;

            public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            {
                sink.Enqueue(formatter(state, exception));
                if (state is IEnumerable<KeyValuePair<string, object?>> values)
                {
                    foreach (var (_, value) in values)
                    {
                        sink.Enqueue(Convert.ToString(value, System.Globalization.CultureInfo.InvariantCulture) ?? string.Empty);
                    }
                }

                if (exception is not null)
                {
                    sink.Enqueue(exception.ToString());
                }
            }
        }
    }
}
