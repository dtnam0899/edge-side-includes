using Esi.Core.Domain.Artifacts;
using Esi.Core.Domain.Dashboards;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Esi.Core.Infrastructure.Persistence.Configurations;

public sealed class ArtifactConfiguration : IEntityTypeConfiguration<Artifact>
{
    public void Configure(EntityTypeBuilder<Artifact> builder)
    {
        builder.ToTable("Artifacts");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Property(a => a.Name).HasMaxLength(Artifact.MaxNameLength).IsRequired();
        builder.Property(a => a.Kind).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.Property(a => a.DslJson).IsRequired();
        builder.Property(a => a.DslSchemaVersion).HasMaxLength(50).IsRequired();
        builder.Property(a => a.Sql).IsRequired();
        builder.Property(a => a.ColumnsJson).IsRequired();

        // No foreign key to Connections: a deleted connection leaves its artifacts, shown as connection-unavailable.
        builder.HasIndex(a => new { a.OwnerId, a.ConnectionId, a.CreatedAt });
    }
}

public sealed class DashboardConfiguration : IEntityTypeConfiguration<Dashboard>
{
    public void Configure(EntityTypeBuilder<Dashboard> builder)
    {
        builder.ToTable("Dashboards");
        builder.HasKey(d => d.Id);
        builder.Property(d => d.Id).ValueGeneratedNever();
        builder.Property(d => d.Name).HasMaxLength(Dashboard.MaxNameLength).IsRequired();
        builder.HasIndex(d => new { d.OwnerId, d.ConnectionId, d.UpdatedAt });

        // Items keep the artifact id without a foreign key: a deleted artifact shows as a missing item.
        builder.OwnsMany(d => d.Items, item =>
        {
            item.ToTable("DashboardItems");
            item.WithOwner().HasForeignKey(i => i.DashboardId);
            item.HasKey(i => i.Id);
            item.Property(i => i.Id).ValueGeneratedNever();
            item.Ignore(i => i.Layout);
        });
        builder.Navigation(d => d.Items).UsePropertyAccessMode(PropertyAccessMode.Field);
    }
}
