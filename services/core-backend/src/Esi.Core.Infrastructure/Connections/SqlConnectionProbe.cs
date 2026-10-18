using System.Diagnostics;
using Esi.Core.Application.Connections;
using Esi.Core.Application.Security;
using Microsoft.Data.SqlClient;
using Microsoft.Extensions.Logging;

namespace Esi.Core.Infrastructure.Connections;

/// <summary>
/// Opens a user's connection to test it. Failures are mapped from SQL Server error numbers to fixed, non-secret
/// reasons; the driver's message (which can name the login or server) is never returned or logged.
/// </summary>
public sealed partial class SqlConnectionProbe(ILogger<SqlConnectionProbe> logger) : IConnectionProbe
{
    public const int ConnectTimeoutSeconds = 15;

    public async Task<ConnectionProbeResult> OpenAsync(SecretValue connectionString, CancellationToken cancellationToken)
    {
        var stopwatch = Stopwatch.StartNew();
        SqlConnectionStringBuilder builder;
        try
        {
            builder = new SqlConnectionStringBuilder(connectionString.Reveal())
            {
                ConnectTimeout = ConnectTimeoutSeconds,
                ApplicationName = "esi-core",
                Pooling = false,
            };
        }
        catch (Exception exception) when (exception is ArgumentException or FormatException or KeyNotFoundException)
        {
            return Failed(stopwatch, "The stored connection string is not valid.");
        }

        try
        {
            await using var connection = new SqlConnection(builder.ConnectionString);
            await connection.OpenAsync(cancellationToken);
            return new ConnectionProbeResult(true, connection.ServerVersion, (int)stopwatch.ElapsedMilliseconds, null);
        }
        catch (SqlException exception)
        {
            LogFailed(logger, exception.Number);
            return Failed(stopwatch, Reason(exception.Number));
        }
        catch (InvalidOperationException)
        {
            return Failed(stopwatch, "The connection could not be opened with the given settings.");
        }
    }

    internal static string Reason(int sqlErrorNumber) => sqlErrorNumber switch
    {
        18456 => "Login failed: check the user name and password.",
        18452 or 18470 or 18486 or 18487 or 18488 => "Login failed: the login is not allowed to connect.",
        4060 => "The database does not exist or the login cannot open it.",
        -2 or 53 or 40 or 2 or 11001 or 10060 or 10061 or 258 => "The server could not be reached: check host, port and firewall.",
        -1 => "The server could not be reached: check host, port and firewall.",
        _ => $"The connection failed (SQL Server error {sqlErrorNumber}).",
    };

    private static ConnectionProbeResult Failed(Stopwatch stopwatch, string reason) =>
        new(false, null, (int)stopwatch.ElapsedMilliseconds, reason);

    [LoggerMessage(Level = LogLevel.Information, Message = "Connection test failed with SQL Server error {SqlErrorNumber}")]
    private static partial void LogFailed(ILogger logger, int sqlErrorNumber);
}
