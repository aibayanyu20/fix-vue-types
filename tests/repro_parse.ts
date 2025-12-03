import { parse } from '@babel/parser'

const source = `import { CompilerOptions } from '@vue/compiler-dom';
import { RenderFunction } from '@vue/runtime-dom';
export * from '@vue/runtime-dom';

export declare function compileToFunction(template: string | HTMLElement, options?: CompilerOptions): RenderFunction;

export { compileToFunction as compile };
`

const plugins = [
  'importAttributes',
  ['typescript', { dts: true }],
  'explicitResourceManagement',
  'decorators-legacy'
]

try {
  const ast = parse(source, {
    plugins: plugins as any,
    sourceType: 'module'
  })
  console.log('Body length:', ast.program.body.length)
  console.log('Statements:', ast.program.body.map(s => s.type))
} catch (e) {
  console.error(e)
}
