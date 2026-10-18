using System.Text.Json;
using Esi.Core.Domain.Chat;
using Esi.Core.Domain.Scripts;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Esi.Core.Infrastructure.Persistence.Configurations;

public sealed class ChatSessionConfiguration : IEntityTypeConfiguration<ChatSession>
{
    public void Configure(EntityTypeBuilder<ChatSession> builder)
    {
        builder.ToTable("ChatSessions");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.Title).HasMaxLength(ChatSession.MaxTitleLength).IsRequired();
        builder.HasIndex(s => new { s.OwnerId, s.ConnectionId, s.LastActivityAt });
    }
}

public sealed class ChatMessageConfiguration : IEntityTypeConfiguration<ChatMessage>
{
    public void Configure(EntityTypeBuilder<ChatMessage> builder)
    {
        builder.ToTable("ChatMessages");
        builder.HasKey(m => m.Id);
        builder.Property(m => m.Id).ValueGeneratedNever();
        builder.Property(m => m.Role).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(m => m.Text).IsRequired();
        builder.HasIndex(m => new { m.SessionId, m.CreatedAt });
        builder.HasOne<ChatSession>().WithMany().HasForeignKey(m => m.SessionId).OnDelete(DeleteBehavior.Cascade);
        builder.OwnsOne(m => m.GeneratedSql, sql =>
        {
            sql.Property(s => s.Kind).HasColumnName("SqlKind").HasConversion<string>().HasMaxLength(20);
            sql.Property(s => s.Sql).HasColumnName("SqlText");
            sql.Property(s => s.SavedScriptId).HasColumnName("SavedScriptId");
            sql.Property(s => s.ReferencedTables)
                .HasColumnName("ReferencedTables")
                .HasConversion(
                    tables => JsonSerializer.Serialize(tables, (JsonSerializerOptions?)null),
                    json => JsonSerializer.Deserialize<List<string>>(json, (JsonSerializerOptions?)null) ?? new List<string>(),
                    new ValueComparer<IReadOnlyList<string>>((a, b) => a!.SequenceEqual(b!), t => t.Aggregate(0, (h, s) => HashCode.Combine(h, s)), t => t.ToList()));
        });
    }
}

public sealed class ScriptConfiguration : IEntityTypeConfiguration<Script>
{
    public void Configure(EntityTypeBuilder<Script> builder)
    {
        builder.ToTable("Scripts");
        builder.HasKey(s => s.Id);
        builder.Property(s => s.Id).ValueGeneratedNever();
        builder.Property(s => s.Name).HasMaxLength(Script.MaxNameLength).IsRequired();
        builder.Property(s => s.Sql).IsRequired();
        builder.HasIndex(s => new { s.OwnerId, s.ConnectionId, s.CreatedAt });
    }
}
