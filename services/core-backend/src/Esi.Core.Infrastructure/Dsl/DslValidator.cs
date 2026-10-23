using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Esi.Core.Application.Visualizations;
using Json.Schema;

namespace Esi.Core.Infrastructure.Dsl;

/// <summary>
/// .NET implementation of the <c>@dtnam0899/dsl-core</c> 0.2.0 validation (ADR-0002, ADR-0009), applied to the
/// contract <c>DslDocument</c>: envelope checks, the schema of each component in the document's catalog (the A2UI
/// v0.9.1 basic catalog, or the ESI catalog for charts; vendored in <c>Dsl/Schema</c>), then the ESI rules (unique
/// ids, a <c>root</c>, catalog-only components and functions, existing child references, no HTML or script URLs, no
/// row data, bound paths that exist in the column definitions) and, on the ESI catalog, the chart rules. Both
/// implementations must pass the shared fixtures of <c>@dtnam0899/dsl-schema</c>.
/// </summary>
public sealed partial class DslValidator : IDslValidator
{
    public const string ProtocolVersion = "v0.9";
    public const string RootComponentId = "root";
    public const string CatalogAliasId = "https://a2ui.org/specification/v0_9/catalog.json";
    public const string ChartComponent = "EsiChart";
    public const int MaxChartSeries = 4;

    /// <summary>dsl-schema package versions whose artifact format (1) this core understands.</summary>
    public static readonly IReadOnlySet<string> SupportedSchemaVersions = new HashSet<string>(StringComparer.Ordinal) { "0.1.0", "0.2.0" };

    /// <summary>dsl-schema package versions that know the ESI catalog; a chart document names one of them.</summary>
    public static readonly IReadOnlySet<string> ChartSchemaVersions = new HashSet<string>(StringComparer.Ordinal) { "0.2.0" };

    private static readonly string[] EnvelopeKeys = ["catalogId", "protocolVersion", "dslSchemaVersion", "components"];
    private static readonly string[] RowDataKeys = ["rows", "data", "dataModel", "values", "updateDataModel"];
    private static readonly string[] PageFields = ["page", "pageSize", "totalRows", "remaining"];
    private static readonly string[] ChildKeys = ["child", "trigger", "content"];

    private readonly Catalog _basic;
    private readonly Catalog _esi;
    private readonly Dictionary<string, JsonSchema> _componentSchemas = new(StringComparer.Ordinal);

    public DslValidator()
    {
        var basicText = Resource("catalog.json");
        var esiText = Resource("esi-catalog.json");
        _basic = Catalog.Read(basicText);
        _esi = Catalog.Read(esiText);

        // A registry per validator: building without options would register into the process-wide global registry,
        // which refuses a second schema with the same $id (several hosts in one process, e.g. tests).
        var registry = new SchemaRegistry();
        var options = new BuildOptions { SchemaRegistry = registry };
        JsonSchema.FromText(Resource("common_types.json"), options);
        var basicSchema = JsonSchema.FromText(basicText, options);
        JsonSchema.FromText(esiText, options);

        // common_types.json refers to the catalog as "catalog.json" next to itself (dsl-schema CATALOG_ALIAS_ID).
        registry.Register(new Uri(CatalogAliasId), basicSchema);
        foreach (var name in _esi.Components)
        {
            // Basic components through the basic catalog; EsiChart through the ESI catalog, which refers to the basic one.
            var schemaId = _basic.Components.Contains(name) ? _basic.SchemaId : _esi.SchemaId;
            _componentSchemas[name] = JsonSchema.FromText($$"""{"$ref":"{{schemaId}}#/components/{{name}}"}""", options);
        }
    }

    public string CatalogId => _basic.Id;

    public string ChartCatalogId => _esi.Id;

    public bool SupportsSchemaVersion(string dslSchemaVersion) => SupportedSchemaVersions.Contains(dslSchemaVersion);

