namespace Esi.Core.Domain.Schema;

/// <summary>Structure of a user's database as read by core: no row values and no connection details.</summary>
public sealed record SchemaMetadata(IReadOnlyList<DatabaseSchema> Schemas);

public sealed record DatabaseSchema(string Name, IReadOnlyList<TableMetadata> Tables, IReadOnlyList<ProcedureMetadata> Procedures);

public enum TableKind
{
    Table = 0,
    View = 1,
}

public sealed record TableMetadata(
    string Name,
    TableKind Kind,
    IReadOnlyList<ColumnMetadata> Columns,
    IReadOnlyList<string> PrimaryKey,
    IReadOnlyList<ForeignKeyMetadata> ForeignKeys);

public sealed record ColumnMetadata(string Name, string SqlType, bool Nullable);

public sealed record ForeignKeyMetadata(
    string Name, IReadOnlyList<string> Columns, string ReferencedSchema, string ReferencedTable, IReadOnlyList<string> ReferencedColumns);

/// <summary>An existing stored procedure; its definition is read as context and never executed.</summary>
public sealed record ProcedureMetadata(string Name, string Definition);
