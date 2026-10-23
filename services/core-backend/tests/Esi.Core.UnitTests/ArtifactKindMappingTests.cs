using Esi.Core.Api.Endpoints;
using Esi.Core.Domain.Artifacts;

namespace Esi.Core.UnitTests;

/// <summary>ADR-0010: every stored artifact kind maps to its own contract value; none is silently turned into a table.</summary>
public class ArtifactKindMappingTests
{
    [Theory]
    [InlineData(ArtifactKind.Table, "table")]
    [InlineData(ArtifactKind.Kpi, "kpi")]
    [InlineData(ArtifactKind.Chart, "chart")]
    public void Each_kind_maps_to_its_contract_value(ArtifactKind kind, string expected) =>
        Assert.Equal(expected, ArtifactEndpoints.Kind(kind));

    [Fact]
    public void Every_domain_kind_is_mapped() =>
        Assert.All(Enum.GetValues<ArtifactKind>(), kind => Assert.False(string.IsNullOrEmpty(ArtifactEndpoints.Kind(kind))));

    [Fact]
    public void An_unknown_kind_throws_instead_of_becoming_a_table() =>
        Assert.Throws<ArgumentOutOfRangeException>(() => ArtifactEndpoints.Kind((ArtifactKind)99));
}