    public IReadOnlyList<DslIssue> Validate(JsonElement document, IReadOnlyCollection<DslColumn> columns)
    {
        if (document.ValueKind != JsonValueKind.Object)
        {
            return [new DslIssue("schema", "The DSL document must be a JSON object", string.Empty)];
        }

        // An unknown catalog id is a schema issue; its components are then checked against the basic catalog.
        var isEsi = document.TryGetProperty("catalogId", out var id) && id.ValueKind == JsonValueKind.String && id.GetString() == _esi.Id;
        var catalog = isEsi ? _esi : _basic;
        var issues = new List<DslIssue>();
        EnvelopeIssues(document, isEsi, issues);
        var components = document.TryGetProperty("components", out var list) && list.ValueKind == JsonValueKind.Array
            ? list.EnumerateArray().Where(c => c.ValueKind == JsonValueKind.Object).ToList()
            : [];

        SchemaIssues(components, catalog, issues);
        ComponentIssues(components, catalog, issues);
        UnsafeContentIssues(components, issues);
        BindingIssues(components, new HashSet<string>(columns.Select(c => c.Name), StringComparer.Ordinal), issues);
        if (isEsi)
        {
            ChartIssues(components, columns, issues);
        }

        return issues;
    }

    private void EnvelopeIssues(JsonElement document, bool isEsi, List<DslIssue> issues)
    {
        foreach (var property in document.EnumerateObject())
        {
            if (RowDataKeys.Contains(property.Name))
            {
                issues.Add(new DslIssue("row-data", $"The DSL must not carry row data (\"{property.Name}\"); bind components to columns instead", Pointer(property.Name)));
            }
            else if (!EnvelopeKeys.Contains(property.Name))
            {
                issues.Add(new DslIssue("schema", $"artifact must NOT have additional properties: \"{property.Name}\"", Pointer(property.Name)));
            }
        }

        if (!document.TryGetProperty("catalogId", out var catalogId) || catalogId.ValueKind != JsonValueKind.String
            || (catalogId.GetString() != _basic.Id && catalogId.GetString() != _esi.Id))
        {
            issues.Add(new DslIssue("schema", $"/catalogId must be equal to one of the allowed values: \"{_basic.Id}\", \"{_esi.Id}\"", "/catalogId"));
        }

        ExpectString(document, "protocolVersion", ProtocolVersion, issues);
        var versions = isEsi ? ChartSchemaVersions : SupportedSchemaVersions;
        if (!document.TryGetProperty("dslSchemaVersion", out var version) || version.ValueKind != JsonValueKind.String
            || !versions.Contains(version.GetString()!))
        {
            issues.Add(new DslIssue("schema", $"/dslSchemaVersion must be one of: {string.Join(", ", versions)}", "/dslSchemaVersion"));
        }

        if (!document.TryGetProperty("components", out var components) || components.ValueKind != JsonValueKind.Array || components.GetArrayLength() == 0)
        {
            issues.Add(new DslIssue("schema", "/components must be a non-empty array", "/components"));
        }
        else if (isEsi && !components.EnumerateArray().Any(IsChart))
        {
            issues.Add(new DslIssue("schema", $"/components must contain an {ChartComponent}; tables and KPIs use the basic catalog", "/components"));
        }
    }

    private void SchemaIssues(List<JsonElement> components, Catalog catalog, List<DslIssue> issues)
    {
        for (var index = 0; index < components.Count; index++)
        {
            var component = components[index];
            var name = component.TryGetProperty("component", out var c) && c.ValueKind == JsonValueKind.String ? c.GetString()! : null;

            // Unknown components and functions are reported by the ESI rules instead.
            if (name is null || !catalog.Components.Contains(name) || !_componentSchemas.TryGetValue(name, out var schema)
                || HasUnknownFunction(component, catalog))
            {
                if (name is null)
                {
                    issues.Add(new DslIssue("schema", $"/components/{index} must have a \"component\" name", Pointer("components", index)));
                }

                continue;
            }

            var result = schema.Evaluate(component, new EvaluationOptions { OutputFormat = OutputFormat.List });
            if (!result.IsValid)
            {
                var detail = result.Details?
                    .Where(d => !d.IsValid && d.Errors is { Count: > 0 })
                    .SelectMany(d => d.Errors!.Select(e => $"{d.InstanceLocation} {e.Value}"))
                    .FirstOrDefault() ?? "does not match the catalog schema";
                issues.Add(new DslIssue("schema", $"/components/{index} {detail}", Pointer("components", index)));
            }
        }
    }

