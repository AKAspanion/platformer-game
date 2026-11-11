const path = require("path");
const webpack = require("webpack");
const CopyPlugin = require("copy-webpack-plugin");
const ESLintPlugin = require("eslint-webpack-plugin");
// const TerserPlugin = require("terser-webpack-plugin");
const DashboardPlugin = require("webpack-dashboard/plugin");
// const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const { EsbuildPlugin } = require("esbuild-loader");

module.exports = {
  mode: "development",
  entry: path.resolve(__dirname, "./app/index.js"),
  output: {
    filename: "bundle.js",
    // Firebase (sign-in, shared worlds) is a separate chunk, loaded on demand
    chunkFilename: "chunks/[name].[contenthash:8].js",
    publicPath: "auto",
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
    // new CleanWebpackPlugin(),
    new DashboardPlugin(),
    // PREMIUM=1 unlocks premium by default (test builds).
    new webpack.DefinePlugin({
      PREMIUM_DEFAULT: JSON.stringify(process.env.PREMIUM === "1"),
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
    historyApiFallback: true,
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
      { context: ["/dinos-adventure"], target: "http://127.0.0.1:5001" },
    ],
    open: true,
    client: {
      overlay: {
        warnings: true,
        errors: true,
      },
    },
  },
};
