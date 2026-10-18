using Esi.Core.Domain.Connections;

namespace Esi.Core.Application.Security;

/// <summary>What an encrypted secret is bound to; a blob copied to another connection or owner cannot be decrypted.</summary>
public readonly record struct SecretBinding(Guid ConnectionId, Guid OwnerId);

/// <summary>Envelope encryption of secrets. Hides key lookup so a managed key store can replace it later.</summary>
public interface ISecretProtector
{
    EncryptedSecret Protect(SecretValue secret, SecretBinding binding);

    SecretValue Unprotect(EncryptedSecret secret, SecretBinding binding);

    /// <summary>Re-wraps the data key with the active master key (rotation); the secret ciphertext is unchanged.</summary>
    EncryptedSecret Rewrap(EncryptedSecret secret, SecretBinding binding);
}
