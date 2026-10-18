using Microsoft.Data.SqlClient;

namespace Esi.Core.IntegrationTests;

/// <summary>The stand-in for a user's target database that later SQL execution tests (ESI-16) run against.</summary>
public class TargetDatabaseTests
{
    [Fact]
    public async Task Target_database_accepts_a_read_only_query()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        await using var connection = new SqlConnection(TestDatabases.TargetDb);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand("SELECT CAST(SERVERPROPERTY('ProductMajorVersion') AS int)", connection);

        var majorVersion = (int)(await command.ExecuteScalarAsync(cancellationToken))!;

        Assert.True(majorVersion >= 16, $"Expected SQL Server 2022 or newer, got major version {majorVersion}.");
    }
}
