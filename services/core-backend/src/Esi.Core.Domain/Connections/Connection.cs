namespace Esi.Core.Domain.Connections;

/// <summary>A user's SQL Server connection. Private to its owner; the connection string exists only encrypted.</summary>
public sealed class Connection
{
    public const int MaxNameLength = 200;

    private Connection()
    {
        Name = string.Empty;
        Server = string.Empty;
        Database = string.Empty;
        Secret = null!;
    }

    public Connection(Guid id, Guid ownerId, string name, string server, string database, EncryptedSecret secret, DateTimeOffset now)
    {
        Id = id;
        OwnerId = ownerId;
        Name = name;
        Server = server;
        Database = database;
        Secret = secret;
        Consent = ConsentState.Granted;
        CreatedAt = now;
        UpdatedAt = now;
    }

    public Guid Id { get; private set; }

    public Guid OwnerId { get; private set; }

    public string Name { get; private set; }

    /// <summary>Host (and instance or port) from the connection string, without credentials.</summary>
    public string Server { get; private set; }

    public string Database { get; private set; }

    public ConsentState Consent { get; private set; }

    public EncryptedSecret Secret { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public void Rename(string name, DateTimeOffset now)
    {
        Name = name;
        UpdatedAt = now;
    }

    public void ReplaceSecret(string server, string database, EncryptedSecret secret, DateTimeOffset now)
    {
        Server = server;
        Database = database;
        Secret = secret;
        UpdatedAt = now;
    }

    public void WithdrawConsent(DateTimeOffset now)
    {
        Consent = ConsentState.Withdrawn;
        UpdatedAt = now;
    }

    public void GrantConsent(DateTimeOffset now)
    {
        Consent = ConsentState.Granted;
        UpdatedAt = now;
    }
}
