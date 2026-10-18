namespace Esi.Core.Domain.Dashboards;

/// <summary>Grid position and size of an item; stored with the dashboard, never inside the DSL (SR-8).</summary>
public sealed record ItemLayout(int X, int Y, int Width, int Height)
{
    public bool IsValid => X >= 0 && Y >= 0 && Width >= 1 && Height >= 1;
}

/// <summary>A personal dashboard of saved artifacts of one connection (SR-8). Private to its owner.</summary>
public sealed class Dashboard
{
    public const int MaxNameLength = 200;

    private readonly List<DashboardItem> _items = [];

    private Dashboard()
    {
        Name = string.Empty;
    }

    public Dashboard(Guid id, Guid ownerId, Guid connectionId, string name, DateTimeOffset now)
    {
        Id = id;
        OwnerId = ownerId;
        ConnectionId = connectionId;
        Name = name;
        CreatedAt = now;
        UpdatedAt = now;
    }

    public Guid Id { get; private set; }

    public Guid OwnerId { get; private set; }

    public Guid ConnectionId { get; private set; }

    public string Name { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public IReadOnlyList<DashboardItem> Items => _items;

    public void Rename(string name, DateTimeOffset now)
    {
        Name = name;
        UpdatedAt = now;
    }

    public DashboardItem AddItem(Guid artifactId, ItemLayout layout, DateTimeOffset now)
    {
        var item = new DashboardItem(Guid.NewGuid(), Id, artifactId, layout);
        _items.Add(item);
        UpdatedAt = now;
        return item;
    }

    public bool RemoveItem(Guid itemId, DateTimeOffset now)
    {
        var removed = _items.RemoveAll(i => i.Id == itemId) > 0;
        if (removed)
        {
            UpdatedAt = now;
        }

        return removed;
    }

    public void SetLayout(IReadOnlyDictionary<Guid, ItemLayout> layouts, DateTimeOffset now)
    {
        foreach (var item in _items)
        {
            item.Move(layouts[item.Id]);
        }

        UpdatedAt = now;
    }
}

/// <summary>One saved artifact placed on a dashboard. The artifact may since have been deleted (shown as missing).</summary>
public sealed class DashboardItem
{
    private DashboardItem()
    {
    }

    internal DashboardItem(Guid id, Guid dashboardId, Guid artifactId, ItemLayout layout)
    {
        Id = id;
        DashboardId = dashboardId;
        ArtifactId = artifactId;
        X = layout.X;
        Y = layout.Y;
        Width = layout.Width;
        Height = layout.Height;
    }

    public Guid Id { get; private set; }

    public Guid DashboardId { get; private set; }

    public Guid ArtifactId { get; private set; }

    public int X { get; private set; }

    public int Y { get; private set; }

    public int Width { get; private set; }

    public int Height { get; private set; }

    public ItemLayout Layout => new(X, Y, Width, Height);

    internal void Move(ItemLayout layout)
    {
        X = layout.X;
        Y = layout.Y;
        Width = layout.Width;
        Height = layout.Height;
    }
}
