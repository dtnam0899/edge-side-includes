using Esi.Core.Application.Chat;
using Esi.Core.Domain.Chat;
using Esi.Core.Domain.Scripts;
using Microsoft.EntityFrameworkCore;

namespace Esi.Core.Infrastructure.Persistence.Repositories;

public sealed class ChatRepository(AppDbContext db) : IChatRepository
{
    public async Task<IReadOnlyList<ChatSession>> ListSessionsAsync(Guid ownerId, Guid connectionId, CancellationToken cancellationToken) =>
        await db.ChatSessions.Where(s => s.OwnerId == ownerId && s.ConnectionId == connectionId)
            .OrderByDescending(s => s.LastActivityAt).ToListAsync(cancellationToken);

    public Task<ChatSession?> FindSessionForOwnerAsync(Guid sessionId, Guid ownerId, CancellationToken cancellationToken) =>
        db.ChatSessions.SingleOrDefaultAsync(s => s.Id == sessionId && s.OwnerId == ownerId, cancellationToken);

    public async Task<IReadOnlyList<ChatMessage>> ListMessagesAsync(Guid sessionId, CancellationToken cancellationToken) =>
        await db.ChatMessages.Where(m => m.SessionId == sessionId).OrderBy(m => m.CreatedAt).ToListAsync(cancellationToken);

    public void Add(ChatSession session) => db.ChatSessions.Add(session);

    public void Add(ChatMessage message) => db.ChatMessages.Add(message);

    public void Add(Script script) => db.Scripts.Add(script);

    public async Task<IReadOnlyList<Script>> ListScriptsAsync(Guid ownerId, Guid connectionId, CancellationToken cancellationToken) =>
        await db.Scripts.Where(s => s.OwnerId == ownerId && s.ConnectionId == connectionId)
            .OrderByDescending(s => s.CreatedAt).ToListAsync(cancellationToken);

    public Task<Script?> FindScriptForOwnerAsync(Guid scriptId, Guid ownerId, CancellationToken cancellationToken) =>
        db.Scripts.SingleOrDefaultAsync(s => s.Id == scriptId && s.OwnerId == ownerId, cancellationToken);

    public void Remove(Script script) => db.Scripts.Remove(script);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => db.SaveChangesAsync(cancellationToken);
}
