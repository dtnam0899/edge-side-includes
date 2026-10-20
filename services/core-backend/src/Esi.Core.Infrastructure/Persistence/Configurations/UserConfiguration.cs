using Esi.Core.Domain.Users;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Esi.Core.Infrastructure.Persistence.Configurations;

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("Users");
        builder.HasKey(u => u.Id);
        builder.Property(u => u.Id).ValueGeneratedNever();
        builder.Property(u => u.Issuer).HasMaxLength(User.MaxIssuerLength).IsRequired();
        builder.Property(u => u.Subject).HasMaxLength(User.MaxSubjectLength).IsRequired();
        builder.HasIndex(u => new { u.Issuer, u.Subject }).IsUnique();
    }
}
