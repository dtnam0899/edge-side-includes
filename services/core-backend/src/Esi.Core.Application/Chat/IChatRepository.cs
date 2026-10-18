using Esi.Core.Domain.Chat;
using Esi.Core.Domain.Scripts;

namespace Esi.Core.Application.Chat;

public interface IChatRepository
{
    Task<IReadOnlyList<ChatSession>> ListSessionsAsync(Guid ownerId, Guid connectionId, CancellationToken cancellationToken);

    Task<ChatSession?> FindSessionForOwnerAsync(Guid sessionId, Guid ownerId, CancellationToken cancellationToken);

    Task<IReadOnlyList<ChatMessage>> ListMessagesAsync(Guid sessionId, CancellationToken cancellationToken);

    void Add(ChatSession session);

    void Add(ChatMessage message);

    void Add(Script script);

    Task<IReadOnlyList<Script>> ListScriptsAsync(Guid ownerId, Guid connectionId, CancellationToken cancellationToken);

    Task<Script?> FindScriptForOwnerAsync(Guid scriptId, Guid ownerId, CancellationToken cancellationToken);

    void Remove(Script script);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
