using System.Reflection;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Esi.Core.Application.Visualizations;
using Json.Schema;

namespace Esi.Core.Infrastructure.Dsl;

/// <summary>
/// .NET implementation of the <c>@dtnam0899/dsl-core</c> 0.1.0 validation (ADR-0002), applied to the contract
/// <c>DslDocument</c>: envelope checks, the A2UI v0.9.1 basic-catalog schema per component (vendored in
/// <c>Dsl/Schema</c>), then the ESI rules (unique ids, a <c>root</c>, catalog-only components and functions, existing
/// child references, no HTML or script URLs, no row data, bound paths that exist in the column definitions). Both
/// implementations must pass the shared fixtures of <c>@dtnam0899/dsl-schema</c>.
/// </summary>
public sealed partial class DslValidator : IDslValidator
{
    public const string ProtocolVersion = "v0.9";
    public const string RootComponentId = "root";
    public const string CatalogAliasId = "https://a2ui.org/specification/v0_9/catalog.json";

    /// <summary>dsl-schema package versions whose artifact format (1) this core understands.</summary>
    public static readonly IReadOnlySet<string> SupportedSchemaVersions = new HashSet<string>(StringComparer.Ordinal) { "0.1.0" };

    private static readonly string[] EnvelopeKeys = ["catalogId", "protocolVersion", "dslSchemaVersion", "components"];
    private static readonly string[] RowDataKeys = ["rows", "data", "dataModel", "values", "updateDataModel"];
    private static readonly string[] PageFields = ["page", "pageSize", "totalRows", "remaining"];
    private static readonly string[] ChildKeys = ["child", "trigger", "content"];

    private readonly HashSet<string> _components;
    private readonly HashSet<string> _functions;
    private readonly Dictionary<string, JsonSchema> _componentSchemas = new(StringComparer.Ordinal);

    public DslValidator()
    {
        var catalogText = Resource("catalog.json");
        var catalog = JsonNode.Parse(catalogText)!.AsObject();
        CatalogId = catalog["catalogId"]!.GetValue<string>();
        _components = [.. catalog["components"]!.AsObject().Select(c => c.Key)];
        _functions = [.. catalog["functions"]!.AsObject().Select(f => f.Key)];

        var catalogId = catalog["$id"]!.GetValue<string>();
        // A registry per validator: building without options would register into the process-wide global registry,
        // which refuses a second schema with the same $id (several hosts in one process, e.g. tests).
        var registry = new SchemaRegistry();
        var options = new BuildOptions { SchemaRegistry = registry };
        JsonSchema.FromText(Resource("common_types.json"), options);
        var catalogSchema = JsonSchema.FromText(catalogText, options);

        // common_types.json refers to the catalog as "catalog.json" next to itself (dsl-schema CATALOG_ALIAS_ID).
        registry.Register(new Uri(CatalogAliasId), catalogSchema);
        foreach (var name in _components)
        {
            _componentSchemas[name] = JsonSchema.FromText($$"""{"$ref":"{{catalogId}}#/components/{{name}}"}""", options);
        }
    }

    public string CatalogId { get; }

    public bool SupportsSchemaVersion(string dslSchemaVersion) => SupportedSchemaVersions.Contains(dslSchemaVersion);

    public IReadOnlyList<DslIssue> Validate(JsonElement document, IReadOnlyCollection<string> columnNames)
    {
        if (document.ValueKind != JsonValueKind.Object)
        {
            return [new DslIssue("schema", "The DSL document must be a JSON object", string.Empty)];
        }

        var issues = new List<DslIssue>();
        EnvelopeIssues(document, issues);
        var components = document.TryGetProperty("components", out var list) && list.ValueKind == JsonValueKind.Array
            ? list.EnumerateArray().Where(c => c.ValueKind == JsonValueKind.Object).ToList()
            : [];

        SchemaIssues(components, issues);
        ComponentIssues(components, issues);
        UnsafeContentIssues(components, issues);
        BindingIssues(components, new HashSet<string>(columnNames, StringComparer.Ordinal), issues);
        return issues;
    }

    private void EnvelopeIssues(JsonElement document, List<DslIssue> issues)
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

        ExpectString(document, "catalogId", CatalogId, issues);
        ExpectString(document, "protocolVersion", ProtocolVersion, issues);
        if (!document.TryGetProperty("dslSchemaVersion", out var version) || version.ValueKind != JsonValueKind.String
            || !SupportedSchemaVersions.Contains(version.GetString()!))
        {
            issues.Add(new DslIssue("schema", $"/dslSchemaVersion must be one of: {string.Join(", ", SupportedSchemaVersions)}", "/dslSchemaVersion"));
        }

        if (!document.TryGetProperty("components", out var components) || components.ValueKind != JsonValueKind.Array || components.GetArrayLength() == 0)
        {
            issues.Add(new DslIssue("schema", "/components must be a non-empty array", "/components"));
        }
    }

    private void SchemaIssues(List<JsonElement> components, List<DslIssue> issues)
    {
        for (var index = 0; index < components.Count; index++)
        {
            var component = components[index];
            var name = component.TryGetProperty("component", out var c) && c.ValueKind == JsonValueKind.String ? c.GetString()! : null;

            // Unknown components and functions are reported by the ESI rules instead.
            if (name is null || !_componentSchemas.TryGetValue(name, out var schema) || HasUnknownFunction(component))
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

    private bool HasUnknownFunction(JsonElement component)
    {
        var unknown = false;
        Walk(component, [], (node, _) =>
        {
            if (Call(node) is { } call && !_functions.Contains(call))
            {
                unknown = true;
            }
        });
        return unknown;
    }

    private void ComponentIssues(List<JsonElement> components, List<DslIssue> issues)
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

            if (component.TryGetProperty("component", out var name) && name.ValueKind == JsonValueKind.String && !_components.Contains(name.GetString()!))
            {
                issues.Add(new DslIssue("unknown-component", $"\"{name.GetString()}\" is not a component of the pinned basic catalog", Pointer("components", index, "component")));
            }

            var at = index;
            Walk(component, [], (node, segments) =>
            {
                if (Call(node) is { } call && !_functions.Contains(call))
                {
                    issues.Add(new DslIssue("unknown-function", $"\"{call}\" is not a function of the pinned basic catalog", Pointer(["components", at, .. segments, "call"])));
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
        Walk(component, [], (node, segments) =>
        {
            // children.path is a template path, checked with the template.
            if (segments.Length > 0 && Equals(segments[0], "children"))
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
