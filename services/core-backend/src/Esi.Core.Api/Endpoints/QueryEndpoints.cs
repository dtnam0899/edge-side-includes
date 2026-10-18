using Esi.Core.Api.Contracts;
using Esi.Core.Application.Queries;
using Esi.Core.Application.Schema;
using Model = Esi.Core.Domain.Schema;

namespace Esi.Core.Api.Endpoints;

internal static class QueryEndpoints
{
    public static IEndpointRouteBuilder MapQueryEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/connections/{connectionId:guid}/schema", async (Guid connectionId, SchemaService service, CancellationToken ct) =>
                Results.Ok(ToContract(await service.GetAsync(connectionId, ct))))
            .WithTags("Schema")
            .WithName("getConnectionSchema");

        app.MapPost("/connections/{connectionId:guid}/executions", async (Guid connectionId, ExecuteQueryRequest? request, QueryService service, CancellationToken ct) =>
                Results.Ok(ToContract(await service.ExecuteAsync(connectionId, request?.Sql, request?.Page, ct))))
            .WithTags("Executions")
            .WithName("executeQuery");

        return app;
    }

    private static SchemaMetadata ToContract(Model.SchemaMetadata schema) => new()
    {
        Schemas = [.. schema.Schemas.Select(s => new DatabaseSchema
        {
            Name = s.Name,
            Tables = [.. s.Tables.Select(t => new TableMetadata
            {
                Name = t.Name,
                Kind = t.Kind == Model.TableKind.View ? TableMetadataKind.View : TableMetadataKind.Table,
                Columns = [.. t.Columns.Select(c => new ColumnDefinition { Name = c.Name, SqlType = c.SqlType, Nullable = c.Nullable })],
                PrimaryKey = [.. t.PrimaryKey],
                ForeignKeys = [.. t.ForeignKeys.Select(f => new ForeignKey
                {
                    Name = f.Name,
                    Columns = [.. f.Columns],
                    ReferencedSchema = f.ReferencedSchema,
                    ReferencedTable = f.ReferencedTable,
                    ReferencedColumns = [.. f.ReferencedColumns],
                })],
            })],
            Procedures = [.. s.Procedures.Select(p => new ProcedureMetadata { Name = p.Name, Definition = p.Definition })],
        })],
    };

    internal static QueryResult ToContract(QueryPage page) => new()
    {
        Columns = [.. page.Columns.Select(c => new ColumnDefinition { Name = c.Name, SqlType = c.SqlType, Nullable = c.Nullable })],
        Rows = [.. page.Rows.Cast<object>()],
        Page = new PageInfo { Number = page.PageNumber, Size = page.PageSize, RemainingRows = page.RemainingRows },
        TruncatedCells = [.. page.TruncatedCells.Select(c => new Contracts.CellRef { RowIndex = c.RowIndex, Column = c.Column })],
        DurationMs = page.DurationMs,
    };
}
