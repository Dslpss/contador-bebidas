const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const { PurgeCSSPlugin } = require("purgecss-webpack-plugin");
const glob = require("glob");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const Dotenv = require("dotenv-webpack");
require("dotenv").config();

const PATHS = {
  src: path.join(__dirname, "src"),
};

module.exports = (env, argv) => {
  const isProduction = argv.mode === "production";

  return {
    mode: argv.mode || "development",
    entry: {
      main: "./src/js/main.js",
      relatorio: "./src/js/relatorio.js",
      resultados: "./src/js/resultados.js",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].[contenthash].js",
      publicPath: "/",
      clean: true,
    },
    module: {
      rules: [
        {
          test: /\.js$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
            options: {
              presets: ["@babel/preset-env"],
              plugins: ["@babel/plugin-syntax-dynamic-import"],
            },
          },
        },
        {
          test: /\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : "style-loader",
            "css-loader",
            "postcss-loader",
          ],
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "./src/pages/index.html",
        filename: "index.html",
        chunks: ["main"],
      }),
      new HtmlWebpackPlugin({
        template: "./src/pages/relatorio.html",
        filename: "relatorio.html",
        chunks: ["relatorio"],
      }),
      new HtmlWebpackPlugin({
        template: "./src/pages/resultados.html",
        filename: "resultados.html",
        chunks: ["resultados"],
      }),
      new MiniCssExtractPlugin({
        filename: isProduction
          ? "css/[name].[contenthash].css"
          : "css/[name].css",
      }),
      new Dotenv(),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: path.resolve(__dirname, "src", "js", "service-worker.js"),
            to: path.resolve(__dirname, "dist"),
          },
          {
            from: path.resolve(__dirname, "src", "assets"),
            to: path.resolve(__dirname, "dist", "assets"),
            noErrorOnMissing: true,
          },
        ],
      }),
    ],
    devServer: {
      static: {
        directory: path.join(__dirname, "dist"),
      },
      compress: true,
      port: 9000,
      hot: true,
      historyApiFallback: true,
    },
    optimization: {
      minimize: isProduction,
      minimizer: [new TerserPlugin(), new CssMinimizerPlugin()],
      splitChunks: {
        chunks: "all",
        maxInitialRequests: Infinity,
        minSize: 0,
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name(module) {
              const packageName = module.context.match(
                /[\\/]node_modules[\\/](.*?)([\\/]|$)/
              )[1];
              return `npm.${packageName.replace("@", "")}`;
            },
          },
        },
      },
    },
    resolve: {
      extensions: [".js", ".json"],
    },
    devtool: isProduction ? "source-map" : "eval-source-map",
  };
};
