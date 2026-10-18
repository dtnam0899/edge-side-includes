using System.Security.Cryptography;
using System.Text;
using Esi.Core.Application.Security;
using Esi.Core.Domain.Connections;

namespace Esi.Core.Infrastructure.Security;

/// <summary>
/// Envelope encryption (ADR-0003): a fresh 256-bit data key encrypts the secret with AES-256-GCM; the data key is
/// wrapped with AES-256-GCM under the active master key. Both steps authenticate associated data that binds the
/// blob to its connection and owner. Plaintext keys are zeroed after use.
/// </summary>
public sealed class AesGcmSecretProtector(MasterKeyRing keys) : ISecretProtector
{
    public const string AlgorithmName = "AES-256-GCM+AES-256-GCM-WRAP/v1";

    private const int NonceSize = 12;
    private const int TagSize = 16;

    public EncryptedSecret Protect(SecretValue secret, SecretBinding binding)
    {
        var aad = AssociatedData(binding);
        var dataKey = RandomNumberGenerator.GetBytes(MasterKeyRing.KeySize);
        var plaintext = Encoding.UTF8.GetBytes(secret.Reveal());
        try
        {
            var nonce = RandomNumberGenerator.GetBytes(NonceSize);
            var ciphertext = new byte[plaintext.Length];
            var tag = new byte[TagSize];
            using (var aes = new AesGcm(dataKey, TagSize))
            {
                aes.Encrypt(nonce, plaintext, ciphertext, tag, aad);
            }

            return new EncryptedSecret(ciphertext, nonce, tag, Wrap(dataKey, keys.Active, aad), keys.ActiveVersion, AlgorithmName);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(dataKey);
            CryptographicOperations.ZeroMemory(plaintext);
        }
    }

    public SecretValue Unprotect(EncryptedSecret secret, SecretBinding binding)
    {
        EnsureAlgorithm(secret);
        var aad = AssociatedData(binding);
        var dataKey = Unwrap(secret, aad);
        var plaintext = new byte[secret.Ciphertext.Length];
        try
        {
            using (var aes = new AesGcm(dataKey, TagSize))
            {
                aes.Decrypt(secret.Nonce, secret.Ciphertext, secret.Tag, plaintext, aad);
            }

            return new SecretValue(Encoding.UTF8.GetString(plaintext));
        }
        finally
        {
            CryptographicOperations.ZeroMemory(dataKey);
            CryptographicOperations.ZeroMemory(plaintext);
        }
    }

    public EncryptedSecret Rewrap(EncryptedSecret secret, SecretBinding binding)
    {
        EnsureAlgorithm(secret);
        var aad = AssociatedData(binding);
        var dataKey = Unwrap(secret, aad);
        try
        {
            return new EncryptedSecret(
                secret.Ciphertext, secret.Nonce, secret.Tag, Wrap(dataKey, keys.Active, aad), keys.ActiveVersion, AlgorithmName);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(dataKey);
        }
    }

    private static byte[] AssociatedData(SecretBinding binding) =>
        Encoding.UTF8.GetBytes($"esi-connection-secret|{binding.ConnectionId:N}|{binding.OwnerId:N}");

    private static byte[] Wrap(byte[] dataKey, byte[] masterKey, byte[] aad)
    {
        // Layout: nonce (12) | encrypted data key (32) | tag (16)
        var wrapped = new byte[NonceSize + dataKey.Length + TagSize];
        var nonce = wrapped.AsSpan(0, NonceSize);
        RandomNumberGenerator.Fill(nonce);
        using var aes = new AesGcm(masterKey, TagSize);
        aes.Encrypt(nonce, dataKey, wrapped.AsSpan(NonceSize, dataKey.Length), wrapped.AsSpan(NonceSize + dataKey.Length), aad);
        return wrapped;
    }

    private byte[] Unwrap(EncryptedSecret secret, byte[] aad)
    {
        var masterKey = keys.Find(secret.KeyVersion)
            ?? throw new CryptographicException($"Master key version {secret.KeyVersion} is not available.");
        var wrapped = secret.WrappedDataKey;
        if (wrapped.Length != NonceSize + MasterKeyRing.KeySize + TagSize)
        {
            throw new CryptographicException("The wrapped data key has an unexpected length.");
        }

        var dataKey = new byte[MasterKeyRing.KeySize];
        using var aes = new AesGcm(masterKey, TagSize);
        aes.Decrypt(
            wrapped.AsSpan(0, NonceSize),
            wrapped.AsSpan(NonceSize, MasterKeyRing.KeySize),
            wrapped.AsSpan(NonceSize + MasterKeyRing.KeySize),
            dataKey,
            aad);
        return dataKey;
    }

    private static void EnsureAlgorithm(EncryptedSecret secret)
    {
        if (!string.Equals(secret.Algorithm, AlgorithmName, StringComparison.Ordinal))
        {
            throw new CryptographicException($"Unsupported secret algorithm '{secret.Algorithm}'.");
        }
    }
}
