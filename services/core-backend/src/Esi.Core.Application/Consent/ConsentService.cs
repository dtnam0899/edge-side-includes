using Esi.Core.Application.Abstractions;
using Esi.Core.Application.Problems;
using Esi.Core.Domain.Consent;

namespace Esi.Core.Application.Consent;

public sealed record ConsentAcceptanceView(string TermsVersion, DateTimeOffset AcceptedAt, bool IsCurrent);

public sealed class ConsentService(
    ICurrentUser user,
    IConsentTermsProvider terms,
    IConsentAcceptanceRepository acceptances,
    TimeProvider clock)
{
    public ConsentTerms GetCurrentTerms() => terms.Current;

    public async Task<ConsentAcceptanceView> GetAcceptanceAsync(CancellationToken cancellationToken)
    {
        var latest = await acceptances.FindLatestAsync(user.UserId, cancellationToken)
            ?? throw EsiProblem.NotFound("A consent acceptance");
        return View(latest);
    }

    public async Task<ConsentAcceptanceView> AcceptAsync(string termsVersion, CancellationToken cancellationToken)
    {
        var current = terms.Current.Version;
        if (!string.Equals(termsVersion, current, StringComparison.Ordinal))
        {
            throw EsiProblem.TermsVersionOutdated(current);
        }

        var acceptance = new ConsentAcceptance(Guid.NewGuid(), user.UserId, current, clock.GetUtcNow());
        acceptances.Add(acceptance);
        await acceptances.SaveChangesAsync(cancellationToken);
        return View(acceptance);
    }

    /// <summary>Throws <c>consent-required</c> unless the user accepted the current terms version.</summary>
    public async Task EnsureCurrentTermsAcceptedAsync(CancellationToken cancellationToken)
    {
        var latest = await acceptances.FindLatestAsync(user.UserId, cancellationToken);
        if (latest is null || !IsCurrent(latest))
        {
            throw EsiProblem.ConsentRequired();
        }
    }

    private bool IsCurrent(ConsentAcceptance acceptance) =>
        string.Equals(acceptance.TermsVersion, terms.Current.Version, StringComparison.Ordinal);

    private ConsentAcceptanceView View(ConsentAcceptance acceptance) =>
        new(acceptance.TermsVersion, acceptance.AcceptedAt, IsCurrent(acceptance));
}
