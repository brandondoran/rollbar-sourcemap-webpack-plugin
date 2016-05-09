import async from 'async';
import request from 'request';
import VError from 'verror';
import find from 'lodash.find';
import reduce from 'lodash.reduce';
import { handleError, validateOptions } from './helpers';
import { ROLLBAR_ENDPOINT } from './constants';

class RollbarSourceMapPlugin {
  constructor({
    accessToken,
    version,
    publicPath,
    includeChunks = [],
    silent = false
  }) {
    this.accessToken = accessToken;
    this.version = version;
    this.publicPath = publicPath;
    this.includeChunks = [].concat(includeChunks);
    this.silent = silent;
  }

  afterEmit(compilation, cb) {
    const errors = validateOptions(this);

    if (errors) {
      compilation.errors.push(...handleError(errors));
      return cb();
    }

    this.uploadSourceMaps(compilation, (err) => {
      if (err) {
        compilation.errors.push(...handleError(err));
      }
      cb();
    });
  }

  apply(compiler) {
    compiler.plugin('after-emit', this.afterEmit.bind(this));
  }

  getAssets(compilation) {
    const { includeChunks } = this;
    const { assetsByChunkName } = compilation.getStats().toJson();

    return reduce(assetsByChunkName, (result, assets, chunkName) => {
      if (includeChunks.length && includeChunks.indexOf(chunkName) === -1) {
        return result;
      }

      const sourceFile = find(assets, asset => /\.js$/.test(asset));
      const sourceMap = find(assets, asset => /\.js\.map$/.test(asset));

      if (!sourceFile || !sourceMap) {
        return result;
      }

      return [
        ...result,
        { sourceFile, sourceMap }
      ];
    }, {});
  }

  uploadSourceMap(compilation, { sourceFile, sourceMap }, cb) {
    const req = request.post(ROLLBAR_ENDPOINT, (err, res, body) => {
      if (!err && res.statusCode === 200) {
        if (!this.silent) {
          console.info(`\nUploaded ${sourceMap} to Rollbar`); // eslint-disable-line no-console
        }
        return cb();
      }

      const errMessage = `failed to upload ${sourceMap} to Rollbar`;
      if (err) {
        return cb(new VError(err, errMessage));
      }

      try {
        const { message } = JSON.parse(body);
        return cb(new Error(message ? `${errMessage}: ${message}` : errMessage));
      } catch (parseErr) {
        return cb(new VError(parseErr, errMessage));
      }
    });

    const form = req.form();
    form.append('access_token', this.accessToken);
    form.append('version', this.version);
    form.append('minified_url', `${this.publicPath}/${sourceFile}`);
    form.append('source_map', compilation.assets[sourceMap].source(), {
      filename: sourceMap,
      contentType: 'application/json'
    });
  }

  uploadSourceMaps(compilation, cb) {
    const assets = this.getAssets(compilation);
    const upload = this.uploadSourceMap.bind(this, compilation);

    async.each(assets, upload, (err, results) => {
      if (err) {
        return cb(err);
      }
      return cb(null, results);
    });
  }
}

module.exports = RollbarSourceMapPlugin;
