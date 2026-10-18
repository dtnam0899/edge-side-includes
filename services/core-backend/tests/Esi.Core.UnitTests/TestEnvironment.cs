namespace Esi.Core.UnitTests;

/// <summary>Required settings for starting the API in tests: local admin mode and a throwaway master key.</summary>
internal static class TestEnvironment
{
    public const string MasterKey = "dGVzdC1vbmx5LW1hc3Rlci1rZXktMzItYnl0ZXMhISE="; // "test-only-master-key-32-bytes!!!"

    public static void Apply(string appDbConnectionString)
    {
        Environment.SetEnvironmentVariable("ESI_CORE_AppDb__ConnectionString", appDbConnectionString);
        Environment.SetEnvironmentVariable("ESI_CORE_Auth__Mode", "LocalAdmin");
        Environment.SetEnvironmentVariable("ESI_CORE_Encryption__ActiveKeyVersion", "1");
        Environment.SetEnvironmentVariable("ESI_CORE_Encryption__MasterKeys__1", MasterKey);
    }
}
