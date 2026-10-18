using Esi.Core.Application.Artifacts;
using Esi.Core.Domain.Artifacts;
using Esi.Core.Domain.Dashboards;
using Microsoft.EntityFrameworkCore;

namespace Esi.Core.Infrastructure.Persistence.Repositories;

public sealed class ArtifactRepository(AppDbContext db) : IArtifactRepository
{
    public async Task<IReadOnlyList<Artifact>> ListArtifactsAsync(Guid ownerId, Guid connectionId, CancellationToken cancellationToken) =>
        await db.Artifacts.Where(a => a.OwnerId == ownerId && a.ConnectionId == connectionId)
            .OrderByDescending(a => a.CreatedAt).ToListAsync(cancellationToken);

    public Task<Artifact?> FindArtifactForOwnerAsync(Guid artifactId, Guid ownerId, CancellationToken cancellationToken) =>
        db.Artifacts.SingleOrDefaultAsync(a => a.Id == artifactId && a.OwnerId == ownerId, cancellationToken);

    public async Task<IReadOnlyList<Artifact>> FindArtifactsForOwnerAsync(IReadOnlyCollection<Guid> artifactIds, Guid ownerId, CancellationToken cancellationToken) =>
        artifactIds.Count == 0
            ? []
            : await db.Artifacts.Where(a => a.OwnerId == ownerId && artifactIds.Contains(a.Id)).ToListAsync(cancellationToken);

    public void Add(Artifact artifact) => db.Artifacts.Add(artifact);

    public void Remove(Artifact artifact) => db.Artifacts.Remove(artifact);

    public async Task<IReadOnlyList<Dashboard>> ListDashboardsAsync(Guid ownerId, Guid connectionId, CancellationToken cancellationToken) =>
        await db.Dashboards.Where(d => d.OwnerId == ownerId && d.ConnectionId == connectionId)
            .OrderByDescending(d => d.UpdatedAt).ToListAsync(cancellationToken);

    public Task<Dashboard?> FindDashboardForOwnerAsync(Guid dashboardId, Guid ownerId, CancellationToken cancellationToken) =>
        db.Dashboards.SingleOrDefaultAsync(d => d.Id == dashboardId && d.OwnerId == ownerId, cancellationToken);

    public void Add(Dashboard dashboard) => db.Dashboards.Add(dashboard);

    public void Remove(Dashboard dashboard) => db.Dashboards.Remove(dashboard);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => db.SaveChangesAsync(cancellationToken);
}
