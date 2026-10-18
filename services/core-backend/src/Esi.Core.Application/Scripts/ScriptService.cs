using Esi.Core.Application.Abstractions;
using Esi.Core.Application.Chat;
using Esi.Core.Application.Connections;
using Esi.Core.Application.Problems;
using Esi.Core.Domain.Scripts;

namespace Esi.Core.Application.Scripts;

/// <summary>The user's library of generated stored-procedure scripts; hidden while the connection's consent is withdrawn.</summary>
public sealed class ScriptService(ICurrentUser user, ConnectionAccess access, IChatRepository chats)
{
    public async Task<IReadOnlyList<Script>> ListAsync(Guid connectionId, CancellationToken cancellationToken)
    {
        await access.GetUsableAsync(connectionId, cancellationToken);
        return await chats.ListScriptsAsync(user.UserId, connectionId, cancellationToken);
    }

    public async Task<Script> GetAsync(Guid scriptId, CancellationToken cancellationToken)
    {
        var script = await chats.FindScriptForOwnerAsync(scriptId, user.UserId, cancellationToken)
            ?? throw EsiProblem.NotFound("The script");
        await access.GetUsableAsync(script.ConnectionId, cancellationToken);
        return script;
    }

    /// <summary>The user can always delete their own script, even while its connection is unusable.</summary>
    public async Task DeleteAsync(Guid scriptId, CancellationToken cancellationToken)
    {
        var script = await chats.FindScriptForOwnerAsync(scriptId, user.UserId, cancellationToken)
            ?? throw EsiProblem.NotFound("The script");
        chats.Remove(script);
        await chats.SaveChangesAsync(cancellationToken);
    }
}
