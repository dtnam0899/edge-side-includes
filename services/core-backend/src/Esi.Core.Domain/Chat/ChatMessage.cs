namespace Esi.Core.Domain.Chat;

public enum ChatRole
{
    User = 0,
    Assistant = 1,
}

public enum SqlKind
{
    None = 0,
    Query = 1,
    StoredProcedure = 2,
}

/// <summary>
/// SQL proposed by the assistant for review. It has never been executed; running it is a separate, explicit request.
/// </summary>
public sealed record GeneratedSql(SqlKind Kind, string Sql, IReadOnlyList<string> ReferencedTables, Guid? SavedScriptId);

public sealed class ChatMessage
{
    public const int MaxQuestionLength = 4000;

    private ChatMessage()
    {
        Text = string.Empty;
    }

    public ChatMessage(Guid id, Guid sessionId, ChatRole role, string text, GeneratedSql? generatedSql, DateTimeOffset createdAt)
    {
        Id = id;
        SessionId = sessionId;
        Role = role;
        Text = text;
        GeneratedSql = generatedSql;
        CreatedAt = createdAt;
    }

    public Guid Id { get; private set; }

    public Guid SessionId { get; private set; }

    public ChatRole Role { get; private set; }

    public string Text { get; private set; }

    public GeneratedSql? GeneratedSql { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }
}
