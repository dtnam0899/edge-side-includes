using Esi.Core.Domain.Artifacts;
using Esi.Core.Domain.Dashboards;

namespace Esi.Core.Application.Artifacts;

public interface IArtifactRepository
{
    Task<IReadOnlyList<Artifact>> ListArtifactsAsync(Guid ownerId, Guid connectionId, CancellationToken cancellationToken);

    Task<Artifact?> FindArtifactForOwnerAsync(Guid artifactId, Guid ownerId, CancellationToken cancellationToken);

    Task<IReadOnlyList<Artifact>> FindArtifactsForOwnerAsync(IReadOnlyCollection<Guid> artifactIds, Guid ownerId, CancellationToken cancellationToken);

    void Add(Artifact artifact);

    void Remove(Artifact artifact);

    Task<IReadOnlyList<Dashboard>> ListDashboardsAsync(Guid ownerId, Guid connectionId, CancellationToken cancellationToken);

    Task<Dashboard?> FindDashboardForOwnerAsync(Guid dashboardId, Guid ownerId, CancellationToken cancellationToken);

    void Add(Dashboard dashboard);

    void Remove(Dashboard dashboard);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
