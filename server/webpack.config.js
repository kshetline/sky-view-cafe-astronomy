const webpack = require('webpack');
const LicensePlugin = require('webpack-license-plugin');
const TerserPlugin = require('terser-webpack-plugin');
const path = require('path');
const mode = process.env.NODE_ENV || 'production';

// noinspection JSUnresolvedFunction
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
    // TODO: Minification breaks mysql. How to exclude mysql from minification, but include in output?
    minimize: false, // mode === 'production',
    minimizer: [new TerserPlugin({
      exclude: /node_modules\/mysql/,
      terserOptions: {
        output: { max_line_len: 511 },
      }
    })],
  },
  devtool: 'source-map',
  ignoreWarnings: [{ message: /require function is used in a way|the request of a dependency is an expression/ }],
  plugins: [
    new webpack.BannerPlugin({ banner: '#!/usr/bin/env node', raw: true }),
    new LicensePlugin({
      outputFilename: '3rdpartylicenses.txt',
      excludedPackageTest: name => /^(asynclist|emitter)/.test(name)
    })
  ]
};
