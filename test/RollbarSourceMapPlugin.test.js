import { promises as fs } from 'fs';
import nock from 'nock';
import RollbarSourceMapPlugin from '../src/RollbarSourceMapPlugin';
import { PLUGIN_NAME, ROLLBAR_ENDPOINT } from '../src/constants';

describe('RollbarSourceMapPlugin', () => {
  let compiler;
  let defaultOptions;
  let plugin;

  beforeEach(() => {
    compiler = {
      options: {},
      plugin: jest.fn(),
      hooks: {
        afterEmit: {
          tapPromise: jest.fn()
        }
      },
      resolvers: {
        loader: {
          plugin: jest.fn(),
          resolve: jest.fn()
        },
        normal: {
          plugin: jest.fn(),
          resolve: jest.fn()
        }
      }
    };

    defaultOptions = {
      accessToken: 'aaaabbbbccccddddeeeeffff00001111',
      version: 'master-latest-sha',
      publicPath: 'https://my.cdn.net/assets'
    };

    plugin = new RollbarSourceMapPlugin(defaultOptions);
  });

  describe('constructor', () => {
    it('returns an instance', () => {
      expect(plugin).toBeInstanceOf(RollbarSourceMapPlugin);
    });

    it('sets options', () => {
      const options = {
        ...defaultOptions,
        includeChunks: ['foo', 'bar'],
        silent: true
      };
      plugin = new RollbarSourceMapPlugin(options);
      expect(plugin).toMatchObject(options);
    });

    it('defaults silent to false', () => {
      expect(plugin.silent).toBe(false);
    });

    it('defaults includeChunks to []', () => {
      expect(plugin.includeChunks).toEqual([]);
    });

    it('accepts string value for includeChunks', () => {
      const options = { ...defaultOptions, includeChunks: 'foo' };
      plugin = new RollbarSourceMapPlugin(options);
      expect(plugin.includeChunks).toEqual(['foo']);
    });

    it('accepts array value for includeChunks', () => {
      const options = { ...defaultOptions, includeChunks: ['foo', 'bar'] };
      plugin = new RollbarSourceMapPlugin(options);
      expect(plugin.includeChunks).toEqual(['foo', 'bar']);
    });

    it('defaults rollbarEndpoint to ROLLBAR_ENDPOINT constant', () => {
      expect(plugin.rollbarEndpoint).toEqual(ROLLBAR_ENDPOINT);
    });

    it('access string value for rollbarEndpoint', () => {
      const customEndpoint = 'https://api.rollbar.custom.com/api/1/sourcemap';
      const options = { ...defaultOptions, rollbarEndpoint: customEndpoint };
      plugin = new RollbarSourceMapPlugin(options);
      expect(plugin).toMatchObject({ rollbarEndpoint: customEndpoint });
    });

    it('defaults encodeFilename = false', () => {
      expect(plugin.encodeFilename).toBe(false);
    });
  });

  describe('apply', () => {
    it('hooks into "after-emit"', () => {
      plugin.apply(compiler);
      expect(compiler.hooks.afterEmit.tapPromise).toHaveBeenCalledWith(
        PLUGIN_NAME,
        expect.any(Function)
      );
    });
  });

  describe('afterEmit', () => {
    let uploadSourceMaps;

    beforeEach(() => {
      uploadSourceMaps = jest
        .spyOn(plugin, 'uploadSourceMaps')
        .mockImplementation(() => {});
    });

    it('calls uploadSourceMaps', async () => {
      const compilation = {
        errors: [],
        warnings: []
      };

      await plugin.afterEmit(compilation);
      expect(uploadSourceMaps).toHaveBeenCalledTimes(1);
      expect(compilation.errors.length).toBe(0);
      expect(compilation.warnings.length).toBe(0);
    });

    it(
      'adds upload warnings to compilation warnings, ' +
        'if ignoreErrors is true and silent is false',
      async () => {
        const compilation = {
          errors: [],
          warnings: []
        };
        const err = new Error();
        plugin.ignoreErrors = true;
        plugin.silent = false;
        uploadSourceMaps = jest
          .spyOn(plugin, 'uploadSourceMaps')
          .mockImplementation(() => {
            throw err;
          });
        await plugin.afterEmit(compilation);
        expect(uploadSourceMaps).toHaveBeenCalledTimes(1);
        expect(compilation.errors.length).toBe(0);
        expect(compilation.warnings.length).toBe(1);
      }
    );

    it('does not add upload errors to compilation warnings if silent is true', async () => {
      const compilation = {
        errors: [],
        warnings: []
      };
      const err = new Error();
      plugin.ignoreErrors = true;
      plugin.silent = true;
      uploadSourceMaps = jest
        .spyOn(plugin, 'uploadSourceMaps')
        .mockImplementation(() => {
          throw err;
        });
      await plugin.afterEmit(compilation);
      expect(uploadSourceMaps).toHaveBeenCalledTimes(1);
      expect(compilation.errors.length).toBe(0);
      expect(compilation.warnings.length).toBe(0);
    });

    it('adds upload errors to compilation errors', async () => {
      const compilation = {
        errors: [],
        warnings: []
      };
      const err = new Error();
      plugin.ignoreErrors = false;
      uploadSourceMaps = jest
        .spyOn(plugin, 'uploadSourceMaps')
        .mockImplementationOnce(() => {
          throw err;
        });
      await plugin.afterEmit(compilation);
      expect(uploadSourceMaps).toHaveBeenCalledTimes(1);
      expect(compilation.warnings.length).toBe(0);
      expect(compilation.errors.length).toBe(1);
      expect(compilation.errors[0].cause()).toBe(err);
    });

    it('adds validation errors to compilation', async () => {
      const compilation = {
        errors: [],
        warnings: []
      };

      plugin = new RollbarSourceMapPlugin({
        version: 'master-latest-sha',
        publicPath: 'https://my.cdn.net/assets'
      });

      await plugin.afterEmit(compilation);
      expect(uploadSourceMaps).not.toHaveBeenCalled();
      expect(compilation.errors.length).toBe(1);
    });
  });

  describe('getPublicPath', () => {
    let sourceFile;

    beforeEach(() => {
      defaultOptions = {
        accessToken: 'aaaabbbbccccddddeeeeffff00001111',
        version: 'master-latest-sha',
        publicPath: 'https://my.cdn.net/assets/'
      };
      sourceFile = 'vendor.5190.js';
    });

    it("returns 'publicPath' value if it's a string", () => {
      plugin = new RollbarSourceMapPlugin(defaultOptions);
      const result = plugin.getPublicPath(sourceFile);
      expect(result).toBe('https://my.cdn.net/assets/vendor.5190.js');
    });

    it("handles 'publicPath' string without trailing /", () => {
      const options = {
        ...defaultOptions,
        publicPath: 'https://my.cdn.net/assets'
      };
      plugin = new RollbarSourceMapPlugin(options);
      const result = plugin.getPublicPath(sourceFile);
      expect(result).toBe('https://my.cdn.net/assets/vendor.5190.js');
    });

    it("returns whatever is returned by publicPath argument when it's a function", () => {
      const options = {
        ...defaultOptions,
        publicPath: srcFile => `https://my.function.proxy.cdn/assets/${srcFile}`
      };
      plugin = new RollbarSourceMapPlugin(options);
      const result = plugin.getPublicPath(sourceFile);
      expect(result).toBe(
        'https://my.function.proxy.cdn/assets/vendor.5190.js'
      );
    });

    it("returns whatever is returned by publicPath argument when it's a function", () => {
      const options = {
        ...defaultOptions,
        publicPath: srcFile => `https://my.function.proxy.cdn/assets/${srcFile}`
      };
      plugin = new RollbarSourceMapPlugin(options);
      const result = plugin.getPublicPath(sourceFile);
      expect(result).toBe(
        'https://my.function.proxy.cdn/assets/vendor.5190.js'
      );
    });
  });

  describe('getAssets', () => {
    let chunks;
    let compilation;
    beforeEach(() => {
      chunks = [
        {
          id: 0,
          names: ['vendor'],
          files: ['vendor.5190.js', 'vendor.5190.js.map']
        },
        {
          id: 1,
          names: ['app'],
          files: ['app.81c1.js', 'app.81c1.js.map']
        }
      ];

      compilation = {
        getStats: () => ({
          toJson: () => ({ chunks })
        })
      };
    });

    it('returns an array of js, sourcemap tuples', () => {
      const assets = plugin.getAssets(compilation);
      expect(assets).toEqual([
        { sourceFile: 'vendor.5190.js', sourceMap: 'vendor.5190.js.map' },
        { sourceFile: 'app.81c1.js', sourceMap: 'app.81c1.js.map' }
      ]);
    });

    it('ignores chunks that do not have a sourcemap asset', () => {
      chunks = [
        {
          id: 0,
          names: ['vendor'],
          files: ['vendor.5190.js']
        },
        {
          id: 1,
          names: ['app'],
          files: ['app.81c1.js', 'app.81c1.js.map']
        }
      ];
      const assets = plugin.getAssets(compilation);
      expect(assets).toEqual([
        { sourceFile: 'app.81c1.js', sourceMap: 'app.81c1.js.map' }
      ]);
    });

    it('handles multiple source files', () => {
      chunks = [
        {
          id: 1,
          names: ['app'],
          files: [
            'app.81c1.js',
            'app.81c1.js.map',
            'app.81c1.esm.js',
            'app.81c1.esm.js.map'
          ]
        }
      ];
      const assets = plugin.getAssets(compilation);
      expect(assets).toEqual([
        { sourceFile: 'app.81c1.js', sourceMap: 'app.81c1.js.map' },
        { sourceFile: 'app.81c1.esm.js', sourceMap: 'app.81c1.esm.js.map' }
      ]);
    });

    it('includes unnamed chunks when includeChunks is not specified', () => {
      chunks = [
        {
          id: 0,
          names: ['vendor'],
          files: ['vendor.5190.js', 'vendor.5190.js.map']
        },
        {
          id: 1,
          names: [],
          files: ['1.cfea.js', '1.cfea.js.map']
        },
        {
          id: 2,
          names: [],
          files: ['2-a364.js', '2-a364.js.map']
        },
        {
          id: 3,
          names: ['app'],
          files: ['app.81c1.js', 'app.81c1.js.map']
        }
      ];
      const assets = plugin.getAssets(compilation);
      expect(assets).toEqual([
        { sourceFile: 'vendor.5190.js', sourceMap: 'vendor.5190.js.map' },
        { sourceFile: '1.cfea.js', sourceMap: '1.cfea.js.map' },
        { sourceFile: '2-a364.js', sourceMap: '2-a364.js.map' },
        { sourceFile: 'app.81c1.js', sourceMap: 'app.81c1.js.map' }
      ]);
    });

    it('filters out chunks that are not in includeChunks', () => {
      plugin.includeChunks = ['app'];
      const assets = plugin.getAssets(compilation);
      expect(assets).toEqual([
        { sourceFile: 'app.81c1.js', sourceMap: 'app.81c1.js.map' }
      ]);
    });

    it('encodes filename if encodeFilename is set to true', () => {
      chunks = [
        {
          id: 0,
          names: ['vendor'],
          files: ['[test].vendor.5190.js', '[test].vendor.5190.js.map']
        }
      ];

      plugin.encodeFilename = true;

      const assets = plugin.getAssets(compilation);
      expect(assets).toEqual([
        {
          sourceFile: '%5Btest%5D.vendor.5190.js',
          sourceMap: '[test].vendor.5190.js.map'
        }
      ]);
    });

    it('works with webpack 5', () => {
      chunks = [
        {
          id: 0,
          names: ['vendor'],
          files: ['vendor.5190.js'],
          auxiliaryFiles: ['vendor.5190.js.map']
        }
      ];

      const assets = plugin.getAssets(compilation);
      expect(assets).toEqual([
        { sourceFile: 'vendor.5190.js', sourceMap: 'vendor.5190.js.map' }
      ]);
    });
  });

  describe('uploadSourceMaps', () => {
    let compilation;
    let assets;
    let getAssets;
    let uploadSourceMap;

    beforeEach(() => {
      compilation = { name: 'test', errors: [] };
      assets = [
        { sourceFile: 'vendor.5190.js', sourceMap: 'vendor.5190.js.map' },
        { sourceFile: 'app.81c1.js', sourceMap: 'app.81c1.js.map' }
      ];
      getAssets = jest.spyOn(plugin, 'getAssets').mockReturnValueOnce(assets);
      uploadSourceMap = jest
        .spyOn(plugin, 'uploadSourceMap')
        .mockImplementation(() => {});
    });

    it('calls uploadSourceMap for each chunk', async () => {
      await plugin.uploadSourceMaps(compilation);
      expect(getAssets).toHaveBeenCalledTimes(1);
      expect(compilation.errors.length).toBe(0);
      expect(uploadSourceMap).toHaveBeenCalledTimes(2);

      expect(uploadSourceMap).toHaveBeenNthCalledWith(
        1,
        { name: 'test', errors: [] },
        { sourceFile: 'vendor.5190.js', sourceMap: 'vendor.5190.js.map' }
      );

      expect(uploadSourceMap).toHaveBeenNthCalledWith(
        2,
        { name: 'test', errors: [] },
        { sourceFile: 'app.81c1.js', sourceMap: 'app.81c1.js.map' }
      );
    });

    it('throws if uploadSourceMap errors', async () => {
      const err = new Error();
      uploadSourceMap = jest
        .spyOn(plugin, 'uploadSourceMap')
        .mockRejectedValueOnce(err);
      await expect(plugin.uploadSourceMaps(compilation)).rejects.toThrow(err);
    });
  });

  describe('uploadSourceMap', () => {
    const outputPath = '/some/fake/path/';
    let info;
    let compilation;
    let chunk;
    let spyReadFile;

    beforeEach(() => {
      compilation = {
        assets: {
          'vendor.5190.js.map': { source: () => '{"version":3,"sources":[]' },
          'app.81c1.js.map': { source: () => '{"version":3,"sources":[]' }
        },
        compiler: {
          outputPath
        },
        errors: [],
        getPath: () => outputPath
      };

      chunk = {
        sourceFile: 'vendor.5190.js',
        sourceMap: 'vendor.5190.js.map'
      };

      spyReadFile = jest
        .spyOn(fs, 'readFile')
        .mockImplementation(() => Promise.resolve('data'));
    });

    it('logs to console if upload is success', async () => {
      info = jest.spyOn(console, 'info').mockImplementation();
      const scope = nock('https://api.rollbar.com:443') // eslint-disable-line no-unused-vars
        .post('/api/1/sourcemap')
        .reply(200, JSON.stringify({ err: 0, result: 'master-latest-sha' }));

      await plugin.uploadSourceMap(compilation, chunk);
      expect(info).toHaveBeenCalledWith(
        'Uploaded vendor.5190.js.map to Rollbar'
      );
    });

    it('does not log upload to console if silent option is true', async () => {
      info = jest.spyOn(console, 'info').mockImplementation();
      const scope = nock('https://api.rollbar.com:443') // eslint-disable-line no-unused-vars
        .post('/api/1/sourcemap')
        .reply(200, JSON.stringify({ err: 0, result: 'master-latest-sha' }));

      plugin.silent = true;
      await plugin.uploadSourceMap(compilation, chunk);
      expect(info).not.toHaveBeenCalled();
    });

    it('logs upload to console if silent option is false', async () => {
      const scope = nock('https://api.rollbar.com:443') // eslint-disable-line no-unused-vars
        .post('/api/1/sourcemap')
        .reply(200, JSON.stringify({ err: 0, result: 'master-latest-sha' }));

      plugin.silent = false;
      await plugin.uploadSourceMap(compilation, chunk);
      expect(info).toHaveBeenCalledWith(
        'Uploaded vendor.5190.js.map to Rollbar'
      );
    });

    it('returns error message if failure response includes message', async () => {
      const scope = nock('https://api.rollbar.com:443') // eslint-disable-line no-unused-vars
        .post('/api/1/sourcemap')
        .reply(
          422,
          JSON.stringify({ err: 1, message: 'missing source_map file upload' })
        );

      await expect(plugin.uploadSourceMap(compilation, chunk)).rejects.toThrow(
        'failed to upload vendor.5190.js.map to Rollbar: missing source_map file upload'
      );
    });

    it('returns error message if unable to read sourceMap file', async () => {
      const err = new Error('ENOENT: no such file or directory');
      spyReadFile.mockImplementationOnce(() => Promise.reject(err));
      await expect(plugin.uploadSourceMap(compilation, chunk)).rejects.toThrow(
        `failed to upload vendor.5190.js.map to Rollbar: ${err.message}`
      );
    });

    it('returns response status text if response body does not have message', async () => {
      const scope = nock('https://api.rollbar.com:443') // eslint-disable-line no-unused-vars
        .post('/api/1/sourcemap')
        .reply(422, JSON.stringify({ err: 1 }));

      await expect(plugin.uploadSourceMap(compilation, chunk)).rejects.toThrow(
        'failed to upload vendor.5190.js.map to Rollbar: 422 - Unprocessable Entity'
      );
    });

    it('handles error response with empty body', async () => {
      const scope = nock('https://api.rollbar.com:443') // eslint-disable-line no-unused-vars
        .post('/api/1/sourcemap')
        .reply(422, null);

      await expect(plugin.uploadSourceMap(compilation, chunk)).rejects.toThrow(
        'failed to upload vendor.5190.js.map to Rollbar: 422 - Unprocessable Entity'
      );
    });

    it('handles error response with body not in JSON format', async () => {
      const scope = nock('https://api.rollbar.com:443') // eslint-disable-line no-unused-vars
        .post('/api/1/sourcemap')
        .reply(422, '<html></html>');

      await expect(plugin.uploadSourceMap(compilation, chunk)).rejects.toThrow(
        'failed to upload vendor.5190.js.map to Rollbar: 422 - Unprocessable Entity'
      );
    });

    it('handles HTTP request error', async () => {
      const scope = nock('https://api.rollbar.com:443') // eslint-disable-line no-unused-vars
        .post('/api/1/sourcemap')
        .replyWithError('something awful happened');

      await expect(plugin.uploadSourceMap(compilation, chunk)).rejects.toThrow(
        `failed to upload vendor.5190.js.map to Rollbar: request to ${ROLLBAR_ENDPOINT} failed, reason: something awful happened`
      );
    });
  });
});
