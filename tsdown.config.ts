import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: 'src/index.ts',
  dts: true,
  format: ['esm', 'cjs'],
  tsconfig: './tsconfig.app.json',
  outExtensions(ctx) {
    if (ctx.format === 'cjs') {
      return {
        dts: '.d.ts',
        js: '.cjs',
      }
    }
    return {
      dts: '.d.ts',
      js: '.js',
    }
  },
  external: [
    'typescript',
  ],
})
