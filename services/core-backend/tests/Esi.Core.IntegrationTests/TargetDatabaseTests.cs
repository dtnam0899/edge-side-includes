using Microsoft.Data.SqlClient;

namespace Esi.Core.IntegrationTests;

/// <summary>
/// The stand-in for a user's target database that later SQL execution tests (ESI-16) run against.
/// It is a separate database (esi_target) from the application's own database.
/// </summary>
public class TargetDatabaseTests
{
    private const string TargetDatabase = "esi_target";

    [Fact]
    public async Task Target_database_is_separate_from_the_app_database_and_accepts_a_query()
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        await using (var server = new SqlConnection(TestDatabases.TargetDb))
        {
            await server.OpenAsync(cancellationToken);
            await using var create = new SqlCommand($"IF DB_ID(N'{TargetDatabase}') IS NULL CREATE DATABASE [{TargetDatabase}]", server);
            await create.ExecuteNonQueryAsync(cancellationToken);
        }

        var target = new SqlConnectionStringBuilder(TestDatabases.TargetDb) { InitialCatalog = TargetDatabase };
        Assert.NotEqual(new SqlConnectionStringBuilder(TestDatabases.AppDb).InitialCatalog, target.InitialCatalog);

        await using var connection = new SqlConnection(target.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand("SELECT DB_NAME(), CAST(SERVERPROPERTY('ProductMajorVersion') AS int)", connection);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        Assert.True(await reader.ReadAsync(cancellationToken));

        Assert.Equal(TargetDatabase, reader.GetString(0));
        Assert.True(reader.GetInt32(1) >= 16, $"Expected SQL Server 2022 or newer, got major version {reader.GetInt32(1)}.");
    }
}
