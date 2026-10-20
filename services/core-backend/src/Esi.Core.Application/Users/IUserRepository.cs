using Esi.Core.Domain.Users;

namespace Esi.Core.Application.Users;

public interface IUserRepository
{
    Task<Guid?> FindIdAsync(string issuer, string subject, CancellationToken cancellationToken);

    /// <summary>Stores <paramref name="user"/> and returns its id, or the existing id when a concurrent request stored the same (issuer, subject) first.</summary>
    Task<Guid> AddOrGetIdAsync(User user, CancellationToken cancellationToken);
}
