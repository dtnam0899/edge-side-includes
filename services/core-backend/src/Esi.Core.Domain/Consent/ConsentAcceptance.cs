namespace Esi.Core.Domain.Consent;

/// <summary>A user's acceptance of one version of the consent terms (who, which version, when).</summary>
public sealed class ConsentAcceptance
{
    public const int MaxVersionLength = 50;

    private ConsentAcceptance()
    {
        TermsVersion = string.Empty;
    }

    public ConsentAcceptance(Guid id, Guid userId, string termsVersion, DateTimeOffset acceptedAt)
    {
        Id = id;
        UserId = userId;
        TermsVersion = termsVersion;
        AcceptedAt = acceptedAt;
    }

    public Guid Id { get; private set; }

    public Guid UserId { get; private set; }

    public string TermsVersion { get; private set; }

    public DateTimeOffset AcceptedAt { get; private set; }
}
