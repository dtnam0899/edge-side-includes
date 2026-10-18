namespace Esi.Core.Application.Security;

/// <summary>
/// A plaintext secret (a connection string) held only for the moment of use. <see cref="ToString"/> never reveals
/// it, so accidental logging or interpolation prints a mask (ADR-0003).
/// </summary>
public sealed class SecretValue
{
    private readonly string _value;

    public SecretValue(string value) => _value = value;

    public string Reveal() => _value;

    public override string ToString() => "***";
}