    private static bool HasUnknownFunction(JsonElement component, Catalog catalog)
    {
        var unknown = false;
        Walk(component, [], (node, _) =>
        {
            if (Call(node) is { } call && !catalog.Functions.Contains(call))
            {
                unknown = true;
            }
        });
        return unknown;
    }

    private static void ComponentIssues(List<JsonElement> components, Catalog catalog, List<DslIssue> issues)
    {
        var ids = new HashSet<string>(StringComparer.Ordinal);
        for (var index = 0; index < components.Count; index++)
        {
            var component = components[index];
            var id = Id(component);
            if (id is not null && !ids.Add(id))
            {
                issues.Add(new DslIssue("duplicate-id", $"Component id \"{id}\" is used more than once", Pointer("components", index, "id")));
            }

            if (component.TryGetProperty("component", out var name) && name.ValueKind == JsonValueKind.String && !catalog.Components.Contains(name.GetString()!))
            {
                issues.Add(new DslIssue("unknown-component", $"\"{name.GetString()}\" is not a component of the document's catalog", Pointer("components", index, "component")));
            }

            var at = index;
            Walk(component, [], (node, segments) =>
            {
                if (Call(node) is { } call && !catalog.Functions.Contains(call))
                {
                    issues.Add(new DslIssue("unknown-function", $"\"{call}\" is not a function of the document's catalog", Pointer(["components", at, .. segments, "call"])));
                }
            });
        }

        if (!ids.Contains(RootComponentId))
        {
            issues.Add(new DslIssue("missing-root", $"No component has the id \"{RootComponentId}\"", "/components"));
        }

        for (var index = 0; index < components.Count; index++)
        {
            foreach (var reference in ChildReferences(components[index]).Where(r => !ids.Contains(r.Id)))
            {
                issues.Add(new DslIssue(
                    "missing-reference",
                    $"Component \"{Id(components[index])}\" refers to \"{reference.Id}\", which does not exist",
                    Pointer(["components", index, .. reference.Segments])));
            }
        }
    }

    private static void UnsafeContentIssues(List<JsonElement> components, List<DslIssue> issues)
    {
        for (var index = 0; index < components.Count; index++)
        {
            var at = index;
            Walk(components[index], [], (node, segments) =>
            {
                if (node.ValueKind == JsonValueKind.String && UnsafeContent().IsMatch(node.GetString()!))
                {
                    issues.Add(new DslIssue("unsafe-content", "Literal text must not contain HTML or script URLs", Pointer(["components", at, .. segments])));
                }
            });
        }
    }

    private static void BindingIssues(List<JsonElement> components, HashSet<string> columns, List<DslIssue> issues)
    {
        var byId = new Dictionary<string, int>(StringComparer.Ordinal);
        for (var index = 0; index < components.Count; index++)
        {
            if (Id(components[index]) is { } id)
            {
                byId.TryAdd(id, index);
            }
        }

        // Components reachable from a /rows template render once per row and use relative column paths.
        var inRow = new HashSet<int>();
        void MarkRow(string id)
        {
            if (!byId.TryGetValue(id, out var index) || !inRow.Add(index))
            {
                return;
            }

            foreach (var reference in ChildReferences(components[index]))
            {
                MarkRow(reference.Id);
            }
        }

        for (var index = 0; index < components.Count; index++)
        {
            foreach (var reference in ChildReferences(components[index]).Where(r => r.TemplatePath is not null))
            {
                if (reference.TemplatePath == "/rows")
                {
                    MarkRow(reference.Id);
                }
                else
                {
                    issues.Add(new DslIssue("unknown-path", $"A list template must iterate \"/rows\", not \"{reference.TemplatePath}\"", Pointer("components", index, "children", "path")));
                }
            }
        }

        for (var index = 0; index < components.Count; index++)
        {
            var component = components[index];
            var row = inRow.Contains(index);
            if (row && ChildReferences(component).Any(r => r.TemplatePath is not null))
            {
                issues.Add(new DslIssue("unknown-path", "A list template cannot be nested inside a row template; rows are flat", Pointer("components", index, "children", "path")));
            }

            foreach (var (path, segments) in Bindings(component, index, issues))
            {
                var at = Pointer(["components", index, .. segments]);
                var resolved = ResolveColumn(path, row);
                if (!resolved.Valid)
                {
                    issues.Add(new DslIssue("unknown-path", row
                        ? $"\"{path}\" is not a column path; inside a row template use a relative column name, /rows/<index>/<column> or /page/<field>"
                        : $"\"{path}\" is not a valid path; use /rows/<index>/<column> or /page/<field>, or a relative column name inside a /rows template", at));
                }
                else if (resolved.Column is not null && !columns.Contains(resolved.Column))
                {
                    issues.Add(new DslIssue("unknown-column", $"\"{path}\" refers to column \"{resolved.Column}\", which is not in the column definitions", at));
                }
            }
        }
    }

