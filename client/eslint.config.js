import js from "@eslint/js";
import svelte from "eslint-plugin-svelte";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
    js.configs.recommended,
    ...svelte.configs["flat/recommended"],
    prettier,
    ...svelte.configs["flat/prettier"],
    {
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: "module",
            globals: { ...globals.browser, ...globals.node },
        },
        rules: {
            "svelte/no-at-html-tags": "error",
            "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
        },
    },
    {
        files: ["**/*.svelte"],
        rules: {
            // False positive on runes: `let { x = $bindable() } = $props()` reads
            // as a useless assignment to the rule, but the destructuring default
            // is exactly how a bindable prop is declared.
            "no-useless-assignment": "off",
        },
    },
    {
        ignores: [
            "build/",
            ".svelte-kit/",
            ".vercel/",
            "node_modules/",
            "test-results/",
            "playwright-report/",
        ],
    },
];
