using System.Text.Json;
using Esi.Core.Api.Contracts;
using Esi.Core.Application.Chat;
using Esi.Core.Application.Queries;
using Esi.Core.Application.Scripts;
using Esi.Core.Application.Visualizations;
using Model = Esi.Core.Domain;

namespace Esi.Core.Api.Endpoints;

internal static class ChatEndpoints
{
    public static IEndpointRouteBuilder MapChatEndpoints(this IEndpointRouteBuilder app)
    {
        var chat = app.MapGroup(string.Empty).WithTags("Chat");

        chat.MapGet("/connections/{connectionId:guid}/chat-sessions", async (Guid connectionId, ChatService service, CancellationToken ct) =>
                Results.Ok((await service.ListAsync(connectionId, ct)).Select(Summary)))
            .WithName("listChatSessions");

        chat.MapPost("/connections/{connectionId:guid}/chat-sessions", async (Guid connectionId, CreateChatSessionRequest? request, ChatService service, CancellationToken ct) =>
            {
                var session = await service.CreateAsync(connectionId, request?.Title, ct);
                return Results.Created($"/chat-sessions/{session.Id}", Session(session, []));
            })
            .WithName("createChatSession");

        chat.MapGet("/chat-sessions/{sessionId:guid}", async (Guid sessionId, ChatService service, CancellationToken ct) =>
            {
                var (session, messages) = await service.GetAsync(sessionId, ct);
                return Results.Ok(Session(session, messages));
            })
            .WithName("getChatSession");

        chat.MapPost("/chat-sessions/{sessionId:guid}/messages", async (Guid sessionId, SendChatMessageRequest? request, ChatService service, CancellationToken ct) =>
            {
                var turn = await service.AskAsync(sessionId, request?.Text, ct);
                return Results.Created($"/chat-sessions/{sessionId}", new ChatTurn { Question = Message(turn.Question), Answer = Message(turn.Answer) });
            })
            .WithName("sendChatMessage");

        chat.MapPost("/chat-sessions/{sessionId:guid}/visualizations", async (Guid sessionId, CreateVisualizationRequest? request, VisualizationService service, CancellationToken ct) =>
            {
                var columns = request?.Columns?.Select(c => new ResultColumn(c.Name, c.SqlType, c.Nullable)).ToList();
                var kind = request?.Intent?.Kind switch
                {
                    null => null,
                    VisualizationIntentKind.Table => "table",
                    VisualizationIntentKind.Kpi => "kpi",
                    VisualizationIntentKind.Chart => "chart",
                    // A value this contract version does not name is refused by the service, never mapped to a table.
                    var other => other.ToString(),
                };
                var dsl = await service.CreateAsync(sessionId, columns, kind, request?.Intent?.Description, ct);
                return Results.Ok(new Visualization { Dsl = dsl.Deserialize<DslDocument>()!, Columns = request!.Columns });
            })
            .WithName("createVisualization");

        var scripts = app.MapGroup(string.Empty).WithTags("Scripts");

        scripts.MapGet("/connections/{connectionId:guid}/scripts", async (Guid connectionId, ScriptService service, CancellationToken ct) =>
                Results.Ok((await service.ListAsync(connectionId, ct)).Select(ScriptDto)))
            .WithName("listScripts");

        scripts.MapGet("/scripts/{scriptId:guid}", async (Guid scriptId, ScriptService service, CancellationToken ct) =>
                Results.Ok(ScriptDto(await service.GetAsync(scriptId, ct))))
            .WithName("getScript");

        scripts.MapDelete("/scripts/{scriptId:guid}", async (Guid scriptId, ScriptService service, CancellationToken ct) =>
            {
                await service.DeleteAsync(scriptId, ct);
                return Results.NoContent();
            })
            .WithName("deleteScript");

        return app;
    }

    private static ChatSessionSummary Summary(Model.Chat.ChatSession session) => new()
    {
        Id = session.Id,
        ConnectionId = session.ConnectionId,
        Title = session.Title,
        CreatedAt = session.CreatedAt,
        LastActivityAt = session.LastActivityAt,
    };

    private static ChatSession Session(Model.Chat.ChatSession session, IReadOnlyList<Model.Chat.ChatMessage> messages) => new()
    {
        Id = session.Id,
        ConnectionId = session.ConnectionId,
        Title = session.Title,
        CreatedAt = session.CreatedAt,
        LastActivityAt = session.LastActivityAt,
        Messages = [.. messages.Select(Message)],
    };

    private static ChatMessage Message(Model.Chat.ChatMessage message) => new()
    {
        Id = message.Id,
        Role = message.Role == Model.Chat.ChatRole.User ? ChatMessageRole.User : ChatMessageRole.Assistant,
        Text = message.Text,
        CreatedAt = message.CreatedAt,
        GeneratedSql = message.GeneratedSql is not { } sql ? null : new GeneratedSql
        {
            Kind = sql.Kind switch
            {
                Model.Chat.SqlKind.Query => SqlOutputKind.Query,
                Model.Chat.SqlKind.StoredProcedure => SqlOutputKind.StoredProcedure,
                _ => SqlOutputKind.None,
            },
            Sql = sql.Sql,
            ReferencedTables = [.. sql.ReferencedTables],
            SavedScriptId = sql.SavedScriptId,
        },
    };

    private static Script ScriptDto(Model.Scripts.Script script) => new()
    {
        Id = script.Id,
        ConnectionId = script.ConnectionId,
        Name = script.Name,
        Sql = script.Sql,
        SessionId = script.SessionId,
        CreatedAt = script.CreatedAt,
    };
}
