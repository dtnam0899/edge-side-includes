using Esi.Core.Application.Abstractions;
using Esi.Core.Application.Agents;
using Esi.Core.Application.Connections;
using Esi.Core.Application.Problems;
using Esi.Core.Application.Schema;
using Esi.Core.Domain.Chat;
using Esi.Core.Domain.Scripts;

namespace Esi.Core.Application.Chat;

public sealed record ChatTurnResult(ChatMessage Question, ChatMessage Answer);

/// <summary>
/// Chat sessions per user and connection (SR-2). Asking a question reads the schema, asks the agent for SQL and
/// stores both messages; nothing is executed. A stored-procedure answer is saved to the script library (SR-3).
/// Every operation needs an owned, usable connection, so withdrawn consent hides the history.
/// </summary>
public sealed class ChatService(
    ICurrentUser user,
    ConnectionAccess access,
    IChatRepository chats,
    SchemaService schema,
    IAgentsClient agents,
    TimeProvider clock)
{
    /// <summary>Earlier messages sent along for follow-up questions.</summary>
    public const int HistoryLimit = 20;

    public async Task<IReadOnlyList<ChatSession>> ListAsync(Guid connectionId, CancellationToken cancellationToken)
    {
        await access.GetUsableAsync(connectionId, cancellationToken);
        return await chats.ListSessionsAsync(user.UserId, connectionId, cancellationToken);
    }

    public async Task<ChatSession> CreateAsync(Guid connectionId, string? title, CancellationToken cancellationToken)
    {
        var trimmed = title?.Trim() ?? string.Empty;
        if (trimmed.Length > ChatSession.MaxTitleLength)
        {
            throw EsiProblem.InvalidRequest(("title", $"At most {ChatSession.MaxTitleLength} characters."));
        }

        await access.GetUsableAsync(connectionId, cancellationToken);
        var session = new ChatSession(Guid.NewGuid(), user.UserId, connectionId, trimmed, clock.GetUtcNow());
        chats.Add(session);
        await chats.SaveChangesAsync(cancellationToken);
        return session;
    }

    public async Task<(ChatSession Session, IReadOnlyList<ChatMessage> Messages)> GetAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var session = await GetUsableSessionAsync(sessionId, cancellationToken);
        return (session, await chats.ListMessagesAsync(session.Id, cancellationToken));
    }

    public async Task<ChatTurnResult> AskAsync(Guid sessionId, string? text, CancellationToken cancellationToken)
    {
        var question = text?.Trim() ?? string.Empty;
        if (question.Length == 0 || question.Length > ChatMessage.MaxQuestionLength)
        {
            throw EsiProblem.InvalidRequest(("text", $"Required, 1 to {ChatMessage.MaxQuestionLength} characters."));
        }

        var session = await GetUsableSessionAsync(sessionId, cancellationToken);
        var history = (await chats.ListMessagesAsync(session.Id, cancellationToken))
            .TakeLast(HistoryLimit)
            .Select(m => new ConversationTurn(m.Role, m.Text))
            .ToList();
        var metadata = await schema.GetAsync(session.ConnectionId, cancellationToken);
        var generation = await agents.GenerateSqlAsync(question, metadata, history, cancellationToken);

        var now = clock.GetUtcNow();
        Guid? scriptId = null;
        if (generation.Kind == SqlKind.StoredProcedure && generation.Sql.Length > 0)
        {
            var name = string.IsNullOrWhiteSpace(generation.ProcedureName) ? $"script-{now:yyyyMMdd-HHmmss}" : generation.ProcedureName.Trim();
            var script = new Script(Guid.NewGuid(), user.UserId, session.ConnectionId, session.Id,
                name.Length <= Script.MaxNameLength ? name : name[..Script.MaxNameLength], generation.Sql, now);
            chats.Add(script);
            scriptId = script.Id;
        }

        var asked = new ChatMessage(Guid.NewGuid(), session.Id, ChatRole.User, question, null, now);
        var answered = new ChatMessage(
            Guid.NewGuid(),
            session.Id,
            ChatRole.Assistant,
            generation.Explanation,
            new GeneratedSql(generation.Kind, generation.Kind == SqlKind.None ? string.Empty : generation.Sql, generation.ReferencedTables, scriptId),
            now.AddTicks(1));
        chats.Add(asked);
        chats.Add(answered);
        session.TitleFromFirstQuestion(question);
        session.Touch(now);
        await chats.SaveChangesAsync(cancellationToken);
        return new ChatTurnResult(asked, answered);
    }

    /// <summary>Owned session (404 otherwise) whose connection is usable (consent, current terms).</summary>
    public async Task<ChatSession> GetUsableSessionAsync(Guid sessionId, CancellationToken cancellationToken)
    {
        var session = await chats.FindSessionForOwnerAsync(sessionId, user.UserId, cancellationToken)
            ?? throw EsiProblem.NotFound("The chat session");
        await access.GetUsableAsync(session.ConnectionId, cancellationToken);
        return session;
    }
}
