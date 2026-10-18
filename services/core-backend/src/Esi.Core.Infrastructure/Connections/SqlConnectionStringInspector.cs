using Esi.Core.Application.Connections;
using Esi.Core.Application.Security;
using Microsoft.Data.SqlClient;

namespace Esi.Core.Infrastructure.Connections;

public sealed class SqlConnectionStringInspector : IConnectionStringInspector
{
    public ConnectionTarget? Inspect(SecretValue connectionString)
    {
        try
        {
            var builder = new SqlConnectionStringBuilder(connectionString.Reveal());
            return string.IsNullOrWhiteSpace(builder.DataSource) || string.IsNullOrWhiteSpace(builder.InitialCatalog)
                ? null
                : new ConnectionTarget(builder.DataSource, builder.InitialCatalog);
        }
        catch (Exception exception) when (exception is ArgumentException or FormatException or KeyNotFoundException)
        {
            // The parser's message can quote the input; never surface it.
            return null;
        }
    }
}
