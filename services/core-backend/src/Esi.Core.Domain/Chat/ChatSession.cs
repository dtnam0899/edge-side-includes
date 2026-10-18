namespace Esi.Core.Domain.Chat;

/// <summary>A user's conversation about one connection (SR-2). Private to its owner.</summary>
public sealed class ChatSession
{
    public const int MaxTitleLength = 200;

    private ChatSession()
    {
        Title = string.Empty;
    }

    public ChatSession(Guid id, Guid ownerId, Guid connectionId, string title, DateTimeOffset now)
    {
        Id = id;
        OwnerId = ownerId;
        ConnectionId = connectionId;
        Title = title;
        CreatedAt = now;
        LastActivityAt = now;
    }

    public Guid Id { get; private set; }

    public Guid OwnerId { get; private set; }

    public Guid ConnectionId { get; private set; }

    public string Title { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset LastActivityAt { get; private set; }

    public void Touch(DateTimeOffset now) => LastActivityAt = now;

    public void TitleFromFirstQuestion(string question)
    {
        if (Title.Length == 0)
        {
            Title = question.Length <= MaxTitleLength ? question : question[..MaxTitleLength];
        }
    }
}
