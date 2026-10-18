using Esi.Core.Domain.Connections;

namespace Esi.Core.Application.Connections;

public interface IConnectionRepository
{
    Task<IReadOnlyList<Connection>> ListByOwnerAsync(Guid ownerId, CancellationToken cancellationToken);

    /// <summary>Returns the connection only when it belongs to the owner.</summary>
    Task<Connection?> FindForOwnerAsync(Guid id, Guid ownerId, CancellationToken cancellationToken);

    void Add(Connection connection);

    void Remove(Connection connection);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
