using Microsoft.Extensions.Configuration;

namespace Esi.Core.Infrastructure.Security;

/// <summary>
/// Versioned master keys from configuration (environment variables, ADR-0003):
/// <c>ESI_CORE_Encryption__MasterKeys__&lt;version&gt;</c> = base64 of 32 random bytes, and
/// <c>ESI_CORE_Encryption__ActiveKeyVersion</c> = the version used for new secrets. Older versions stay for decryption.
/// </summary>
public sealed class MasterKeyRing
{
    public const string Section = "Encryption";
    public const int KeySize = 32;

    private readonly Dictionary<int, byte[]> _keys;

    public MasterKeyRing(IReadOnlyDictionary<int, byte[]> keys, int activeVersion)
    {
        if (keys.Count == 0)
        {
            throw new InvalidOperationException("No master key is configured (ESI_CORE_Encryption__MasterKeys__<version>).");
        }

        foreach (var (version, key) in keys)
        {
            if (key.Length != KeySize)
            {
                throw new InvalidOperationException($"Master key version {version} must be {KeySize} bytes.");
            }
        }

        if (!keys.ContainsKey(activeVersion))
        {
            throw new InvalidOperationException($"The active master key version {activeVersion} is not configured.");
        }

        _keys = keys.ToDictionary(k => k.Key, k => k.Value);
        ActiveVersion = activeVersion;
    }

    public int ActiveVersion { get; }

    public byte[] Active => _keys[ActiveVersion];

    public byte[]? Find(int version) => _keys.GetValueOrDefault(version);

    public static MasterKeyRing FromConfiguration(IConfiguration configuration)
    {
        var section = configuration.GetSection(Section);
        var keys = new Dictionary<int, byte[]>();
        foreach (var child in section.GetSection("MasterKeys").GetChildren())
        {
            if (!int.TryParse(child.Key, out var version) || version < 1)
            {
                throw new InvalidOperationException($"Master key name '{child.Key}' must be a positive version number.");
            }

            try
            {
                keys[version] = Convert.FromBase64String(child.Value ?? string.Empty);
            }
            catch (FormatException)
            {
                throw new InvalidOperationException($"Master key version {version} is not valid base64.");
            }
        }

        if (!int.TryParse(section["ActiveKeyVersion"], out var active))
        {
            throw new InvalidOperationException("ESI_CORE_Encryption__ActiveKeyVersion is not set.");
        }

        return new MasterKeyRing(keys, active);
    }
}
