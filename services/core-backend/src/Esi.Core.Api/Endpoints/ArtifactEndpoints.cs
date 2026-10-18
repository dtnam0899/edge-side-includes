using System.Text.Json;
using Esi.Core.Api.Contracts;
using Esi.Core.Application.Artifacts;
using Esi.Core.Application.Dashboards;
using Esi.Core.Application.Queries;
using Model = Esi.Core.Domain;

namespace Esi.Core.Api.Endpoints;

internal static class ArtifactEndpoints
{
    public static IEndpointRouteBuilder MapArtifactEndpoints(this IEndpointRouteBuilder app)
    {
        var artifacts = app.MapGroup(string.Empty).WithTags("Artifacts");

        artifacts.MapGet("/connections/{connectionId:guid}/artifacts", async (Guid connectionId, ArtifactService service, CancellationToken ct) =>
                Results.Ok((await service.ListAsync(connectionId, ct)).Select(Summary)))
            .WithName("listArtifacts");

        artifacts.MapPost("/connections/{connectionId:guid}/artifacts", async (Guid connectionId, CreateArtifactRequest? request, ArtifactService service, CancellationToken ct) =>
            {
                var created = await service.CreateAsync(
                    connectionId,
                    request?.Name,
                    request is null ? null : request.Kind == CreateArtifactRequestKind.Kpi ? "kpi" : "table",
                    request?.Dsl is null ? null : JsonSerializer.SerializeToElement(request.Dsl),
                    request?.Sql,
                    request?.Columns?.Select(c => new ResultColumn(c.Name, c.SqlType, c.Nullable)).ToList(),
                    ct);
                return Results.Created($"/artifacts/{created.Artifact.Id}", Full(created));
            })
            .WithName("createArtifact");

        artifacts.MapGet("/artifacts/{artifactId:guid}", async (Guid artifactId, ArtifactService service, CancellationToken ct) =>
                Results.Ok(Full(await service.GetAsync(artifactId, ct))))
            .WithName("getArtifact");

        artifacts.MapDelete("/artifacts/{artifactId:guid}", async (Guid artifactId, ArtifactService service, CancellationToken ct) =>
            {
                await service.DeleteAsync(artifactId, ct);
                return Results.NoContent();
            })
            .WithName("deleteArtifact");

        artifacts.MapPost("/artifacts/{artifactId:guid}/executions", async (Guid artifactId, ExecuteArtifactRequest? request, ArtifactService service, CancellationToken ct) =>
                Results.Ok(QueryEndpoints.ToContract(await service.ExecuteAsync(artifactId, request?.Page, ct))))
            .WithName("executeArtifact");

        var dashboards = app.MapGroup(string.Empty).WithTags("Dashboards");

        dashboards.MapGet("/connections/{connectionId:guid}/dashboards", async (Guid connectionId, DashboardService service, CancellationToken ct) =>
                Results.Ok((await service.ListAsync(connectionId, ct)).Select(d => new DashboardSummary
                {
                    Id = d.Id,
                    ConnectionId = d.ConnectionId,
                    Name = d.Name,
                    ItemCount = d.Items.Count,
                    UpdatedAt = d.UpdatedAt,
                })))
            .WithName("listDashboards");

        dashboards.MapPost("/connections/{connectionId:guid}/dashboards", async (Guid connectionId, DashboardNameRequest? request, DashboardService service, CancellationToken ct) =>
            {
                var created = await service.CreateAsync(connectionId, request?.Name, ct);
                return Results.Created($"/dashboards/{created.Dashboard.Id}", DashboardDto(created));
            })
            .WithName("createDashboard");

        dashboards.MapGet("/dashboards/{dashboardId:guid}", async (Guid dashboardId, DashboardService service, CancellationToken ct) =>
                Results.Ok(DashboardDto(await service.GetAsync(dashboardId, ct))))
            .WithName("getDashboard");

        dashboards.MapPut("/dashboards/{dashboardId:guid}", async (Guid dashboardId, DashboardNameRequest? request, DashboardService service, CancellationToken ct) =>
                Results.Ok(DashboardDto(await service.RenameAsync(dashboardId, request?.Name, ct))))
            .WithName("renameDashboard");

        dashboards.MapDelete("/dashboards/{dashboardId:guid}", async (Guid dashboardId, DashboardService service, CancellationToken ct) =>
            {
                await service.DeleteAsync(dashboardId, ct);
                return Results.NoContent();
            })
            .WithName("deleteDashboard");

        dashboards.MapPost("/dashboards/{dashboardId:guid}/items", async (Guid dashboardId, AddDashboardItemRequest? request, DashboardService service, CancellationToken ct) =>
            {
                var item = await service.AddItemAsync(dashboardId, request?.ArtifactId, Layout(request?.Layout), ct);
                return Results.Created($"/dashboards/{dashboardId}", ItemDto(item));
            })
            .WithName("addDashboardItem");

        dashboards.MapDelete("/dashboards/{dashboardId:guid}/items/{itemId:guid}", async (Guid dashboardId, Guid itemId, DashboardService service, CancellationToken ct) =>
            {
                await service.RemoveItemAsync(dashboardId, itemId, ct);
                return Results.NoContent();
            })
            .WithName("removeDashboardItem");

        dashboards.MapPut("/dashboards/{dashboardId:guid}/layout", async (Guid dashboardId, SaveDashboardLayoutRequest? request, DashboardService service, CancellationToken ct) =>
                Results.Ok(DashboardDto(await service.SaveLayoutAsync(
                    dashboardId, request?.Items?.Select(i => (i.ItemId, Layout(i.Layout))).ToList(), ct))))
            .WithName("saveDashboardLayout");

        return app;
    }