    private static List<(string Path, object[] Segments)> Bindings(JsonElement component, int index, List<DslIssue> issues)
    {
        var bindings = new List<(string, object[])>();
        var chart = IsChart(component);
        Walk(component, [], (node, segments) =>
        {
            // children.path is a template path, checked with the template; chart data is checked by the chart rules.
            if (segments.Length > 0 && (Equals(segments[0], "children") || (chart && Equals(segments[0], "data"))))
            {
                return;
            }

            if (node.ValueKind == JsonValueKind.Object && node.TryGetProperty("path", out var path) && path.ValueKind == JsonValueKind.String
                && node.EnumerateObject().Count() == 1)
            {
                bindings.Add((path.GetString()!, [.. segments, "path"]));
            }

            if (Call(node) == "formatString" && node.TryGetProperty("args", out var args) && args.ValueKind == JsonValueKind.Object
                && args.TryGetProperty("value", out var value) && value.ValueKind == JsonValueKind.String)
            {
                object[] valueSegments = [.. segments, "args", "value"];
                foreach (Match match in Interpolation().Matches(value.GetString()!))
                {
                    var expression = match.Groups[1].Value.Trim();
                    if (PlainPath().IsMatch(expression))
                    {
                        bindings.Add((expression, valueSegments));
                    }
                    else
                    {
                        issues.Add(new DslIssue("unsupported-expression", $"formatString interpolation \"${{{expression}}}\" is not a plain data path", Pointer(["components", index, .. valueSegments])));
                    }
                }
            }
        });
        return bindings;
    }

