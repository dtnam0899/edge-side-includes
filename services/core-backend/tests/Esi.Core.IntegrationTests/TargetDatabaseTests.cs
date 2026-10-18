using Microsoft.Data.SqlClient;

namespace Esi.Core.IntegrationTests;

/// <summary>
/// The stand-in for a user's target database that later schema discovery and SQL execution tests (ESI-16) use.
/// It is a separate database (esi_target) from the application's own database.
/// </summary>
[Collection(TargetDatabaseCollection.Name)]
public class TargetDatabaseTests(TargetDatabase target)
{
    [Fact]
    public void Target_database_is_separate_from_the_app_database() =>
        Assert.NotEqual(
            new SqlConnectionStringBuilder(TestDatabases.AppDb).InitialCatalog,
            new SqlConnectionStringBuilder(target.ConnectionString).InitialCatalog);

    [Fact]
    public async Task Sample_schema_has_related_tables_and_rows()
    {
        var foreignKeys = await ScalarAsync<int>("SELECT COUNT(*) FROM sys.foreign_keys");
        var orderLines = await ScalarAsync<int>("SELECT COUNT(*) FROM dbo.OrderLines");

        Assert.Equal(3, foreignKeys);
        Assert.Equal(3, orderLines);
    }

    [Fact]
    public async Task Stored_procedure_definition_can_be_read_without_executing_it()
    {
        var definition = await ScalarAsync<string>("SELECT OBJECT_DEFINITION(OBJECT_ID(N'dbo.usp_GetCustomerOrders'))");

        Assert.Contains("CREATE PROCEDURE dbo.usp_GetCustomerOrders", definition);
        Assert.Contains("SELECT", definition);
    }

    private async Task<T> ScalarAsync<T>(string sql)
    {
        var cancellationToken = TestContext.Current.CancellationToken;
        await using var connection = new SqlConnection(target.ConnectionString);
        await connection.OpenAsync(cancellationToken);
        await using var command = new SqlCommand(sql, connection);
        return (T)(await command.ExecuteScalarAsync(cancellationToken))!;
    }
}
