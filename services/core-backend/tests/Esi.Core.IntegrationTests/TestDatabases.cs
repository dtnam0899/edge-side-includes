namespace Esi.Core.IntegrationTests;

/// <summary>Connection strings from compose (`integration-tests` service); tests fail rather than skip without them.</summary>
internal static class TestDatabases
{
    public static string AppDb => Require("ESI_CORE_TEST_APPDB");

    public static string TargetDb => Require("ESI_CORE_TEST_TARGETDB");

    private static string Require(string name) =>
        Environment.GetEnvironmentVariable(name) is { Length: > 0 } value
            ? value
            : throw new InvalidOperationException($"{name} is not set; run `docker compose --profile integration run --rm integration-tests`.");
}
