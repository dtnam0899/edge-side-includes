using Esi.Core.Application.Abstractions;
using Esi.Core.Application.Artifacts;
using Esi.Core.Application.Connections;
using Esi.Core.Application.Problems;
using Esi.Core.Domain.Dashboards;

namespace Esi.Core.Application.Dashboards;

public enum DashboardItemStatus
{
    Available = 0,
    ConnectionUnavailable = 1,
    MigrationRequired = 2,
    Missing = 3,
}

public sealed record DashboardItemView(DashboardItem Item, DashboardItemStatus Status, ArtifactView? Artifact);

public sealed record DashboardView(Dashboard Dashboard, IReadOnlyList<DashboardItemView> Items);

/// <summary>
/// Personal dashboards of saved artifacts (SR-8). Opening one returns layout and artifacts, never data: the client
/// runs each item through <c>executeArtifact</c>, so one failing item does not block the others. Withdrawn consent
/// hides the dashboard; a deleted connection or artifact shows as an unavailable or missing item.
/// </summary>
public sealed class DashboardService(
    ICurrentUser user,
    ConnectionAccess access,
    IArtifactRepository repository,
    ArtifactService artifacts,
    TimeProvider clock)
{
    public async Task<IReadOnlyList<Dashboard>> ListAsync(Guid connectionId, CancellationToken cancellationToken)
    {
        await access.GetUsableAsync(connectionId, cancellationToken);
        return await repository.ListDashboardsAsync(user.UserId, connectionId, cancellationToken);
    }

    public async Task<DashboardView> CreateAsync(Guid connectionId, string? name, CancellationToken cancellationToken)
    {
        var validName = ValidName(name);
        await access.GetUsableAsync(connectionId, cancellationToken);
        var dashboard = new Dashboard(Guid.NewGuid(), user.UserId, connectionId, validName, clock.GetUtcNow());
        repository.Add(dashboard);
        await repository.SaveChangesAsync(cancellationToken);
        return new DashboardView(dashboard, []);
    }

    public async Task<DashboardView> GetAsync(Guid dashboardId, CancellationToken cancellationToken)
    {
        var (dashboard, connectionExists) = await GetVisibleAsync(dashboardId, cancellationToken);
        return await ViewAsync(dashboard, connectionExists, cancellationToken);
    }

    public async Task<DashboardView> RenameAsync(Guid dashboardId, string? name, CancellationToken cancellationToken)
    {
        var validName = ValidName(name);
        var (dashboard, connectionExists) = await GetVisibleAsync(dashboardId, cancellationToken);
        dashboard.Rename(validName, clock.GetUtcNow());
        await repository.SaveChangesAsync(cancellationToken);
        return await ViewAsync(dashboard, connectionExists, cancellationToken);
    }

    /// <summary>The owner can always delete a dashboard; its artifacts stay.</summary>
    public async Task DeleteAsync(Guid dashboardId, CancellationToken cancellationToken)
    {
        var dashboard = await repository.FindDashboardForOwnerAsync(dashboardId, user.UserId, cancellationToken)
            ?? throw EsiProblem.NotFound("The dashboard");
        repository.Remove(dashboard);
        await repository.SaveChangesAsync(cancellationToken);
    }

    public async Task<DashboardItemView> AddItemAsync(Guid dashboardId, Guid? artifactId, ItemLayout? layout, CancellationToken cancellationToken)
    {
        if (layout is not { IsValid: true })
        {
            throw EsiProblem.InvalidRequest(("layout", "x and y must be 0 or more; width and height 1 or more."));
        }

        var dashboard = await GetUsableAsync(dashboardId, cancellationToken);
        var artifact = artifactId is { } id ? await repository.FindArtifactForOwnerAsync(id, user.UserId, cancellationToken) : null;
        if (artifact is null || artifact.ConnectionId != dashboard.ConnectionId)
        {
            throw EsiProblem.InvalidRequest(("artifactId", "Must be one of your saved artifacts of the same connection."));
        }

        var item = dashboard.AddItem(artifact.Id, layout, clock.GetUtcNow());
        await repository.SaveChangesAsync(cancellationToken);
        var view = artifacts.View(artifact, connectionExists: true);
        return new DashboardItemView(item, ItemStatus(view), view);
    }

    public async Task RemoveItemAsync(Guid dashboardId, Guid itemId, CancellationToken cancellationToken)
    {
        var dashboard = await GetUsableAsync(dashboardId, cancellationToken);
        if (!dashboard.RemoveItem(itemId, clock.GetUtcNow()))
        {
            throw EsiProblem.NotFound("The dashboard item");
        }

        await repository.SaveChangesAsync(cancellationToken);
    }

    /// <summary>Saves position and size after drag or resize; every current item must be listed exactly once.</summary>
    public async Task<DashboardView> SaveLayoutAsync(Guid dashboardId, IReadOnlyList<(Guid ItemId, ItemLayout? Layout)>? items, CancellationToken cancellationToken)
    {
        var dashboard = await GetUsableAsync(dashboardId, cancellationToken);
        var given = items ?? [];
        var ids = dashboard.Items.Select(i => i.Id).ToHashSet();
        if (given.Count != ids.Count || given.Select(i => i.ItemId).Distinct().Count() != given.Count || !given.All(i => ids.Contains(i.ItemId)))
        {
            throw EsiProblem.InvalidRequest(("items", "List every item of the dashboard exactly once."));
        }

        if (given.Any(i => i.Layout is not { IsValid: true }))
        {
            throw EsiProblem.InvalidRequest(("items.layout", "x and y must be 0 or more; width and height 1 or more."));
        }

        dashboard.SetLayout(given.ToDictionary(i => i.ItemId, i => i.Layout!), clock.GetUtcNow());
        await repository.SaveChangesAsync(cancellationToken);
        return await ViewAsync(dashboard, connectionExists: true, cancellationToken);
    }

    private async Task<(Dashboard Dashboard, bool ConnectionExists)> GetVisibleAsync(Guid dashboardId, CancellationToken cancellationToken)
    {
        var dashboard = await repository.FindDashboardForOwnerAsync(dashboardId, user.UserId, cancellationToken)
            ?? throw EsiProblem.NotFound("The dashboard");
        return (dashboard, await artifacts.EnsureVisibleAsync(dashboard.ConnectionId, cancellationToken));
    }

    private async Task<Dashboard> GetUsableAsync(Guid dashboardId, CancellationToken cancellationToken)
    {
        var dashboard = await repository.FindDashboardForOwnerAsync(dashboardId, user.UserId, cancellationToken)
            ?? throw EsiProblem.NotFound("The dashboard");
        await access.GetUsableAsync(dashboard.ConnectionId, cancellationToken);
        return dashboard;
    }

    private async Task<DashboardView> ViewAsync(Dashboard dashboard, bool connectionExists, CancellationToken cancellationToken)
    {
        var found = (await repository.FindArtifactsForOwnerAsync([.. dashboard.Items.Select(i => i.ArtifactId)], user.UserId, cancellationToken))
            .ToDictionary(a => a.Id);
        // Reading order of the grid: top to bottom, then left to right.
        var items = dashboard.Items.OrderBy(i => i.Y).ThenBy(i => i.X).Select(item =>
        {
            if (!found.TryGetValue(item.ArtifactId, out var artifact))
            {
                return new DashboardItemView(item, DashboardItemStatus.Missing, null);
            }

            var view = artifacts.View(artifact, connectionExists);
            return new DashboardItemView(item, ItemStatus(view), view);
        }).ToList();
        return new DashboardView(dashboard, items);
    }

    private static DashboardItemStatus ItemStatus(ArtifactView view) => view.Status switch
    {
        ArtifactStatus.ConnectionUnavailable => DashboardItemStatus.ConnectionUnavailable,
        ArtifactStatus.MigrationRequired => DashboardItemStatus.MigrationRequired,
        _ => DashboardItemStatus.Available,
    };

    private static string ValidName(string? name)
    {
        var trimmed = name?.Trim();
        return string.IsNullOrEmpty(trimmed) || trimmed.Length > Dashboard.MaxNameLength
            ? throw EsiProblem.InvalidRequest(("name", $"Required, 1 to {Dashboard.MaxNameLength} characters."))
            : trimmed;
    }
}
