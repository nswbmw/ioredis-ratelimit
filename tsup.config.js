import { defineConfig } from 'tsup'

export default defineConfig([
  // ESM build
  {
    entry: ['index.js'],
    format: 'esm',
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: true,
    minify: false,
    bundle: false,
    outDir: 'dist/esm',
    target: 'es2020',
    esbuildOptions (options) {
      options.drop = ['debugger']
      options.legalComments = 'none'
    }
  },
  // CJS build
  {
    entry: ['index.js'],
    format: 'cjs',
    dts: false,
    splitting: false,
    sourcemap: false,
    clean: true,
    minify: false,
    bundle: false,
    outDir: 'dist/cjs',
    target: 'es2020',
    outExtension () {
      return { js: '.js' }
    },
    esbuildOptions (options) {
      options.drop = ['debugger']
      options.legalComments = 'none'
    }
  }
])
