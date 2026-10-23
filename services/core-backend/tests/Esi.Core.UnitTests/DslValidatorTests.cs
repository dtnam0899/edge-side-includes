using System.Text.Json;
using System.Text.Json.Nodes;
using Esi.Core.Application.Visualizations;
using Esi.Core.Infrastructure.Dsl;

namespace Esi.Core.UnitTests;

/// <summary>
/// ADR-0002: core's DSL validation must agree with <c>@dtnam0899/dsl-core</c> on the shared fixtures published in
/// <c>@dtnam0899/dsl-schema</c> (vendored under Fixtures/dsl-schema). Fixtures use the lib artifact format; they are
/// mapped to the contract <c>DslDocument</c> plus column names, which is what core validates.
/// </summary>
public class DslValidatorTests
{
    private static readonly DslValidator Validator = new();

    public static TheoryData<string> ValidFixtures => [.. Fixtures("valid")];

    public static TheoryData<string> InvalidFixtures => [.. Fixtures("invalid")];

    [Theory]
    [MemberData(nameof(ValidFixtures))]
    public void Valid_fixtures_pass(string name)
    {
        var (document, columns, _) = Load("valid", name);

        var issues = Validator.Validate(document, columns);

        Assert.True(issues.Count == 0, string.Join("; ", issues.Select(i => $"{i.Code} {i.Path}: {i.Message}")));
    }

    [Theory]
    [MemberData(nameof(InvalidFixtures))]
    public void Invalid_fixtures_report_the_expected_codes(string name)
    {
        var (document, columns, expected) = Load("invalid", name);

        var codes = Validator.Validate(document, columns).Select(i => i.Code).Distinct().Order().ToArray();

        Assert.Equal(expected.Distinct().Order(), codes);
    }

    [Fact]
    public void The_catalog_ids_are_the_pinned_ones()
    {
        Assert.Equal("https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json", Validator.CatalogId);
        Assert.Equal("dtnam0899.github.io:esi-catalog-v0_9-1", Validator.ChartCatalogId);
    }

    [Fact]
    public void Both_pinned_dsl_schema_versions_are_supported()
    {
        Assert.True(Validator.SupportsSchemaVersion("0.1.0"));
        Assert.True(Validator.SupportsSchemaVersion(PinnedDslSchemaVersion));
        Assert.False(Validator.SupportsSchemaVersion("9.9.9"));
    }

    [Fact]
    public void A_chart_document_needs_a_dsl_schema_version_that_knows_the_esi_catalog()
    {
        var (document, columns, _) = Load("valid", "chart-bar", dslSchemaVersion: "0.1.0");

        var issue = Assert.Single(Validator.Validate(document, columns));

        Assert.Equal(("schema", "/dslSchemaVersion"), (issue.Code, issue.Path));
    }

    [Fact]
    public void Chart_issues_point_at_the_series()
    {
        var (document, columns, _) = Load("invalid", "chart-series-not-numeric");

        var issue = Assert.Single(Validator.Validate(document, columns));

        Assert.Equal(("chart-column-type", "/components/0/series/0/valueKey"), (issue.Code, issue.Path));
    }

    [Fact]
    public void Chart_column_types_come_from_the_result_columns()
    {
        var (document, _, _) = Load("valid", "chart-bar");
        DslColumn[] asText = [new("region", "string"), new("revenue", "string"), new("cost", "number")];

        var issue = Assert.Single(Validator.Validate(document, asText));

        Assert.Equal("chart-column-type", issue.Code);
    }

    [Theory]
    [InlineData("int", "number")]
    [InlineData("decimal(38,2)", "number")]
    [InlineData("MONEY", "number")]
    [InlineData("float", "number")]
    [InlineData("bit", "boolean")]
    [InlineData("date", "date")]
    [InlineData("datetime2(7)", "datetime")]
    [InlineData("datetimeoffset", "datetime")]
    [InlineData("nvarchar(200)", "string")]
    [InlineData("uniqueidentifier", "string")]
    [InlineData("time(7)", "string")]
    public void Sql_types_map_to_dsl_column_types_like_the_portal(string sqlType, string dslType) =>
        Assert.Equal(dslType, DslColumnTypes.FromSqlType(sqlType));

    [Fact]
    public void Issues_carry_json_pointers()
    {
        var (document, columns, _) = Load("invalid", "unknown-column");

        var issue = Assert.Single(Validator.Validate(document, columns));

        Assert.StartsWith("/components/", issue.Path, StringComparison.Ordinal);
    }

    private static IEnumerable<string> Fixtures(string kind) =>
        Directory.GetFiles(Path.Combine(AppContext.BaseDirectory, "Fixtures", "dsl-schema", kind), "*.json")
            .Select(Path.GetFileNameWithoutExtension)
            .Order()!;

    /// <summary>The dsl-schema package version the fixtures were vendored from (Fixtures/dsl-schema/PUBLISHED.json).</summary>
    private static string PinnedDslSchemaVersion =>
        JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fixtures", "dsl-schema", "PUBLISHED.json")))!["version"]!.GetValue<string>();

    private static (JsonElement Document, DslColumn[] Columns, string[] Expected) Load(string kind, string name, string? dslSchemaVersion = null)
    {
        var fixture = JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fixtures", "dsl-schema", kind, name + ".json")))!;
        var artifact = fixture["artifact"]!.AsObject();
        // Fixture columns carry DSL types already; core maps the contract's SQL types to them (DslColumnTypes).
        var columns = artifact["columns"]?.AsArray().Select(c => new DslColumn(c!["name"]!.GetValue<string>(), c["type"]!.GetValue<string>())).ToArray() ?? [];
        var expected = fixture["expectedErrors"]?.AsArray().Select(e => e!.GetValue<string>()).ToArray() ?? [];

        // lib artifact format 1 -> contract DslDocument (dslSchemaVersion is the dsl-schema package version).
        var document = new JsonObject();
        foreach (var (key, value) in artifact)
        {
            if (key is "columns" or "query")
            {
                continue;
            }

            document[key] = key == "dslSchemaVersion"
                ? (value?.GetValueKind() == JsonValueKind.Number && value.GetValue<int>() == 1 ? dslSchemaVersion ?? PinnedDslSchemaVersion : value?.ToJsonString())
                : value?.DeepClone();
        }

        return (JsonSerializer.SerializeToElement(document), columns, expected);
    }
}

public class DslValidatorInstancesTests
{
    [Fact]
    public void Several_validators_can_exist_in_one_process()
    {
        var first = new DslValidator();
        var second = new DslValidator();

        Assert.Equal(first.CatalogId, second.CatalogId);
        Assert.Equal(first.ChartCatalogId, second.ChartCatalogId);
    }
}
