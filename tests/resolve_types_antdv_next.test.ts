import type { TypeResolveContext } from '../src'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join } from 'node:path'
import { walk } from 'oxc-walker'
import { parseSync } from 'oxc-parser'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import { extractRuntimeProps, registerTS } from '../src'

registerTS(() => ts)

function hasPackage(name: string): boolean {
  const require = createRequire(import.meta.url)
  try {
    require.resolve(name)
    return true
  }
  catch {
    return false
  }
}

interface PropTypeData {
  key: string
  type: string[]
  required: boolean
}

/**
 * Drives the resolver the way vite-plugin-tsx-resolve-types does: a raw OXC
 * program as `ast`, a real filename so bare specifiers resolve through
 * TypeScript module resolution, and `defineProps<T>()` supplying the type.
 */
function extractPropsFromAntdv(typeName: string, sourceModule = 'antdv-next'): PropTypeData[] {
  // vitest runs under jsdom here, where import.meta.url is not a file URL
  const filename = join(process.cwd(), 'tests', `__tmp_antdv_next_${typeName}.tsx`)
  const source = `
    import type { ${typeName} } from '${sourceModule}'
    const props = defineProps<${typeName}>()
  `
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

  const code = extractRuntimeProps(ctx) ?? ''
  // `key: { type: X | [X, Y], required: bool }` lines of the generated object
  return [...code.matchAll(/^\s*(\w+): \{ (?:type: (\[[^\]]*\]|\w+), )?required: (true|false)/gm)].map(m => ({
    key: m[1]!,
    type: m[2] ? m[2].replace(/[[\]\s]/g, '').split(',').filter(Boolean) : [],
    required: m[3] === 'true',
  }))
}

describe('resolve types with antdv-next', () => {
  const testCase = hasPackage('antdv-next') ? it : it.skip

  testCase('resolves InputNumberProps and includes min/max from @v-c/input-number', () => {
    const props = extractPropsFromAntdv('InputNumberProps')

    expect(props.length).toBeGreaterThan(0)

    const keys = new Set(props.map(prop => prop.key))
    expect(keys.has('min')).toBe(true)
    expect(keys.has('max')).toBe(true)
    expect(keys.has('parser')).toBe(true)
    expect(keys.has('precision')).toBe(true)

    const minType = props.find(prop => prop.key === 'min')?.type ?? []
    const maxType = props.find(prop => prop.key === 'max')?.type ?? []
    expect(new Set(minType)).toEqual(new Set(['String', 'Number']))
    expect(new Set(maxType)).toEqual(new Set(['String', 'Number']))
  })

  testCase('resolves FormProps and includes prefixCls from base props', () => {
    const props = extractPropsFromAntdv('FormProps')
    const keys = new Set(props.map(prop => prop.key))
    expect(keys.has('prefixCls')).toBe(true)
  })

  testCase('resolves FormItemProps and includes vertical', () => {
    const props = extractPropsFromAntdv(
      'FormItemProps',
      'antdv-next/dist/form/FormItem/index',
    )

    const vertical = props.find(prop => prop.key === 'vertical')
    expect(vertical).toBeTruthy()
    expect(vertical?.type).toEqual(['Boolean'])
  })
})
