const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const webpack = require('webpack');
require('dotenv').config();

module.exports = {
  entry: {
    main: './src/js/main.js',
    relatorio: './src/js/relatorio.js',
    resultados: './src/js/resultados.js'
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].bundle.js',
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
          'postcss-loader'
        ],
      },
    ],
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/pages/index.html',
      filename: 'index.html',
      chunks: ['main']
    }),
    new HtmlWebpackPlugin({
      template: './src/pages/relatorio.html',
      filename: 'relatorio.html',
      chunks: ['relatorio']
    }),
    new HtmlWebpackPlugin({
      template: './src/pages/resultados.html',
      filename: 'resultados.html',
      chunks: ['resultados']
    }),
    new MiniCssExtractPlugin({
      filename: 'styles.[contenthash].css',
    }),
    new webpack.DefinePlugin({
      'process.env': JSON.stringify(process.env)
    }),
  ],
  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    compress: true,
    port: 9000,
  },
  stats: {
    errors: true,
    warnings: true,
    errorDetails: true,
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
    },
  },
};
