const path = require("path");
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
      ],
    }),
  ],
  resolve: {
    extensions: [".json", ".js"],
  },
  devtool: "source-map",
  devServer: {
    contentBase: path.resolve(__dirname, "./app"),
    historyApiFallback: true,
    inline: true,
    host: "localhost",
    port: 2108,
    open: true,
    overlay: {
      warnings: true,
      errors: true,
    },
  },
};
