using System.Text.Json;
using Esi.Core.Api.Contracts;
using Esi.Core.Application.Security;
using Esi.Core.Infrastructure.Connections;

namespace Esi.Core.UnitTests;

public class ConnectionSecretsTests
{
    [Fact]
    public void Secret_value_never_prints_its_content()
    {
        var secret = new SecretValue("Password=S3cret!");

        Assert.Equal("***", secret.ToString());
        Assert.Equal("value ***", $"value {secret}");
    }

    [Fact]
    public void Inspector_extracts_server_and_database()
    {
        var target = new SqlConnectionStringInspector().Inspect(new SecretValue("Server=sql01,1433;Database=Sales;User Id=r;Password=p"));

        Assert.Equal("sql01,1433", target?.Server);
        Assert.Equal("Sales", target?.Database);
    }

    [Theory]
    [InlineData("not a connection string Password=S3cret!")]
    [InlineData("Server=sql01;User Id=r;Password=S3cret!")]
    [InlineData("Database=Sales;Password=S3cret!")]
    public void Inspector_rejects_unusable_strings(string value) =>
        Assert.Null(new SqlConnectionStringInspector().Inspect(new SecretValue(value)));

    [Theory]
    [InlineData(18456, "Login failed: check the user name and password.")]
    [InlineData(4060, "The database does not exist or the login cannot open it.")]
    [InlineData(-2, "The server could not be reached: check host, port and firewall.")]
    [InlineData(99999, "The connection failed (SQL Server error 99999).")]
    public void Probe_failures_map_to_fixed_non_secret_reasons(int number, string reason) =>
        Assert.Equal(reason, SqlConnectionProbe.Reason(number));

    [Fact]
    public void Contract_enums_serialize_with_the_contract_strings()
    {
        var json = JsonSerializer.Serialize(new Connection { Consent = ConnectionConsent.Withdrawn, Name = "n", Server = "s", Database = "d" });
        var item = JsonSerializer.Serialize(new DashboardItem { Status = DashboardItemStatus.ConnectionUnavailable });

        Assert.Contains("\"consent\":\"withdrawn\"", json, StringComparison.Ordinal);
        Assert.Contains("\"status\":\"connection-unavailable\"", item, StringComparison.Ordinal);
    }
}
