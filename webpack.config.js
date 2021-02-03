const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const ESLintPlugin = require("eslint-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const DashboardPlugin = require("webpack-dashboard/plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");

module.exports = {
  mode: "development",
  entry: path.resolve(__dirname, "./app/index.js"),
  output: {
    filename: "bundle.js",
  },
  optimization: {
    minimize: true,
    minimizer: [new TerserPlugin()],
  },
  plugins: [
    new CleanWebpackPlugin(),
    new DashboardPlugin(),
    new ESLintPlugin({}),
    new CopyPlugin({
      patterns: [
        { from: path.resolve(__dirname, "app/sprites"), to: "sprites" },
        { from: path.resolve(__dirname, "app/index.html"), to: "index.html" },
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
