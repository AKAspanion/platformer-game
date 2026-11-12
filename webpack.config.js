const path = require("path");
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");
const ESLintPlugin = require("eslint-webpack-plugin");
const DashboardPlugin = require("webpack-dashboard/plugin");
const { EsbuildPlugin } = require("esbuild-loader");
const { firebaseEnv, missingFirebaseEnv, buildEnv } = require("./scripts/load-env");
const { LEGAL_PAGES, renderLegalPage } = require("./scripts/legal-pages");

// Deploys set REQUIRE_FIREBASE_ENV=1: a live build without its Firebase config
// would ship a game whose sign-in, worlds and leaderboards all fail.
if (missingFirebaseEnv.length) {
  const message = `Missing ${missingFirebaseEnv.join(", ")} (copy .env.example to .env). Online features are off in this build.`;
  if (process.env.REQUIRE_FIREBASE_ENV === "1") throw new Error(message);
  console.warn(`\n[env] ${message}\n`);
}

const projectId = firebaseEnv.FIREBASE_PROJECT_ID || "demo-project";

// a function so the build knows its mode (`--mode production` drops dev-only values)
module.exports = (env, argv = {}) => ({
  mode: argv.mode || "development",
  entry: {
    main: path.resolve(__dirname, "./app/index.js"),
    // the page the account emails link to (/auth/action, app/pages/)
    "auth-action": path.resolve(__dirname, "./app/pages/auth-action.js"),
  },
  output: {
    filename: (pathData) => (pathData.chunk.name === "main" ? "bundle.js" : "[name].js"),
    // Firebase (sign-in, shared worlds) is a separate chunk, loaded on demand
    chunkFilename: "chunks/[name].[contenthash:8].js",
    publicPath: "auto",
    // drop files from older builds (stale chunks would otherwise be deployed)
    clean: true,
  },
  optimization: {
    minimizer: [
      new EsbuildPlugin({
        target: "es2015",
        css: true,
      }),
    ],
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: "esbuild-loader",
      },
    ],
  },
  plugins: [
    new DashboardPlugin(),
    new webpack.DefinePlugin({
      // the Firebase web config from .env (app/firebase/config.js)
      __FIREBASE_ENV__: JSON.stringify(buildEnv(argv.mode || "development")),
    }),
    new ESLintPlugin({}),
    new CopyPlugin({
      patterns: [
        { from: path.resolve(__dirname, "app/sw.js"), to: "sw.js" },
        { from: path.resolve(__dirname, "app/assets"), to: "assets" },
        { from: path.resolve(__dirname, "app/images"), to: "images" },
        { from: path.resolve(__dirname, "app/index.css"), to: "index.css" },
        { from: path.resolve(__dirname, "app/index.html"), to: "index.html" },
        { from: path.resolve(__dirname, "app/favicon.ico"), to: "favicon.ico" },
        { from: path.resolve(__dirname, "app/manifest.json"), to: "manifest.json" },
        { from: path.resolve(__dirname, "app/assetlinks.json"), to: "assetlinks.json" },
        // Hosting's 404 page and the account email page, in the game's look
        { from: path.resolve(__dirname, "app/pages/404.html"), to: "404.html" },
        { from: path.resolve(__dirname, "app/pages/auth-action.html"), to: "auth-action.html" },
        { from: path.resolve(__dirname, "app/pages/pages.css"), to: "pages.css" },
        // /privacy and /terms, built from PRIVACY.md and TERMS.md
        ...LEGAL_PAGES.map((page) => ({
          from: path.resolve(__dirname, page.source),
          to: page.file,
          transform: (content) => renderLegalPage(content.toString(), page),
        })),
        // Android app links for the Play Store app (TWA)
        {
          from: path.resolve(__dirname, "app/assetlinks.json"),
          to: ".well-known/assetlinks.json",
        },
      ],
    }),
  ],
  resolve: {
    extensions: [".json", ".js"],
  },
  devtool: "source-map",
  devServer: {
    static: path.resolve(__dirname, "./app"),
    // like Hosting (firebase.json): /auth/action is the account email page, /privacy and
    // /terms the legal pages, the rest the game
    historyApiFallback: {
      rewrites: [
        { from: /^\/auth\/action\/?$/, to: "/auth-action.html" },
        ...LEGAL_PAGES.map((page) => ({
          from: new RegExp(`^${page.route}/?$`),
          to: `/${page.file}`,
        })),
      ],
    },
    host: "localhost",
    port: 2108,
    // ?emulators=1 talks to the Firebase emulators (pnpm emulators) through
    // this server, so the game, Auth, Firestore and Functions share one origin.
    proxy: [
      {
        context: ["/identitytoolkit.googleapis.com", "/securetoken.googleapis.com", "/emulator"],
        target: "http://127.0.0.1:9099",
      },
      { context: ["/google.firestore.v1.Firestore"], target: "http://127.0.0.1:8085" },
      { context: [`/${projectId}`], target: "http://127.0.0.1:5001" },
    ],
    open: true,
    client: {
      overlay: {
        warnings: true,
        errors: true,
      },
    },
  },
});
