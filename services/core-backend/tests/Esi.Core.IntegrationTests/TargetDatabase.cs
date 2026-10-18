using System.Text.RegularExpressions;
using Microsoft.Data.SqlClient;

namespace Esi.Core.IntegrationTests;

/// <summary>
/// Recreates esi_target (the stand-in for a user's target database) from Fixtures/target-sample-schema.sql,
/// once per test run, so every run starts from the same schema and rows.
/// </summary>
public sealed partial class TargetDatabase : IAsyncLifetime
{
    public const string Name = "esi_target";

    public string ConnectionString { get; } =
        new SqlConnectionStringBuilder(TestDatabases.TargetDb) { InitialCatalog = Name }.ConnectionString;

    [GeneratedRegex(@"^\s*GO\s*$", RegexOptions.Multiline | RegexOptions.IgnoreCase)]
    private static partial Regex BatchSeparator();

    public async ValueTask InitializeAsync()
    {
        await using (var server = new SqlConnection(TestDatabases.TargetDb))
        {
            await server.OpenAsync();
            await using var recreate = new SqlCommand(
                $"""
                IF DB_ID(N'{Name}') IS NOT NULL
                BEGIN
                    ALTER DATABASE [{Name}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
                    DROP DATABASE [{Name}];
                END
                CREATE DATABASE [{Name}];
                """,
                server);
            await recreate.ExecuteNonQueryAsync();
        }

        var script = await File.ReadAllTextAsync(Path.Combine(AppContext.BaseDirectory, "Fixtures", "target-sample-schema.sql"));
        await using var connection = new SqlConnection(ConnectionString);
        await connection.OpenAsync();
        foreach (var batch in BatchSeparator().Split(script).Where(b => !string.IsNullOrWhiteSpace(b)))
        {
            await using var command = new SqlCommand(batch, connection);
            await command.ExecuteNonQueryAsync();
        }
    }

    public ValueTask DisposeAsync() => ValueTask.CompletedTask;
}
