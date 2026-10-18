using Esi.Core.Domain.Consent;

namespace Esi.Core.Application.Consent;

public interface IConsentAcceptanceRepository
{
    Task<ConsentAcceptance?> FindLatestAsync(Guid userId, CancellationToken cancellationToken);

    void Add(ConsentAcceptance acceptance);

    Task SaveChangesAsync(CancellationToken cancellationToken);
}
