using Esi.Core.Application.Security;

namespace Esi.Core.Application.Connections;

public readonly record struct ConnectionTarget(string Server, string Database);

public interface IConnectionStringInspector
{
    /// <summary>Returns server and database, or null when the text is not a usable SQL Server connection string.</summary>
    ConnectionTarget? Inspect(SecretValue connectionString);
}
