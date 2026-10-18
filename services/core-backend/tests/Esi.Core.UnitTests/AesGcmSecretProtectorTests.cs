using System.Security.Cryptography;
using System.Text;
using Esi.Core.Application.Security;
using Esi.Core.Domain.Connections;
using Esi.Core.Infrastructure.Security;

namespace Esi.Core.UnitTests;

public class AesGcmSecretProtectorTests
{
    private const string Plain = "Server=db;Database=Sales;User Id=reader;Password=S3cret-Pa55!;";

    private static readonly byte[] Key1 = RandomNumberGenerator.GetBytes(32);
    private static readonly byte[] Key2 = RandomNumberGenerator.GetBytes(32);
    private static readonly SecretBinding Binding = new(Guid.NewGuid(), Guid.NewGuid());

    [Fact]
    public void Round_trip_returns_the_plaintext()
    {
        var protector = Protector(active: 1);

        var encrypted = protector.Protect(new SecretValue(Plain), Binding);

        Assert.Equal(Plain, protector.Unprotect(encrypted, Binding).Reveal());
        Assert.Equal(1, encrypted.KeyVersion);
        Assert.Equal(AesGcmSecretProtector.AlgorithmName, encrypted.Algorithm);
    }

    [Fact]
    public void Ciphertext_does_not_contain_the_plaintext_and_differs_per_encryption()
    {
        var protector = Protector(active: 1);

        var first = protector.Protect(new SecretValue(Plain), Binding);
        var second = protector.Protect(new SecretValue(Plain), Binding);

        Assert.DoesNotContain("S3cret", Encoding.UTF8.GetString(first.Ciphertext), StringComparison.Ordinal);
        Assert.NotEqual(first.Ciphertext, second.Ciphertext);
        Assert.NotEqual(first.WrappedDataKey, second.WrappedDataKey);
    }

    public static TheoryData<string> Tampered => ["ciphertext", "nonce", "tag", "wrapped-key"];

    [Theory]
    [MemberData(nameof(Tampered))]
    public void Tampering_is_detected(string part)
    {
        var protector = Protector(active: 1);
        var encrypted = protector.Protect(new SecretValue(Plain), Binding);
        var ciphertext = (byte[])encrypted.Ciphertext.Clone();
        var nonce = (byte[])encrypted.Nonce.Clone();
        var tag = (byte[])encrypted.Tag.Clone();
        var wrapped = (byte[])encrypted.WrappedDataKey.Clone();
        var target = part switch { "ciphertext" => ciphertext, "nonce" => nonce, "tag" => tag, _ => wrapped };
        target[^1] ^= 0x01;

        var tampered = new EncryptedSecret(ciphertext, nonce, tag, wrapped, encrypted.KeyVersion, encrypted.Algorithm);

        Assert.ThrowsAny<CryptographicException>(() => protector.Unprotect(tampered, Binding));
    }

    [Fact]
    public void A_secret_copied_to_another_connection_or_owner_cannot_be_decrypted()
    {
        var protector = Protector(active: 1);
        var encrypted = protector.Protect(new SecretValue(Plain), Binding);

        Assert.ThrowsAny<CryptographicException>(() => protector.Unprotect(encrypted, Binding with { ConnectionId = Guid.NewGuid() }));
        Assert.ThrowsAny<CryptographicException>(() => protector.Unprotect(encrypted, Binding with { OwnerId = Guid.NewGuid() }));
    }

    [Fact]
    public void A_missing_key_version_fails_without_revealing_anything()
    {
        var encrypted = Protector(active: 2).Protect(new SecretValue(Plain), Binding);
        var onlyVersion1 = new AesGcmSecretProtector(new MasterKeyRing(new Dictionary<int, byte[]> { [1] = Key1 }, 1));

        var error = Assert.ThrowsAny<CryptographicException>(() => onlyVersion1.Unprotect(encrypted, Binding));

        Assert.DoesNotContain("S3cret", error.Message, StringComparison.Ordinal);
    }

    [Fact]
    public void Rotation_rewraps_the_data_key_and_keeps_decryption_working()
    {
        var encrypted = Protector(active: 1).Protect(new SecretValue(Plain), Binding);
        var rotated = Protector(active: 2);

        var rewrapped = rotated.Rewrap(encrypted, Binding);

        Assert.Equal(2, rewrapped.KeyVersion);
        Assert.Equal(encrypted.Ciphertext, rewrapped.Ciphertext);
        Assert.Equal(Plain, rotated.Unprotect(rewrapped, Binding).Reveal());
        var onlyVersion2 = new AesGcmSecretProtector(new MasterKeyRing(new Dictionary<int, byte[]> { [2] = Key2 }, 2));
        Assert.Equal(Plain, onlyVersion2.Unprotect(rewrapped, Binding).Reveal());
    }

    private static AesGcmSecretProtector Protector(int active) =>
        new(new MasterKeyRing(new Dictionary<int, byte[]> { [1] = Key1, [2] = Key2 }, active));
}
