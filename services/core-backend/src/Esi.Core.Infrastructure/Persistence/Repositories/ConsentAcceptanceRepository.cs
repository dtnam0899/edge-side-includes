using Esi.Core.Application.Consent;
using Esi.Core.Domain.Consent;
using Microsoft.EntityFrameworkCore;

namespace Esi.Core.Infrastructure.Persistence.Repositories;

public sealed class ConsentAcceptanceRepository(AppDbContext db) : IConsentAcceptanceRepository
{
    public Task<ConsentAcceptance?> FindLatestAsync(Guid userId, CancellationToken cancellationToken) =>
        db.ConsentAcceptances.Where(a => a.UserId == userId).OrderByDescending(a => a.AcceptedAt).FirstOrDefaultAsync(cancellationToken);

    public void Add(ConsentAcceptance acceptance) => db.ConsentAcceptances.Add(acceptance);

    public Task SaveChangesAsync(CancellationToken cancellationToken) => db.SaveChangesAsync(cancellationToken);
}
