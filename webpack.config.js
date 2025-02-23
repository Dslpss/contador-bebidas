const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const webpack = require("webpack");
const TerserPlugin = require("terser-webpack-plugin");
const CssMinimizerPlugin = require("css-minimizer-webpack-plugin");
const { PurgeCSSPlugin } = require("purgecss-webpack-plugin");
const glob = require("glob");
const CopyWebpackPlugin = require("copy-webpack-plugin"); // Adicionado
require("dotenv").config();

const PATHS = {
  src: path.join(__dirname, "src"),
};

const isProduction = process.env.NODE_ENV === "production";

const config = {
  mode: process.env.NODE_ENV || "development",
  entry: {
    main: "./src/js/main.js",
    auth: "./src/js/auth.js",
    login: "./src/js/login.js",
    adminLogin: "./src/js/admin-login.js",
    admin: "./src/js/admin.js",
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
          MiniCssExtractPlugin.loader,
          {
            loader: "css-loader",
            options: {
              importLoaders: 1,
            },
          },
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
    new HtmlWebpackPlugin({
      template: "./src/pages/login.html",
      filename: "login.html",
      chunks: ["login"],
    }),
    new HtmlWebpackPlugin({
      template: "./src/pages/admin-login.html",
      filename: "admin-login.html",
      chunks: ["adminLogin"],
    }),
    new HtmlWebpackPlugin({
      template: "./src/pages/admin.html",
      filename: "admin.html",
      chunks: ["admin"],
    }),
    new MiniCssExtractPlugin({
      filename: "css/[name].[contenthash].css",
    }),
    new webpack.DefinePlugin({
      "process.env": JSON.stringify(process.env),
    }),
    new CopyWebpackPlugin({
      // Adicionado
      patterns: [
        {
          from: path.resolve(__dirname, "src", "js", "service-worker.js"),
          to: "service-worker.js",
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
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers":
        "X-Requested-With, content-type, Authorization",
    },
  },
  optimization: {
    minimize: true,
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
};

if (isProduction) {
  config.plugins.push(
    new PurgeCSSPlugin({
      paths: glob.sync(`${PATHS.src}/**/*`, { nodir: true }),
    })
  );

  config.performance = {
    hints: "warning",
    maxEntrypointSize: 512000,
    maxAssetSize: 512000,
  };
}

module.exports = config;
