namespace Esi.Core.Domain.Artifacts;

public enum ArtifactKind
{
    Table = 0,
    Kpi = 1,
}

/// <summary>
/// A saved visualization (SR-7, ADR-0002): the validated DSL document (A2UI updateComponents payload plus catalogId,
/// protocol and DSL schema versions), the SELECT it is bound to and the columns it expects. Never row data or secrets;
/// the data is read live through the owner's connection when the artifact is shown.
/// </summary>
public sealed class Artifact
{
    public const int MaxNameLength = 200;

    private Artifact()
    {
        Name = string.Empty;
        DslJson = string.Empty;
        Sql = string.Empty;
        ColumnsJson = string.Empty;
        DslSchemaVersion = string.Empty;
    }

    public Artifact(Guid id, Guid ownerId, Guid connectionId, string name, ArtifactKind kind, string dslJson, string dslSchemaVersion,
        string sql, string columnsJson, DateTimeOffset createdAt)
    {
        Id = id;
        OwnerId = ownerId;
        ConnectionId = connectionId;
        Name = name;
        Kind = kind;
        DslJson = dslJson;
        DslSchemaVersion = dslSchemaVersion;
        Sql = sql;
        ColumnsJson = columnsJson;
        CreatedAt = createdAt;
    }

    public Guid Id { get; private set; }

    public Guid OwnerId { get; private set; }

    public Guid ConnectionId { get; private set; }

    public string Name { get; private set; }

    public ArtifactKind Kind { get; private set; }

    /// <summary>The DSL document as validated JSON.</summary>
    public string DslJson { get; private set; }

    /// <summary>Recorded so the artifact can be migrated or flagged when the pinned DSL version changes.</summary>
    public string DslSchemaVersion { get; private set; }

    public string Sql { get; private set; }

    /// <summary>Expected column definitions as JSON (name, sqlType, nullable).</summary>
    public string ColumnsJson { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }
}
