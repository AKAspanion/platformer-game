const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  {
    ignores: [
      "dist/**",
      "packages/**",
      "node_modules/**",
      "functions/node_modules/**",
      ".claude/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: { ...globals.browser },
    },
    rules: {
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none", ignoreRestSiblings: true }],
      "no-empty": ["error", { allowEmptyCatch: true }],
      // defaults before a try/switch are deliberate here; this rule only adds noise
      "no-useless-assignment": "off",
    },
  },
  {
    // build-time constants from webpack's DefinePlugin
    files: ["app/**/*.js"],
    languageOptions: {
      globals: {
        __FIREBASE_ENV__: "readonly",
        // the loading bar's timer (inline script in app/index.html)
        loadInterval: "readonly",
      },
    },
  },
  {
    files: ["app/sw.js"],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
  {
    files: ["functions/**/*.js", "tests/**/*.js"],
    languageOptions: { globals: { ...globals.node } },
  },
  {
    files: ["*.config.js", "scripts/**/*.js"],
    languageOptions: { sourceType: "commonjs", globals: { ...globals.node } },
  },
];
