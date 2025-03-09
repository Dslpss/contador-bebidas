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
      filename: isProduction ? "[name].[contenthash].js" : "[name].js",
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
              presets: [
                [
                  "@babel/preset-env",
                  {
                    useBuiltIns: "usage",
                    corejs: 3,
                    targets: "> 0.25%, not dead",
                  },
                ],
              ],
              plugins: ["@babel/plugin-syntax-dynamic-import"],
              cacheDirectory: true, // Adicionar cache para compilações mais rápidas
            },
          },
        },
        {
          test: /\.css$/,
          use: [
            isProduction ? MiniCssExtractPlugin.loader : "style-loader",
            {
              loader: "css-loader",
              options: {
                importLoaders: 1,
              },
            },
            "postcss-loader",
          ],
        },
        // Adicionando otimização para imagens
        {
          test: /\.(png|svg|jpg|jpeg|gif|ico)$/i,
          type: "asset",
          parser: {
            dataUrlCondition: {
              maxSize: 8 * 1024, // 8kb - converter imagens menores para base64
            },
          },
        },
      ],
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: "./src/pages/index.html",
        filename: "index.html",
        chunks: ["main"],
        minify: isProduction
          ? {
              collapseWhitespace: true,
              removeComments: true,
              removeRedundantAttributes: true,
              useShortDoctype: true,
              removeEmptyAttributes: true,
              removeStyleLinkTypeAttributes: true,
              keepClosingSlash: true,
              minifyJS: true,
              minifyCSS: true,
              minifyURLs: true,
            }
          : false,
      }),
      new HtmlWebpackPlugin({
        template: "./src/pages/relatorio.html",
        filename: "relatorio.html",
        chunks: ["relatorio"],
        minify: isProduction
          ? {
              collapseWhitespace: true,
              removeComments: true,
              removeRedundantAttributes: true,
              removeEmptyAttributes: true,
            }
          : false,
      }),
      new HtmlWebpackPlugin({
        template: "./src/pages/resultados.html",
        filename: "resultados.html",
        chunks: ["resultados"],
        minify: isProduction
          ? {
              collapseWhitespace: true,
              removeComments: true,
              removeRedundantAttributes: true,
              removeEmptyAttributes: true,
            }
          : false,
      }),
      new MiniCssExtractPlugin({
        filename: isProduction
          ? "css/[name].[contenthash].css"
          : "css/[name].css",
      }),
      new Dotenv(),
      // Adicionar PurgeCSS para remover CSS não utilizado
      isProduction &&
        new PurgeCSSPlugin({
          paths: glob.sync(`${PATHS.src}/**/*`, { nodir: true }),
          safelist: {
            standard: [
              /^notification/,
              /^gradient-bg/,
              /^nav-item/,
              /^custom-button/,
            ],
            deep: [/^chart/, /modal/, /overlay/],
          },
        }),
      new webpack.optimize.ModuleConcatenationPlugin(), // Escopo de módulo para otimização
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
    ].filter(Boolean), // Remover plugins false/null
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
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            parse: {
              ecma: 8,
            },
            compress: {
              ecma: 5,
              warnings: false,
              comparisons: false,
              inline: 2,
              drop_console: isProduction,
            },
            mangle: {
              safari10: true,
            },
            output: {
              ecma: 5,
              comments: false,
              ascii_only: true,
            },
          },
          parallel: true,
        }),
        new CssMinimizerPlugin({
          minimizerOptions: {
            preset: ["default", { discardComments: { removeAll: true } }],
          },
        }),
      ],
      splitChunks: {
        chunks: "all",
        maxInitialRequests: 25, // Aumentar para permitir mais chunks
        minSize: 20000,
        maxSize: 250000, // Limitando tamanho dos chunks
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name(module) {
              const packageName = module.context.match(
                /[\\/]node_modules[\\/](.*?)([\\/]|$)/
              )[1];
              return `vendor.${packageName.replace("@", "")}`;
            },
            priority: 10,
          },
          firebase: {
            test: /[\\/]node_modules[\\/](firebase|@firebase)/,
            name: "firebase-bundle",
            priority: 20,
          },
          chart: {
            test: /[\\/]node_modules[\\/](chart\.js|chartjs)/,
            name: "chart-bundle",
            priority: 20,
          },
          commons: {
            name: "commons",
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
        },
      },
      runtimeChunk: "single",
    },
    resolve: {
      extensions: [".js", ".json"],
      modules: ["node_modules"],
      // Adicionando alias para imports mais curtos
      alias: {
        "@js": path.resolve(__dirname, "src/js/"),
        "@css": path.resolve(__dirname, "src/css/"),
        "@assets": path.resolve(__dirname, "src/assets/"),
      },
    },
    devtool: isProduction ? "source-map" : "eval-source-map",
    performance: {
      hints: isProduction ? "warning" : false,
      maxAssetSize: 500000, // 500KB
      maxEntrypointSize: 500000, // 500KB
    },
  };
};
