# RollbarSourceMapPlugin

[![Dependency Status](https://img.shields.io/david/thredup/rollbar-sourcemap-webpack-plugin.svg?style=flat-square)](https://david-dm.org/thredup/rollbar-sourcemap-webpack-plugin)
[![devDependency Status](https://img.shields.io/david/dev/thredup/rollbar-sourcemap-webpack-plugin.svg?maxAge=2592000?style=flat-square)](https://david-dm.org/thredup/rollbar-sourcemap-webpack-plugin#info=devDependencies)
[![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=thredup/rollbar-sourcemap-webpack-plugin)](https://dependabot.com)
[![Actions Status](https://github.com/thredup/rollbar-sourcemap-webpack-plugin/workflows/CI/badge.svg)](https://github.com/thredup/rollbar-sourcemap-webpack-plugin/actions)
[![Downloads](https://img.shields.io/npm/dm/rollbar-sourcemap-webpack-plugin.svg?style=flat-square)](https://www.npmjs.com/package/rollbar-sourcemap-webpack-plugin)

This is a [Webpack](https://webpack.github.io) plugin that simplifies uploading the sourcemaps,
generated from a webpack build, to [Rollbar](https://rollbar.com).

Production JavaScript bundles are typically minified before deploying,
making Rollbar stacktraces pretty useless unless you take steps to upload the sourcemaps.
You may be doing this now in a shell script, triggered during your deploy process,
that makes curl posts to the Rollbar API. This can be finicky and error prone to setup.
RollbarSourceMapPlugin aims to remove that burden and automatically upload the sourcemaps when they are emitted by webpack.

## Prerequisites

**As of version 3.0.0, Webpack 4 is required. This plugin is no longer compatible with Webpack 3 and older.**

## Installation

Install the plugin with npm:

```shell
npm install rollbar-sourcemap-webpack-plugin --save-dev
```

## Basic Usage

An example webpack.config.js:

```javascript
const RollbarSourceMapPlugin = require('rollbar-sourcemap-webpack-plugin')

const PUBLIC_PATH = 'https://my.cdn.net/assets'

const webpackConfig = {
  mode: 'production',
  devtool: 'hidden-source-map'
  entry: 'index',
  publicPath: PUBLIC_PATH,
  output: {
    path: 'dist',
    filename: 'index-[hash].js'
  },
  plugins: [new RollbarSourceMapPlugin({
    accessToken: 'aaaabbbbccccddddeeeeffff00001111',
    version: 'version_string_here',
    publicPath: PUBLIC_PATH
  })]
}
```

## Plugin Configuration

You can pass a hash of configuration options to `RollbarSourceMapPlugin`.
Allowed values are as follows:

### `accessToken: string` **(required)**

Your rollbar `post_server_item` access token.

### `version: string` **(required)**

A string identifying the version of your code this source map package is for. Typically this will be the full git sha.

### `publicPath: string | function(string): string` **(required)**

The base url for the cdn where your production bundles are hosted or a function that receives the source file local address and returns the url for that file in the cdn where your production bundles are hosted.
You should use the function form when your project has some kind of divergence between url routes and actual folder structure.
For example: NextJs projects can serve bundled files in the following url `http://my.app/_next/123abc123abc123/page/home.js` but have a folder structure like this `APP_ROOT/build/bundles/pages/home.js`.
The function form allows you to transform the final public url in order to conform with your routing needs.

### `includeChunks: string | [string]` **(optional)**

An array of chunks for which sourcemaps should be uploaded.
This should correspond to the names in the webpack config `entry` field.
If there's only one chunk, it can be a string rather than an array.
If not supplied, all sourcemaps emitted by webpack will be uploaded, including those for unnamed chunks.

### `silent: boolean` **(default: `false`)**

If `false`, success and warning messages will be logged to the console for each upload. Note: if you also do not want to see errors, set the `ignoreErrors` option to `true`.

### `ignoreErrors: boolean` **(default: `false`)**

Set to `true` to bypass adding upload errors to the webpack compilation. Do this if you do not want to fail the build when sourcemap uploads fail.
If you do not want to fail the build but you do want to see the failures as warnings, make sure `silent` option is set to `false`.

### `rollbarEndpoint: string` **(default: `https://api.rollbar.com/api/1/sourcemap`)**

A string defining the Rollbar API endpoint to upload the sourcemaps to. It can be used for self-hosted Rollbar instances.

### `encodeFilename: boolean` **(default: `false`)**

Set to true to encode the filename. NextJS will reference the encode the URL when referencing the minified script which must match exactly with the minified file URL uploaded to Rollbar.

### `retry: number` **(default: `null`)**

The amount of retries that will be performed to upload the sourcemap to Rollbar in case the upload fails.

## Webpack Sourcemap Configuration

The [`output.devtool`](https://webpack.js.org/configuration/devtool/) field in webpack configuration controls how sourcemaps are generated.
The recommended setup for sourcemaps in a production app is to use hidden sourcemaps.
This will include original sources in your sourcemaps, which will be uploaded to Rollbar and NOT to a public location alongside the minified javascript.
The `hidden` prefix will prevent `//# sourceMappingURL=URL_TO_SOURCE_MAP` from being inserted in the minified javascript.
This is important because if the `sourceMappingURL` comment is present,
Rollbar will attempt to download the sourcemap from this url, which negates the whole
purpose of this plugin. And since you are not uploading sourcemaps to a public location,
Rollbar would not be able to download the sourcemaps.

### webpack.config.js

```json
output: {
  devtool: 'hidden-source-map'
}
```

## App Configuration

- The web app should have [Rollbar.js](https://www.npmjs.com/package/rollbar) installed and configured for webpack as described [here](https://github.com/rollbar/rollbar.js/tree/master/examples/webpack#using-rollbar-with-webpack).
- See the [Rollbar source map](https://rollbar.com/docs/source-maps/) documentation
  for how to configure the client side for sourcemap support.
  The `code_version` parameter must match the `version` parameter used for the plugin.
- More general info on the using [Rollbar for browser JS](https://rollbar.com/docs/notifier/rollbar.js/).

## Examples

- [React](https://github.com/thredup/rollbar-sourcemap-webpack-plugin/tree/master/examples/react)
- [Next.js](https://github.com/thredup/rollbar-sourcemap-webpack-plugin/tree/master/examples/next-js)

## Contributing

See the [Contributors Guide](/CONTRIBUTING.md)

## License

[MIT](/LICENSE.md)
