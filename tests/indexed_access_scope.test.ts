import type { TypeResolveContext } from '../src'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { walk } from 'oxc-walker'
import { parseSync } from 'oxc-parser'
import ts from 'typescript'
import { beforeEach, describe, expect, it } from 'vitest'
import { extractRuntimeProps, invalidateTypeCache, registerTS } from '../src'

registerTS(() => ts)

// vitest runs under jsdom here, where import.meta.url is not a file URL
const fixturesDir = path.resolve(process.cwd(), 'tests/fixtures/indexed-access')
const fixtureFiles = ['index.ts', 'interface.ts'].map(f => path.join(fixturesDir, f))

/**
 * Mirrors how vite-plugin-tsx-resolve-types drives the resolver: a raw OXC
 * program body as `ast`, a real filename so relative imports resolve, and
 * `defineProps<T>()` supplying the type declaration.
 */
function compileProps(source: string, filename = path.join(fixturesDir, '__virtual__.tsx')) {
  const { program, errors } = parseSync(filename, source, {
    lang: 'tsx',
    sourceType: 'module',
    astType: 'ts',
  })
  if (errors.length)
    throw new Error(errors[0]!.message)

  let propsTypeDecl: any
  walk(program as any, {
    enter(node: any) {
      if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'defineProps')
        propsTypeDecl = (node.typeArguments ?? node.typeParameters)?.params?.[0]
    },
  })
  expect(propsTypeDecl).toBeTruthy()

  const ctx = {
    filename,
    source,
    ast: program.body,
    options: {
      fs: {
        fileExists: (file: string) => existsSync(file),
        readFile: (file: string) => readFileSync(file, 'utf-8'),
      },
    },
    helper: (key: string) => `_${key}`,
    getString: (node: any) => source.slice(node.start, node.end),
    error(msg: string): never {
      throw new Error(msg)
    },
    propsTypeDecl,
    propsRuntimeDefaults: undefined,
    propsDestructuredBindings: Object.create(null),
    emitsTypeDecl: undefined,
    isCE: false,
  } as unknown as TypeResolveContext

  return extractRuntimeProps(ctx) ?? ''
}

const viaReExport = `
import type { ProgressProps } from './index'
defineProps<{
  strokeLinecap: ProgressProps['strokeLinecap']
  strokeWidth: ProgressProps['strokeWidth']
}>()
`

const viaDirectImport = `
import type { ProgressProps } from './interface'
defineProps<{
  strokeLinecap: ProgressProps['strokeLinecap']
}>()
`

const wholeInterface = `
import type { ProgressProps } from './interface'
defineProps<ProgressProps>()
`

describe('indexed access type keeps the declaring file scope', () => {
  beforeEach(() => {
    // Every test starts from a cold file-scope cache, like the first file a
    // build transforms.
    fixtureFiles.forEach(invalidateTypeCache)
  })

  it('resolves Props[\'key\'] through a re-export on a cold cache', () => {
    const code = compileProps(viaReExport)
    expect(code).toContain(`strokeLinecap: { type: String, required: true }`)
    expect(code).toContain(`strokeWidth: { type: Number, required: true }`)
  })

  it('resolves Props[\'key\'] through a direct import on a cold cache', () => {
    const code = compileProps(viaDirectImport)
    expect(code).toContain(`strokeLinecap: { type: String, required: true }`)
  })

  it('gives the same result whether or not another file resolved the interface first', () => {
    const cold = compileProps(viaReExport)

    fixtureFiles.forEach(invalidateTypeCache)
    expect(compileProps(wholeInterface)).toContain(`strokeLinecap: { type: String, required: false }`)
    const warm = compileProps(viaReExport)

    expect(cold).toBe(warm)
    expect(warm).toContain(`strokeLinecap: { type: String, required: true }`)
  })
})
