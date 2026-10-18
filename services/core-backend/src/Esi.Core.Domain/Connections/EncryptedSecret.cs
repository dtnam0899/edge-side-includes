namespace Esi.Core.Domain.Connections;

/// <summary>
/// A connection string encrypted with envelope encryption (ADR-0003): the secret is encrypted with a per-secret
/// data key, and the data key is wrapped by the master key of <see cref="KeyVersion"/>.
/// </summary>
public sealed class EncryptedSecret
{
    public EncryptedSecret(byte[] ciphertext, byte[] nonce, byte[] tag, byte[] wrappedDataKey, int keyVersion, string algorithm)
    {
        Ciphertext = ciphertext;
        Nonce = nonce;
        Tag = tag;
        WrappedDataKey = wrappedDataKey;
        KeyVersion = keyVersion;
        Algorithm = algorithm;
    }

    public byte[] Ciphertext { get; private set; }

    public byte[] Nonce { get; private set; }

    public byte[] Tag { get; private set; }

    /// <summary>Nonce, encrypted data key and tag of the key-wrapping step.</summary>
    public byte[] WrappedDataKey { get; private set; }

    public int KeyVersion { get; private set; }

    public string Algorithm { get; private set; }
}
