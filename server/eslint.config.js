import js from "@eslint/js";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default [
    js.configs.recommended,
    prettier,
    {
        languageOptions: {
            ecmaVersion: 2024,
            sourceType: "module",
            globals: { ...globals.node },
        },
        rules: {
            // ignoreRestSiblings covers the omit-by-destructuring idiom:
            // `const { password, passwordToken, ...rest } = user` strips fields
            // from a response, so those bindings are unused on purpose.
            "no-unused-vars": [
                "error",
                { argsIgnorePattern: "^_|^next$", ignoreRestSiblings: true },
            ],
        },
    },
    {
        files: ["test/**/*.js"],
        languageOptions: { globals: { ...globals.node } },
    },
    { ignores: ["node_modules/"] },
];
