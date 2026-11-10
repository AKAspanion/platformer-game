module.exports = [
  {
    files: ["**/*.js"],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: "module",
    },
  },
  {
    files: ["*.config.js", "scripts/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
    },
  },
  {
    ignores: ["dist/**", "packages/**", "node_modules/**"],
  },
];
