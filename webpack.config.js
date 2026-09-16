const path = require('path');

const crypto = require("crypto");
const crypto_orig_createHash = crypto.createHash;
crypto.createHash = algorithm => crypto_orig_createHash(algorithm == "md4" ? "sha256" : algorithm);

let entry = {
    'sviewer-browser': [ './js/sugarviewers.js' ],
    'sviewer-headless' : ['./js/headless.js']
};

try {
    var m = require('svgdom');
    // do stuff
} catch (ex) {
    delete entry['sviewer-headless'];
}


module.exports = {
  entry,
  mode: 'development',
  output: {
    filename: '[name].bundle.js',
    hashFunction: 'sha256',
    path: __dirname + '/dist'
  },
  resolve: {
    alias: {
      'fontkit' : path.resolve('./shim.js'),
      'glycan.js' : path.resolve('./node_modules/glycan.js')
    }
  },
  node: {
    fs: "empty"
  },
  module: {
    rules: [
    {
      test: /sugars\.svg$/,
      use: 'raw-loader'
    },
    {
      test: /\.js$/,
      exclude: /node_modules\/glycan\.js/,
      use: {
        loader: 'babel-loader',
        options: {
          plugins: ['@babel/plugin-transform-class-properties'],
          presets: [
            ['@babel/preset-env', {
              modules: false,
              corejs: 'core-js@2',
              useBuiltIns: 'entry',
              targets: {
                browsers: [
                  'Chrome >= 60',
                  'Safari >= 10.1',
                  'iOS >= 10.3',
                  'Firefox >= 54',
                  'Edge >= 15',
                ],
              },
            }],
          ],
        },
      },
    },
    {
      // glycan.js uses `import ... with { type: 'json' }` (needed for
      // Node's native ESM JSON loading) which webpack 4's own parser can't
      // read. Transpiling this package's modules to CommonJS lets babel
      // fully consume the import (stripping the attribute) before webpack
      // ever sees it, instead of passing the syntax through untouched.
      test: /\.js$/,
      include: /node_modules\/glycan\.js/,
      use: {
        loader: 'babel-loader',
        options: {
          plugins: ['@babel/plugin-transform-class-properties', '@babel/plugin-syntax-import-attributes'],
          presets: [
            ['@babel/preset-env', { modules: 'commonjs' }],
          ],
        },
      },
    }],
  },
};