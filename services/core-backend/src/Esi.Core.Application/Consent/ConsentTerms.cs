namespace Esi.Core.Application.Consent;

public enum ConsentTermsStatus
{
    Draft = 0,
    Approved = 1,
}

public sealed record ConsentTerms(string Version, string Text, ConsentTermsStatus Status, DateTimeOffset PublishedAt);

public interface IConsentTermsProvider
{
    ConsentTerms Current { get; }
}
