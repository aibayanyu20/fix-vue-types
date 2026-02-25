import type { TypeResolveContext } from '../src/resolveType'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSync } from 'oxc-parser'
import ts from 'typescript'
import { extractRuntimeEmits, extractRuntimeProps, registerTS } from '../src'

registerTS(() => ts)

const propsFixture = `
import { defineComponent } from 'vue'

interface Props {
  name: string
}
export const Code3 = defineComponent((props: Props = { name: '1' }) => {
  return () => <div>Code3</div>
})

export const Code32 = defineComponent<Props>((props = { name: '1' }) => {
  return () => <div>Code3</div>
})
`

const emitsFixture = `
import type { SetupContext } from 'vue'
import { defineComponent } from 'vue'

interface Emits {
  'change': [string]
  'click': [Event]
}
export const Inline2 = defineComponent({
  setup(props, { emit }: SetupContext<Emits>) {
    emit('change', 'inline')
    return () => <div>Inline2</div>
  },
})
`

const omitBuiltinFixture = `
import { defineComponent } from 'vue'

type Key = string | number

interface SeparatorType {
  key?: Key
}

interface Props extends SeparatorType {
  label?: string
  showArrow?: boolean
}

export default defineComponent<Omit<Props, 'key'>>(
  (props) => {
    return () => <div>{props.label}</div>
  },
  {
    name: 'X',
  },
)
`

function createExternalCtx(source: string, filename: string): TypeResolveContext & Record<string, any> {
  const { program, errors } = parseSync(filename, source, {
    lang: filename.endsWith('.tsx') ? 'tsx' : 'ts',
    sourceType: 'module',
    astType: 'ts',
  })
  if (errors.length)
    throw new Error(errors[0]!.message)

  const helperImports = new Set<string>()
  const ctx: TypeResolveContext & Record<string, any> = {
    filename,
    source,
    ast: program.body as any,
    options: {
      fs: {
        fileExists(file: string) {
          return existsSync(file)
        },
        readFile(file: string) {
          try {
            return readFileSync(file, 'utf-8')
          }
          catch {
            return undefined
          }
        },
      },
    },
    helper(key: string) {
      helperImports.add(key)
      return `_${key}`
    },
    helperImports,
    getString(node: any) {
      return source.slice(node.start!, node.end!)
    },
    error(msg: string, node?: any) {
      throw new Error(`[test-ctx] ${msg} @${node?.start ?? 'unknown'}`)
    },
    propsTypeDecl: undefined,
    propsRuntimeDefaults: undefined,
    propsDestructuredBindings: Object.create(null),
    emitsTypeDecl: undefined,
    isCE: false,
  }
  ctx.program = program as any
  return ctx
}

function findCall(node: any, name: string): any {
  if (!node || typeof node !== 'object')
    return undefined
  if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === name)
    return node
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const found = findCall(item, name)
        if (found)
          return found
      }
    }
    else {
      const found = findCall(value, name)
      if (found)
        return found
    }
  }
}

describe('base extractRuntime* with external OXC context', () => {
  it('extractRuntimeProps handles OXC Property defaults from assignment pattern', () => {
    const ctx = createExternalCtx(propsFixture, path.resolve(process.cwd(), 'tests/fixtures/repro-props.tsx'))
    const call = findCall(ctx.program, 'defineComponent')
    const fn = call.arguments[0]
    const param0 = fn.params[0]

    ctx.propsTypeDecl = param0.left.typeAnnotation.typeAnnotation
    ctx.propsRuntimeDefaults = param0.right

    const code = extractRuntimeProps(ctx)

    expect(code).toContain("default: '1'")
    expect(code).toContain('name')
  })

  it('extractRuntimeEmits handles OXC Literal keys in interface members', () => {
    const ctx = createExternalCtx(emitsFixture, path.resolve(process.cwd(), 'tests/fixtures/repro-emits.tsx'))
    const call = findCall(ctx.program, 'defineComponent')
    const setupProp = call.arguments[0].properties.find((p: any) => p.key?.name === 'setup')
    const setupFn = setupProp.value
    const ctxParam = setupFn.params[1]
    const setupContextRef = ctxParam.typeAnnotation.typeAnnotation
    ctx.emitsTypeDecl = setupContextRef.typeArguments.params[0]

    const emits = extractRuntimeEmits(ctx)

    expect(Array.from(emits).sort()).toEqual(['change', 'click'])
  })

  it('extractRuntimeProps handles OXC typeArguments for builtins like Omit', () => {
    const ctx = createExternalCtx(omitBuiltinFixture, path.resolve(process.cwd(), 'tests/fixtures/repro-omit-builtin.tsx'))
    const call = findCall(ctx.program, 'defineComponent')

    ctx.propsTypeDecl = call.typeArguments.params[0]

    const code = extractRuntimeProps(ctx)

    expect(code).toContain('label')
    expect(code).toContain('showArrow')
    expect(code).not.toContain('key:')
  })
})
