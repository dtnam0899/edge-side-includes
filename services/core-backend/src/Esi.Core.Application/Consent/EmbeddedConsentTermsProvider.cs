namespace Esi.Core.Application.Consent;

/// <summary>
/// The current consent terms, shipped with the application as Markdown (`Consent/Terms/&lt;version&gt;.md`). A new
/// version is a new file plus a change of <see cref="CurrentVersion"/>; users then accept again (SR-1).
/// </summary>
public sealed class EmbeddedConsentTermsProvider : IConsentTermsProvider
{
    public const string CurrentVersion = "2026-10-18.1";

    private static readonly DateTimeOffset PublishedAt = new(2026, 10, 18, 0, 0, 0, TimeSpan.Zero);

    public EmbeddedConsentTermsProvider()
    {
        using var stream = typeof(EmbeddedConsentTermsProvider).Assembly.GetManifestResourceStream($"ConsentTerms.{CurrentVersion}.md")
            ?? throw new InvalidOperationException($"Consent terms {CurrentVersion} are not embedded.");
        using var reader = new StreamReader(stream);
        Current = new ConsentTerms(CurrentVersion, reader.ReadToEnd(), ConsentTermsStatus.Draft, PublishedAt);
    }

    public ConsentTerms Current { get; }
}