    private static Model.Dashboards.ItemLayout? Layout(ItemLayout? layout) =>
        layout is null ? null : new Model.Dashboards.ItemLayout(layout.X, layout.Y, layout.Width, layout.Height);

    private static ArtifactSummary Summary(ArtifactView view) => new()
    {
        Id = view.Artifact.Id,
        ConnectionId = view.Artifact.ConnectionId,
        Name = view.Artifact.Name,
        Kind = Kind(view),
        Status = Status(view.Status),
        CreatedAt = view.Artifact.CreatedAt,
    };

    private static Artifact Full(ArtifactView view) => new()
    {
        Id = view.Artifact.Id,
        ConnectionId = view.Artifact.ConnectionId,
        Name = view.Artifact.Name,
        Kind = Kind(view),
        Status = Status(view.Status),
        CreatedAt = view.Artifact.CreatedAt,
        Dsl = view.Dsl.Deserialize<DslDocument>()!,
        Sql = view.Artifact.Sql,
        Columns = [.. view.Columns.Select(c => new ColumnDefinition { Name = c.Name, SqlType = c.SqlType, Nullable = c.Nullable })],
    };

    private static ArtifactSummaryKind Kind(ArtifactView view) =>
        view.Artifact.Kind == Model.Artifacts.ArtifactKind.Kpi ? ArtifactSummaryKind.Kpi : ArtifactSummaryKind.Table;

    private static Contracts.ArtifactStatus Status(Application.Artifacts.ArtifactStatus status) => status switch
    {
        Application.Artifacts.ArtifactStatus.ConnectionUnavailable => Contracts.ArtifactStatus.ConnectionUnavailable,
        Application.Artifacts.ArtifactStatus.MigrationRequired => Contracts.ArtifactStatus.MigrationRequired,
        _ => Contracts.ArtifactStatus.Available,
    };

    private static Dashboard DashboardDto(DashboardView view) => new()
    {
        Id = view.Dashboard.Id,
        ConnectionId = view.Dashboard.ConnectionId,
        Name = view.Dashboard.Name,
        UpdatedAt = view.Dashboard.UpdatedAt,
        Items = [.. view.Items.Select(ItemDto)],
    };

    private static DashboardItem ItemDto(DashboardItemView view) => new()
    {
        Id = view.Item.Id,
        ArtifactId = view.Item.ArtifactId,
        Layout = new ItemLayout { X = view.Item.X, Y = view.Item.Y, Width = view.Item.Width, Height = view.Item.Height },
        Status = view.Status switch
        {
            Application.Dashboards.DashboardItemStatus.ConnectionUnavailable => Contracts.DashboardItemStatus.ConnectionUnavailable,
            Application.Dashboards.DashboardItemStatus.MigrationRequired => Contracts.DashboardItemStatus.MigrationRequired,
            Application.Dashboards.DashboardItemStatus.Missing => Contracts.DashboardItemStatus.Missing,
            _ => Contracts.DashboardItemStatus.Available,
        },
        Artifact = view.Artifact is null ? null : Full(view.Artifact),
    };
}
