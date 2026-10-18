using Esi.Core.Api.Contracts;
using Esi.Core.Application.Connections;

namespace Esi.Core.Api.Endpoints;

internal static class ConnectionEndpoints
{
    public static IEndpointRouteBuilder MapConnectionEndpoints(this IEndpointRouteBuilder app)
    {
        var connections = app.MapGroup("/connections").WithTags("Connections");

        connections.MapGet("/", async (ConnectionService service, CancellationToken ct) =>
                Results.Ok((await service.ListAsync(ct)).Select(c => c.ToContract())))
            .WithName("listConnections");

        connections.MapPost("/", async (CreateConnectionRequest? request, ConnectionService service, CancellationToken ct) =>
            {
                var created = await service.CreateAsync(request?.Name, request?.ConnectionString, ct);
                return Results.Created($"/connections/{created.Id}", created.ToContract());
            })
            .WithName("createConnection");

        connections.MapGet("/{connectionId:guid}", async (Guid connectionId, ConnectionService service, CancellationToken ct) =>
                Results.Ok((await service.GetAsync(connectionId, ct)).ToContract()))
            .WithName("getConnection");

        connections.MapPut("/{connectionId:guid}", async (Guid connectionId, UpdateConnectionRequest? request, ConnectionService service, CancellationToken ct) =>
                Results.Ok((await service.UpdateAsync(connectionId, request?.Name, request?.ConnectionString, ct)).ToContract()))
            .WithName("updateConnection");

        connections.MapDelete("/{connectionId:guid}", async (Guid connectionId, ConnectionService service, CancellationToken ct) =>
            {
                await service.DeleteAsync(connectionId, ct);
                return Results.NoContent();
            })
            .WithName("deleteConnection");

        connections.MapPost("/{connectionId:guid}/test", async (Guid connectionId, ConnectionService service, CancellationToken ct) =>
            {
                var result = await service.TestAsync(connectionId, ct);
                return Results.Ok(new ConnectionTestResult { ServerVersion = result.ServerVersion ?? string.Empty, DurationMs = result.DurationMs });
            })
            .WithName("testConnection");

        var consent = app.MapGroup("/connections/{connectionId:guid}/consent").WithTags("Consent");

        consent.MapPut("/", async (Guid connectionId, ConnectionService service, CancellationToken ct) =>
                Results.Ok((await service.GrantConsentAsync(connectionId, ct)).ToContract()))
            .WithName("grantConnectionConsent");

        consent.MapDelete("/", async (Guid connectionId, ConnectionService service, CancellationToken ct) =>
            {
                await service.WithdrawConsentAsync(connectionId, ct);
                return Results.NoContent();
            })
            .WithName("withdrawConnectionConsent");

        return app;
    }
}