    /// <summary>
    /// The chart rules of ADR-0009 (dsl-core <c>analyzeCharts</c>): <c>data</c> is <c>{"path": "/rows"}</c>, the
    /// category and series columns exist, series columns are numbers and the category is not boolean, 1 to 4 unique
    /// series, one series for pie, and <c>stacked</c> only on a bar chart. Shapes the catalog schema rejects are left to it.
    /// </summary>
    private static void ChartIssues(List<JsonElement> components, IReadOnlyCollection<DslColumn> columns, List<DslIssue> issues)
    {
        var types = new Dictionary<string, string>(StringComparer.Ordinal);
        foreach (var column in columns)
        {
            types.TryAdd(column.Name, column.Type);
        }

        for (var index = 0; index < components.Count; index++)
        {
            var component = components[index];
            if (!IsChart(component))
            {
                continue;
            }

            if (component.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Object
                && data.TryGetProperty("path", out var dataPath) && dataPath.ValueKind == JsonValueKind.String && dataPath.GetString() != "/rows")
            {
                issues.Add(new DslIssue("unknown-path", $"Chart data must be bound to \"/rows\", not \"{dataPath.GetString()}\"", Pointer("components", index, "data", "path")));
            }

            string? TypeOf(string name, params object[] segments)
            {
                if (types.TryGetValue(name, out var type))
                {
                    return type;
                }

                issues.Add(new DslIssue("unknown-column", $"Chart column \"{name}\" is not in the column definitions", Pointer(["components", index, .. segments])));
                return null;
            }

            if (component.TryGetProperty("categoryKey", out var category) && category.ValueKind == JsonValueKind.String
                && TypeOf(category.GetString()!, "categoryKey") == "boolean")
            {
                issues.Add(new DslIssue("chart-column-type", $"The category column \"{category.GetString()}\" is boolean; use a string, date, datetime or number column", Pointer("components", index, "categoryKey")));
            }

            var chartType = component.TryGetProperty("chartType", out var t) && t.ValueKind == JsonValueKind.String ? t.GetString() : null;
            if (component.TryGetProperty("series", out var series) && series.ValueKind == JsonValueKind.Array)
            {
                var count = series.GetArrayLength();
                if (count == 0 || count > MaxChartSeries)
                {
                    issues.Add(new DslIssue("chart-series", $"A chart has 1 to {MaxChartSeries} series, not {count}", Pointer("components", index, "series")));
                }
                else if (chartType == "pie" && count > 1)
                {
                    issues.Add(new DslIssue("chart-series", $"A pie chart has exactly one series, not {count}", Pointer("components", index, "series")));
                }

                var seen = new HashSet<string>(StringComparer.Ordinal);
                var seriesIndex = 0;
                foreach (var item in series.EnumerateArray())
                {
                    var at = seriesIndex++;
                    if (item.ValueKind != JsonValueKind.Object || !item.TryGetProperty("valueKey", out var key) || key.ValueKind != JsonValueKind.String)
                    {
                        continue;
                    }

                    var valueKey = key.GetString()!;
                    if (!seen.Add(valueKey))
                    {
                        issues.Add(new DslIssue("chart-series", $"The column \"{valueKey}\" is used by more than one series", Pointer("components", index, "series", at, "valueKey")));
                    }

                    if (TypeOf(valueKey, "series", at, "valueKey") is { } type && type != "number")
                    {
                        issues.Add(new DslIssue("chart-column-type", $"The series column \"{valueKey}\" is {type}; series must be number columns", Pointer("components", index, "series", at, "valueKey")));
                    }
                }
            }

            if (component.TryGetProperty("stacked", out _) && chartType != "bar")
            {
                issues.Add(new DslIssue("chart-series", $"\"stacked\" is only for bar charts, not {chartType}", Pointer("components", index, "stacked")));
            }
        }
    }

    private static bool IsChart(JsonElement component) =>
        component.ValueKind == JsonValueKind.Object && component.TryGetProperty("component", out var name)
        && name.ValueKind == JsonValueKind.String && name.GetString() == ChartComponent;

    /// <summary>Valid with the column it names, valid with no column (<c>/page/&lt;field&gt;</c>), or invalid.</summary>
    private static (bool Valid, string? Column) ResolveColumn(string path, bool inRow)
    {
        if (!path.StartsWith('/'))
        {
            return !inRow || path.Length == 0 || path.Contains('/') ? (false, null) : (true, Decode(path));
        }

        var segments = path.Split('/').Skip(1).Select(Decode).ToArray();
        return segments[0] switch
        {
            "rows" when segments.Length == 3 && RowIndex().IsMatch(segments[1]) && segments[2].Length > 0 => (true, segments[2]),
            "page" when segments.Length == 2 && PageFields.Contains(segments[1]) => (true, null),
            _ => (false, null),
        };
    }

    private static IEnumerable<(string Id, object[] Segments, string? TemplatePath)> ChildReferences(JsonElement component)
    {
        foreach (var key in ChildKeys)
        {
            if (component.TryGetProperty(key, out var id) && id.ValueKind == JsonValueKind.String)
            {
                yield return (id.GetString()!, [key], null);
            }
        }

        if (component.TryGetProperty("children", out var children))
        {
            if (children.ValueKind == JsonValueKind.Array)
            {
                var index = 0;
                foreach (var child in children.EnumerateArray())
                {
                    if (child.ValueKind == JsonValueKind.String)
                    {
                        yield return (child.GetString()!, ["children", index], null);
                    }

                    index++;
                }
            }
            else if (children.ValueKind == JsonValueKind.Object && children.TryGetProperty("componentId", out var template)
                && template.ValueKind == JsonValueKind.String)
            {
                var templatePath = children.TryGetProperty("path", out var p) && p.ValueKind == JsonValueKind.String ? p.GetString() : null;
                yield return (template.GetString()!, ["children", "componentId"], templatePath);
            }
        }

        if (component.TryGetProperty("tabs", out var tabs) && tabs.ValueKind == JsonValueKind.Array)
        {
            var index = 0;
            foreach (var tab in tabs.EnumerateArray())
            {
                if (tab.ValueKind == JsonValueKind.Object && tab.TryGetProperty("child", out var child) && child.ValueKind == JsonValueKind.String)
                {
                    yield return (child.GetString()!, ["tabs", index, "child"], null);
                }

                index++;
            }
        }
    }

