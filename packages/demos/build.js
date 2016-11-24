#!/usr/local/bin/node

// This is a copy/pasted version of devServer, tweaked to disable HMR.
//
// Putting off consolidating the two into a shared config file until pundle@2
// lands.

const Path = require('path')
const Pundle = require('pundle')
const writeFileSync = require('fs').writeFileSync;

const pundle = new Pundle({
  entry: [require.resolve('./src/index.ts')],
  pathType: 'filePath',
  rootDirectory: __dirname,
  replaceVariables: {
    'process.env.NODE_ENV': 'production',
  },
});

pundle.loadPlugins([
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
    pundle.loadLoaders([
      { extensions: ['.ts', '.tsx'], loader: require('pundle/lib/loaders/javascript').default },
    ])

    return pundle.compile();
  }
).then(
  () => pundle.generate({ sourceMap: true })
).then(
  generated => {
    writeFileSync('./site/dist/bundle.js', `${generated.contents}\n//# sourceMappingURL=bundle.js.map`);
    writeFileSync('./site/dist/bundle.js.map', JSON.stringify(generated.sourceMap));
  }
).catch(console.error);
