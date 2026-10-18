using Esi.Core.Domain.Consent;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Esi.Core.Infrastructure.Persistence.Configurations;

public sealed class ConsentAcceptanceConfiguration : IEntityTypeConfiguration<ConsentAcceptance>
{
    public void Configure(EntityTypeBuilder<ConsentAcceptance> builder)
    {
        builder.ToTable("ConsentAcceptances");
        builder.HasKey(a => a.Id);
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Property(a => a.TermsVersion).HasMaxLength(ConsentAcceptance.MaxVersionLength).IsRequired();
        builder.HasIndex(a => new { a.UserId, a.AcceptedAt });
    }
}
