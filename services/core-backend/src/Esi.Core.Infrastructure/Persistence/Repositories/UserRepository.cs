using Esi.Core.Application.Users;
using Esi.Core.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Esi.Core.Infrastructure.Persistence.Repositories;

public sealed class UserRepository(AppDbContext db) : IUserRepository
{
    public async Task<Guid?> FindIdAsync(string issuer, string subject, CancellationToken cancellationToken) =>
        await db.Users.AsNoTracking().Where(u => u.Issuer == issuer && u.Subject == subject)
            .Select(u => (Guid?)u.Id).SingleOrDefaultAsync(cancellationToken);

    public async Task<Guid> AddOrGetIdAsync(User user, CancellationToken cancellationToken)
    {
        var entry = db.Users.Add(user);
        try
        {
            await db.SaveChangesAsync(cancellationToken);
            return user.Id;
        }
        catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation })
        {
            // Two first requests of the same account raced; the other one stored the row.
            entry.State = EntityState.Detached;
            return await FindIdAsync(user.Issuer, user.Subject, cancellationToken)
                ?? throw new InvalidOperationException("The user row vanished after a unique violation.", ex);
        }
    }
}
