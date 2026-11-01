const path = require('path');
const webpack = require('webpack');

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
      'fontkit' : path.resolve('./shim.js')
    },
    fallback: {
      fs: false,
      path: false,
      stream: false,
      string_decoder: false,
      url: false
    }
  },
  plugins: [
    // svgdom imports node core modules via the `node:` URI scheme (e.g.
    // `node:fs`). Webpack treats that as a distinct, unhandled resource
    // scheme rather than a normal module request, so `resolve.fallback`
    // above never gets a chance to stub it out. Strip the prefix so these
    // requests fall through to the plain `fs`/`path`/`url` fallbacks.
    new webpack.NormalModuleReplacementPlugin(/^node:/, (resource) => {
      resource.request = resource.request.replace(/^node:/, '');
    }),
  ],
  module: {
    rules: [
    {
      test: /sugars\.svg$/,
      type: 'asset/source'
    },
    {
      test: /\.js$/,
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
    }],
  },
};