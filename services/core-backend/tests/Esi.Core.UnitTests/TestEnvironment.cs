using Microsoft.Extensions.Hosting;

namespace Esi.Core.UnitTests;

/// <summary>
/// Required settings for starting the API in tests (local admin mode, a throwaway master key) and a process-wide
/// lock around building a host: the API reads <c>ESI_CORE_*</c> environment variables while it builds, and test
/// classes build hosts in parallel with different settings.
/// </summary>
internal static class TestEnvironment
{
    public const string MasterKey = "dGVzdC1vbmx5LW1hc3Rlci1rZXktMzItYnl0ZXMhISE="; // "test-only-master-key-32-bytes!!!"

    private static readonly Lock Gate = new();

    public static Dictionary<string, string?> LocalAdmin(string appDbConnectionString) => new()
    {
        ["AppDb__ConnectionString"] = appDbConnectionString,
        ["Auth__Mode"] = "LocalAdmin",
        ["Auth__Authority"] = null,
        ["Auth__Audience"] = null,
        ["Encryption__ActiveKeyVersion"] = "1",
        ["Encryption__MasterKeys__1"] = MasterKey,
    };

    /// <summary>Sets each <c>ESI_CORE_&lt;key&gt;</c> variable (null removes it), then builds the host, under the lock.</summary>
    public static IHost CreateHost(IReadOnlyDictionary<string, string?> settings, Func<IHost> build)
    {
        lock (Gate)
        {
            foreach (var (key, value) in settings)
            {
                Environment.SetEnvironmentVariable("ESI_CORE_" + key, value);
            }

            return build();
        }
    }
}
