using Esi.Core.Domain.Connections;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Esi.Core.Infrastructure.Persistence.Configurations;

public sealed class ConnectionConfiguration : IEntityTypeConfiguration<Connection>
{
    public void Configure(EntityTypeBuilder<Connection> builder)
    {
        builder.ToTable("Connections");
        builder.HasKey(c => c.Id);
        builder.Property(c => c.Id).ValueGeneratedNever();
        builder.Property(c => c.Name).HasMaxLength(Connection.MaxNameLength).IsRequired();
        builder.Property(c => c.Server).HasMaxLength(400).IsRequired();
        builder.Property(c => c.Database).HasMaxLength(256).IsRequired();
        builder.Property(c => c.Consent).HasConversion<string>().HasMaxLength(20).IsRequired();
        builder.HasIndex(c => c.OwnerId);

        // ADR-0003: the encrypted secret and its wrapped data key live in the connection row.
        builder.OwnsOne(c => c.Secret, secret =>
        {
            secret.Property(s => s.Ciphertext).HasColumnName("SecretCiphertext").IsRequired();
            secret.Property(s => s.Nonce).HasColumnName("SecretNonce").HasMaxLength(12).IsRequired();
            secret.Property(s => s.Tag).HasColumnName("SecretTag").HasMaxLength(16).IsRequired();
            secret.Property(s => s.WrappedDataKey).HasColumnName("SecretWrappedDataKey").HasMaxLength(60).IsRequired();
            secret.Property(s => s.KeyVersion).HasColumnName("SecretKeyVersion").IsRequired();
            secret.Property(s => s.Algorithm).HasColumnName("SecretAlgorithm").HasMaxLength(64).IsRequired();
        });
        builder.Navigation(c => c.Secret).IsRequired();
    }
}
