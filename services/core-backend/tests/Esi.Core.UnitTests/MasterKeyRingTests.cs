using Esi.Core.Infrastructure.Security;
using Microsoft.Extensions.Configuration;

namespace Esi.Core.UnitTests;

public class MasterKeyRingTests
{
    [Fact]
    public void Reads_versions_and_the_active_key_from_configuration()
    {
        var ring = MasterKeyRing.FromConfiguration(Config(("Encryption:ActiveKeyVersion", "2"),
            ("Encryption:MasterKeys:1", Convert.ToBase64String(new byte[32])),
            ("Encryption:MasterKeys:2", Convert.ToBase64String(Enumerable.Repeat((byte)7, 32).ToArray()))));

        Assert.Equal(2, ring.ActiveVersion);
        Assert.NotNull(ring.Find(1));
        Assert.Null(ring.Find(3));
    }

    [Theory]
    [InlineData(null, "AAAA")]
    [InlineData("1", null)]
    [InlineData("1", "not base64!")]
    [InlineData("1", "AAAA")]
    [InlineData("2", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")]
    public void Invalid_configuration_fails_at_startup(string? active, string? key)
    {
        var values = new List<(string, string?)> { ("Encryption:ActiveKeyVersion", active) };
        if (key is not null)
        {
            values.Add(("Encryption:MasterKeys:1", key));
        }

        Assert.Throws<InvalidOperationException>(() => MasterKeyRing.FromConfiguration(Config([.. values])));
    }

    private static IConfiguration Config(params (string Key, string? Value)[] values) =>
        new ConfigurationBuilder().AddInMemoryCollection(values.Select(v => new KeyValuePair<string, string?>(v.Key, v.Value))).Build();
}
