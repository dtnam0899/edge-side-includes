using System.Text.Json;
using System.Text.Json.Nodes;
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
    public void The_catalog_id_is_the_pinned_one() =>
        Assert.Equal("https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json", Validator.CatalogId);

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

    private static (JsonElement Document, string[] Columns, string[] Expected) Load(string kind, string name)
    {
        var fixture = JsonNode.Parse(File.ReadAllText(Path.Combine(AppContext.BaseDirectory, "Fixtures", "dsl-schema", kind, name + ".json")))!;
        var artifact = fixture["artifact"]!.AsObject();
        var columns = artifact["columns"]?.AsArray().Select(c => c!["name"]!.GetValue<string>()).ToArray() ?? [];
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
                ? (value?.GetValueKind() == JsonValueKind.Number && value.GetValue<int>() == 1 ? "0.1.0" : value?.ToJsonString())
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
    }
}
