const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');
const path = require('path');
const mode = process.env.NODE_ENV || 'production';

module.exports = {
  mode,
  entry: './app/app.ts',
  target: 'node',
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'app.js'
  },
  node: {
    __dirname: false,
    __filename: false,
    global: true
  },
  resolve: {
    extensions: ['.ts', '.js'],
    mainFields: ['fesm2015', 'module', 'main']
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: [
          'ts-loader',
        ]
      }
    ]
  },
  optimization: {
    minimize: false, // mode === 'production',
    minimizer: [new TerserPlugin({
      terserOptions: {
        output: { max_line_len: 511 },
        exclude: /node_modules\/mysql/
      }
    })],
  },
  devtool: 'source-map',
  ignoreWarnings: [{ message: /require function is used in a way|the request of a dependency is an expression/ }],
  plugins: [
    new webpack.BannerPlugin({ banner: '#!/usr/bin/env node', raw: true })
  ]
};
