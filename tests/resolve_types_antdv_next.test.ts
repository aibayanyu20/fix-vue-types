import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { describe, expect, it } from 'vitest'
import {
  createTypeResolveContext,
  extractRuntimeProps,
  registerTS,
} from '../src/oxcResolveTypes'

function findCall(node: any, name: string): any {
  if (!node || typeof node !== 'object')
    return undefined

  if (
    node.type === 'CallExpression'
    && node.callee?.type === 'Identifier'
    && node.callee.name === name
  ) {
    return node
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findCall(item, name)
        if (found)
          return found
      }
      continue
    }

    const found = findCall(value, name)
    if (found)
      return found
  }
}

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

function extractPropsFromAntdv(typeName: string, sourceModule = 'antdv-next') {
  registerTS(ts)
  const testDir = dirname(fileURLToPath(import.meta.url))
  const source = `
    import type { ${typeName} } from '${sourceModule}'
    const props = defineProps<${typeName}>()
  `
  const ctx = createTypeResolveContext({
    filename: join(testDir, `__tmp_antdv_next_${typeName}.tsx`),
    source,
  })
  const call = findCall(ctx.program, 'defineProps')
  const props = extractRuntimeProps(ctx, call)
  return { ctx, props }
}

describe('resolve types with antdv-next', () => {
  const testCase = hasPackage('antdv-next') ? it : it.skip

  testCase('resolves InputNumberProps and includes min/max from @v-c/input-number', () => {
    const { props } = extractPropsFromAntdv('InputNumberProps')

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
    const { props } = extractPropsFromAntdv('FormProps')
    const keys = new Set(props.map(prop => prop.key))
    expect(keys.has('prefixCls')).toBe(true)
  })

  testCase('resolves FormItemProps and includes vertical', () => {
    const { props } = extractPropsFromAntdv(
      'FormItemProps',
      'antdv-next/dist/form/FormItem/index',
    )

    const vertical = props.find(prop => prop.key === 'vertical')
    expect(vertical).toBeTruthy()
    expect(vertical?.type).toEqual(['Boolean'])
  })
})
