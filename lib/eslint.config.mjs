import nx from "@nx/eslint-plugin";

export default [
    ...nx.configs["flat/base"],
    ...nx.configs["flat/typescript"],
    ...nx.configs["flat/javascript"],
    {
      "ignores": [
        "**/dist",
        "**/out-tsc",
        "**/vitest.config.*.timestamp*"
      ]
    },
    {
        files: [
            "**/*.ts",
            "**/*.tsx",
            "**/*.js",
            "**/*.jsx"
        ],
        rules: {
            "@nx/enforce-module-boundaries": [
                "error",
                {
                    enforceBuildableLibDependency: true,
                    allow: [
                        "^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$"
                    ],
                    depConstraints: [
                        { sourceTag: "scope:schema", onlyDependOnLibsWithTags: ["scope:schema"] },
                        { sourceTag: "scope:core", onlyDependOnLibsWithTags: ["scope:schema", "scope:core"] },
                        { sourceTag: "scope:renderer", onlyDependOnLibsWithTags: ["scope:schema", "scope:core", "scope:tokens", "scope:renderer"] },
                        { sourceTag: "scope:tokens", onlyDependOnLibsWithTags: ["scope:tokens"] },
                        { sourceTag: "scope:api", onlyDependOnLibsWithTags: ["scope:api"] },
                        { sourceTag: "framework:angular", notDependOnLibsWithTags: ["framework:react"] }
                    ]
                }
            ]
        }
    },
    {
        files: [
            "**/*.ts",
            "**/*.tsx",
            "**/*.cts",
            "**/*.mts",
            "**/*.js",
            "**/*.jsx",
            "**/*.cjs",
            "**/*.mjs"
        ],
        // Override or add rules here
        rules: {}
    }
];