    private static void ExpectString(JsonElement document, string name, string expected, List<DslIssue> issues)
    {
        if (!document.TryGetProperty(name, out var value) || value.ValueKind != JsonValueKind.String || value.GetString() != expected)
        {
            issues.Add(new DslIssue("schema", $"/{name} must be equal to constant: \"{expected}\"", "/" + name));
        }
    }

    private static string? Id(JsonElement component) =>
        component.TryGetProperty("id", out var id) && id.ValueKind == JsonValueKind.String ? id.GetString() : null;

    private static string? Call(JsonElement node) =>
        node.ValueKind == JsonValueKind.Object && node.TryGetProperty("call", out var call) && call.ValueKind == JsonValueKind.String
            ? call.GetString()
            : null;

    private static void Walk(JsonElement value, object[] segments, Action<JsonElement, object[]> visit)
    {
        visit(value, segments);
        if (value.ValueKind == JsonValueKind.Array)
        {
            var index = 0;
            foreach (var item in value.EnumerateArray())
            {
                Walk(item, [.. segments, index++], visit);
            }
        }
        else if (value.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in value.EnumerateObject())
            {
                Walk(property.Value, [.. segments, property.Name], visit);
            }
        }
    }

    private static string Pointer(params object[] segments) =>
        string.Concat(segments.Select(s => "/" + Convert.ToString(s, System.Globalization.CultureInfo.InvariantCulture)!.Replace("~", "~0", StringComparison.Ordinal).Replace("/", "~1", StringComparison.Ordinal)));

    private static string Decode(string segment) => segment.Replace("~1", "/", StringComparison.Ordinal).Replace("~0", "~", StringComparison.Ordinal);

    private static string Resource(string name)
    {
        using var stream = Assembly.GetExecutingAssembly().GetManifestResourceStream($"DslSchema.{name}")
            ?? throw new InvalidOperationException($"DSL schema resource {name} is not embedded.");
        using var reader = new StreamReader(stream);
        return reader.ReadToEnd();
    }

    /// <summary>A catalog's ids and the names of its components and functions.</summary>
    private sealed record Catalog(string Id, string SchemaId, HashSet<string> Components, HashSet<string> Functions)
    {
        public static Catalog Read(string text)
        {
            var catalog = JsonNode.Parse(text)!.AsObject();
            return new Catalog(
                catalog["catalogId"]!.GetValue<string>(),
                catalog["$id"]!.GetValue<string>(),
                [.. catalog["components"]!.AsObject().Select(c => c.Key)],
                [.. catalog["functions"]!.AsObject().Select(f => f.Key)]);
        }
    }

    // Tag-like text (<b>, </p>, <!--, <?) and script URLs. Markdown is allowed; HTML is not.
    [GeneratedRegex(@"<\s*[a-z!/?]|\b(?:javascript|vbscript)\s*:|\bdata\s*:\s*text/html", RegexOptions.IgnoreCase)]
    private static partial Regex UnsafeContent();

    // ${...} in a formatString value; \${ is a literal.
    [GeneratedRegex(@"(?<!\\)\$\{([^}]*)\}")]
    private static partial Regex Interpolation();

    [GeneratedRegex(@"^[^\s(){}$,'""]+$")]
    private static partial Regex PlainPath();

    [GeneratedRegex(@"^(0|[1-9]\d*)$")]
    private static partial Regex RowIndex();
}
