using Esi.Core.Application.Abstractions;
using Esi.Core.Application.Consent;
using Esi.Core.Application.Problems;
using Esi.Core.Domain.Connections;

namespace Esi.Core.Application.Connections;

/// <summary>
/// The single authorization check for anything that uses a connection (SR-1, SR-9): it must belong to the current
/// user (otherwise 404, so other users' connections are not revealed), its consent must be granted, and the user
/// must have accepted the current consent terms. Schema, chat, execution, artifacts and dashboards all go through it.
/// </summary>
public sealed class ConnectionAccess(ICurrentUser user, IConnectionRepository connections, ConsentService consent)
{
    public async Task<Connection> GetOwnedAsync(Guid connectionId, CancellationToken cancellationToken) =>
        await connections.FindForOwnerAsync(connectionId, user.UserId, cancellationToken)
            ?? throw EsiProblem.NotFound("The connection");

    public async Task<Connection> GetUsableAsync(Guid connectionId, CancellationToken cancellationToken)
    {
        var connection = await GetOwnedAsync(connectionId, cancellationToken);
        if (connection.Consent == ConsentState.Withdrawn)
        {
            throw EsiProblem.ConsentWithdrawn();
        }

        await consent.EnsureCurrentTermsAcceptedAsync(cancellationToken);
        return connection;
    }
}
