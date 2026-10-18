using Esi.Core.Application.Connections;
using Esi.Core.Domain.Connections;
using Microsoft.EntityFrameworkCore;

namespace Esi.Core.Infrastructure.Persistence.Repositories;

public sealed class ConnectionRepository(AppDbContext db) : IConnectionRepository
{
    public async Task<IReadOnlyList<Connection>> ListByOwnerAsync(Guid ownerId, CancellationToken cancellationToken) =>
        await db.Connections.Where(c => c.OwnerId == ownerId).OrderByDescending(c => c.CreatedAt).ToListAsync(cancellationToken);

    public Task<Connection?> FindForOwnerAsync(Guid id, Guid ownerId, CancellationToken cancellationToken) =>
        db.Connections.SingleOrDefaultAsync(c => c.Id == id && c.OwnerId == ownerId, cancellationToken);

    public void Add(Connection connection) => db.Connections.Add(connection);

    public void Remove(Connection connection) => db.Connections.Remove(connection);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => db.SaveChangesAsync(cancellationToken);
}
