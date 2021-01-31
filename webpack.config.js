const path = require("path");
const ESLintPlugin = require("eslint-webpack-plugin");
const DashboardPlugin = require("webpack-dashboard/plugin");

module.exports = {
  mode: "development",
  entry: path.resolve(__dirname, "./app/index.js"),
  watch: true,
  output: {
    filename: "bundle.js",
  },
  plugins: [new DashboardPlugin(), new ESLintPlugin({})],
  module: {
    rules: [
      {
        test: /\.(js)$/,
        include: [path.resolve(__dirname, "app")],
        exclude: [path.resolve(__dirname, "node_modules")],
        loader: "babel-loader",
        query: {
          presets: [
            [
              "@babel/env",
              {
                targets: {
                  browsers: "last 2 chrome versions",
                },
              },
            ],
          ],
        },
      },
    ],
  },
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
