#!/usr/local/bin/node

const Path = require('path')
const PundleDev = require('pundle-dev')

const server = new PundleDev({
  server: {
    hmr: true,
    port: 8080,
    hmrPath: '/dist/bundle_hmr',
    bundlePath: '/dist/bundle.js',
    sourceRoot: Path.join(__dirname, 'site'),
    sourceMapPath: '/dist/bundle.js.map',
    error(error) {
      console.error(error)
    }
  },
  pundle: {
    entry: [require.resolve('./src/index.ts')],
    pathType: 'filePath',
    rootDirectory: __dirname,
    replaceVariables: {
      'process.env.NODE_ENV': 'development',
    }
  },
  watcher: { },
  generator: {
    wrapper: 'hmr',
    sourceMap: true
  }
})

server.pundle.loadPlugins([
  [
    'typescript-pundle',
    {
      config: {
        // jsxFactory needs typescript@next, but typescript-pundle loads stable
        // by default
        typescriptPath: require.resolve('typescript'),
        compilerOptions: {
          jsx: 'react',
          jsxFactory: 'html',
          strictNullChecks: true,
        }
      }
    }
  ]
]).then(
  () => {
    server.pundle.loadLoaders([
      {
        extensions: ['.ts', '.tsx'],
        loader: require('pundle/lib/loaders/javascript').default
      },
    ])
    return server.activate()
  }
).then(
  () => console.log('Dev server is listening')
).catch(console.error)
