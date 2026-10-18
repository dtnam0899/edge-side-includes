import nx from "@nx/eslint-plugin";
import baseConfig from "../eslint.config.mjs";

export default [
    ...nx.configs["flat/angular"],
    ...nx.configs["flat/angular-template"],
    ...baseConfig,
    {
        files: [
            "**/*.json"
        ],
        rules: {
            "@nx/dependency-checks": [
                "error",
                {
                    ignoredFiles: [
                        "{projectRoot}/eslint.config.{js,cjs,mjs,ts,cts,mts}",
                        "{projectRoot}/vite.config.{js,ts,mjs,mts}"
                    ],
                    // Test tooling; @angular/platform-browser is a peer of @a2ui/angular, and @a2ui/web_core
                    // is listed only to pin it exactly (ADR-0002); @dtnam0899/dsl-schema is used by tests only.
                    ignoredDependencies: [
                        "@angular/common",
                        "@angular/platform-browser",
                        "@a2ui/web_core",
                        "@dtnam0899/dsl-schema",
                        "@angular/compiler",
                        "@analogjs/vitest-angular",
                        "@analogjs/vite-plugin-angular",
                        "@nx/vite",
                        "vite"
                    ]
                }
            ]
        },
        languageOptions: {
            parser: await import("jsonc-eslint-parser")
        }
    },
    {
        files: [
            "**/*.ts"
        ],
        rules: {
            "@angular-eslint/directive-selector": [
                "error",
                {
                    type: "attribute",
                    prefix: "esi",
                    style: "camelCase"
                }
            ],
            "@angular-eslint/component-selector": [
                "error",
                {
                    type: "element",
                    prefix: "esi",
                    style: "kebab-case"
                }
            ]
        }
    },
    {
        files: [
            "**/*.html"
        ],
        // Override or add rules here
        rules: {}
    }
];
