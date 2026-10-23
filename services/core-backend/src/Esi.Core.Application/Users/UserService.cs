using Esi.Core.Domain.Users;

namespace Esi.Core.Application.Users;

/// <summary>Resolves an authenticated (issuer, subject) to the internal user id, creating the user on first sight (ADR-0006).</summary>
public sealed class UserService(IUserRepository users, TimeProvider clock)
{
    public async Task<Guid> ResolveAsync(string issuer, string subject, CancellationToken cancellationToken) =>
        await users.FindIdAsync(issuer, subject, cancellationToken)
        ?? await users.AddOrGetIdAsync(new User(Guid.NewGuid(), issuer, subject, clock.GetUtcNow()), cancellationToken);
}
