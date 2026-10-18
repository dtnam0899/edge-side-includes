namespace Esi.Core.Domain.Scripts;

/// <summary>
/// A generated stored-procedure script saved to the user's library (SR-3). It is text only: never created in or run
/// against the database.
/// </summary>
public sealed class Script
{
    public const int MaxNameLength = 200;

    private Script()
    {
        Name = string.Empty;
        Sql = string.Empty;
    }

    public Script(Guid id, Guid ownerId, Guid connectionId, Guid? sessionId, string name, string sql, DateTimeOffset createdAt)
    {
        Id = id;
        OwnerId = ownerId;
        ConnectionId = connectionId;
        SessionId = sessionId;
        Name = name;
        Sql = sql;
        CreatedAt = createdAt;
    }

    public Guid Id { get; private set; }

    public Guid OwnerId { get; private set; }

    public Guid ConnectionId { get; private set; }

    public Guid? SessionId { get; private set; }

    public string Name { get; private set; }

    public string Sql { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }
}
