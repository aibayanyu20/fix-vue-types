import { BindingTypes } from '@vue/compiler-core'
import { describe, expect, it } from 'vitest'
import { assertCode, compile } from './utils'

describe('defineProps', () => {
  it('basic usage', () => {
    const { content, bindings } = compile(`
<script setup>
const props = defineProps({
  foo: String
})
const bar = 1
</script>
  `)
    // should generate working code
    assertCode(content)
    // should analyze bindings
    expect(bindings).toMatchObject({
      foo: BindingTypes.PROPS,
    })

    expect(content).toMatch(`foo: String`)
  })

  it('w/ external definition', () => {
    const { content } = compile(`
    <script setup>
    import { propsModel } from './props'
    const props = defineProps(propsModel)
    </script>
      `)
    assertCode(content)
    // In our extracted version, we might not handle runtime props fully if they are just passed through
    // But let's see what extractRuntimeProps does.
    // Actually extractRuntimeProps only handles type-based declaration if propsTypeDecl is present.
    // If propsRuntimeDecl is present, it returns it as string.
    // My utils.ts handles this.
  })

  it('w/ type', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface Test {}

    type Alias = number[]

    defineProps<{
      string: string
      number: number
      boolean: boolean
      object: object
      objectLiteral: { a: number }
      fn: (n: number) => void
      functionRef: Function
      objectRef: Object
      dateTime: Date
      array: string[]
      arrayRef: Array<any>
      tuple: [number, number]
      set: Set<string>
      literal: 'foo'
      optional?: any
      recordRef: Record<string, null>
      interface: Test
      alias: Alias
      method(): void
      symbol: symbol
      error: Error
      extract: Extract<1 | 2 | boolean, 2>
      exclude: Exclude<1 | 2 | boolean, 2>
      uppercase: Uppercase<'foo'>
      params: Parameters<(foo: any) => void>
      nonNull: NonNullable<string | null>
      objectOrFn: {
        (): void
        foo: string
      }

      union: string | number
      literalUnion: 'foo' | 'bar'
      literalUnionNumber: 1 | 2 | 3 | 4 | 5
      literalUnionMixed: 'foo' | 1 | boolean
      intersection: Test & {}
      intersection2: 'foo' & ('foo' | 'bar')
      foo: ((item: any) => boolean) | null

      unknown: UnknownType
      unknownUnion: UnknownType | string
      unknownIntersection: UnknownType & Object
      unknownUnionWithBoolean: UnknownType | boolean
      unknownUnionWithFunction: UnknownType | (() => any)
    }>()
    </script>`)
    assertCode(content)
    expect(content).toMatch(`string: { type: String, required: true }`)
    expect(content).toMatch(`number: { type: Number, required: true }`)
    expect(content).toMatch(`boolean: { type: Boolean, required: true }`)
    expect(content).toMatch(`object: { type: Object, required: true }`)
    expect(content).toMatch(`objectLiteral: { type: Object, required: true }`)
    expect(content).toMatch(`fn: { type: Function, required: true }`)
    expect(content).toMatch(`functionRef: { type: Function, required: true }`)
    expect(content).toMatch(`objectRef: { type: Object, required: true }`)
    expect(content).toMatch(`dateTime: { type: Date, required: true }`)
    expect(content).toMatch(`array: { type: Array, required: true }`)
    expect(content).toMatch(`arrayRef: { type: Array, required: true }`)
    expect(content).toMatch(`tuple: { type: Array, required: true }`)
    expect(content).toMatch(`set: { type: Set, required: true }`)
    expect(content).toMatch(`literal: { type: String, required: true }`)
    expect(content).toMatch(`optional: { type: null, required: false }`)
    expect(content).toMatch(`recordRef: { type: Object, required: true }`)
    expect(content).toMatch(`interface: { type: Object, required: true }`)
    expect(content).toMatch(`alias: { type: Array, required: true }`)
    expect(content).toMatch(`method: { type: Function, required: true }`)
    expect(content).toMatch(`symbol: { type: Symbol, required: true }`)
    expect(content).toMatch(`error: { type: Error, required: true }`)
    expect(content).toMatch(
      `objectOrFn: { type: [Function, Object], required: true },`,
    )
    expect(content).toMatch(`extract: { type: Number, required: true }`)
    expect(content).toMatch(
      `exclude: { type: [Number, Boolean], required: true }`,
    )
    expect(content).toMatch(`uppercase: { type: String, required: true }`)
    expect(content).toMatch(`params: { type: Array, required: true }`)
    expect(content).toMatch(`nonNull: { type: String, required: true }`)
    expect(content).toMatch(`union: { type: [String, Number], required: true }`)
    expect(content).toMatch(`literalUnion: { type: String, required: true }`)
    expect(content).toMatch(
      `literalUnionNumber: { type: Number, required: true }`,
    )
    expect(content).toMatch(
      `literalUnionMixed: { type: [String, Number, Boolean], required: true }`,
    )
    expect(content).toMatch(`intersection: { type: Object, required: true }`)
    expect(content).toMatch(`intersection2: { type: String, required: true }`)
    expect(content).toMatch(`foo: { type: [Function, null], required: true }`)
    expect(content).toMatch(`unknown: { type: null, required: true }`)
    // uninon containing unknown type: skip check
    expect(content).toMatch(`unknownUnion: { type: null, required: true }`)
    // intersection containing unknown type: narrow to the known types
    expect(content).toMatch(
      `unknownIntersection: { type: Object, required: true },`,
    )
    expect(content).toMatch(
      `unknownUnionWithBoolean: { type: Boolean, required: true, skipCheck: true },`,
    )
    expect(content).toMatch(
      `unknownUnionWithFunction: { type: Function, required: true, skipCheck: true }`,
    )
    expect(bindings).toMatchObject({
      string: BindingTypes.PROPS,
      number: BindingTypes.PROPS,
      boolean: BindingTypes.PROPS,
      object: BindingTypes.PROPS,
      objectLiteral: BindingTypes.PROPS,
      fn: BindingTypes.PROPS,
      functionRef: BindingTypes.PROPS,
      objectRef: BindingTypes.PROPS,
      dateTime: BindingTypes.PROPS,
      array: BindingTypes.PROPS,
      arrayRef: BindingTypes.PROPS,
      tuple: BindingTypes.PROPS,
      set: BindingTypes.PROPS,
      literal: BindingTypes.PROPS,
      optional: BindingTypes.PROPS,
      recordRef: BindingTypes.PROPS,
      interface: BindingTypes.PROPS,
      alias: BindingTypes.PROPS,
      method: BindingTypes.PROPS,
      symbol: BindingTypes.PROPS,
      error: BindingTypes.PROPS,
      objectOrFn: BindingTypes.PROPS,
      extract: BindingTypes.PROPS,
      exclude: BindingTypes.PROPS,
      union: BindingTypes.PROPS,
      literalUnion: BindingTypes.PROPS,
      literalUnionNumber: BindingTypes.PROPS,
      literalUnionMixed: BindingTypes.PROPS,
      intersection: BindingTypes.PROPS,
      intersection2: BindingTypes.PROPS,
      foo: BindingTypes.PROPS,
      uppercase: BindingTypes.PROPS,
      params: BindingTypes.PROPS,
      nonNull: BindingTypes.PROPS,
      unknown: BindingTypes.PROPS,
      unknownUnion: BindingTypes.PROPS,
      unknownIntersection: BindingTypes.PROPS,
      unknownUnionWithBoolean: BindingTypes.PROPS,
      unknownUnionWithFunction: BindingTypes.PROPS,
    })
  })

  it('w/ interface', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface Props { x?: number }
    defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`x: { type: Number, required: false }`)
    expect(bindings).toMatchObject({
      x: BindingTypes.PROPS,
    })
  })

  it('w/ extends interface', () => {
    const { content, bindings } = compile(`
    <script lang="ts">
      interface Foo { x?: number }
    </script>
    <script setup lang="ts">
      interface Bar extends Foo { y?: number }
      interface Props extends Bar {
        z: number
        y: string
      }
      defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`z: { type: Number, required: true }`)
    expect(content).toMatch(`y: { type: String, required: true }`)
    expect(content).toMatch(`x: { type: Number, required: false }`)
    expect(bindings).toMatchObject({
      x: BindingTypes.PROPS,
      y: BindingTypes.PROPS,
      z: BindingTypes.PROPS,
    })
  })

  it('withDefaults (static)', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    const props = withDefaults(defineProps<{
      foo?: string
      bar?: number;
      baz: boolean;
      qux?(): number;
      quux?(): void
      quuxx?: Promise<string>;
      fred?: string
    }>(), {
      foo: 'hi',
      qux() { return 1 },
      ['quux']() { },
      async quuxx() { return await Promise.resolve('hi') },
      get fred() { return 'fred' }
    })
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(
      `foo: { type: String, required: false, default: 'hi' }`,
    )
    expect(content).toMatch(`bar: { type: Number, required: false }`)
    expect(content).toMatch(`baz: { type: Boolean, required: true }`)
    expect(content).toMatch(
      `qux: { type: Function, required: false, default() { return 1 } }`,
    )
    expect(content).toMatch(
      `quux: { type: Function, required: false, default() { } }`,
    )
    expect(content).toMatch(
      `quuxx: { type: Promise, required: false, async default() { return await Promise.resolve('hi') } }`,
    )
    expect(content).toMatch(
      `fred: { type: String, required: false, get default() { return 'fred' } }`,
    )
    expect(bindings).toMatchObject({
      foo: BindingTypes.PROPS,
      bar: BindingTypes.PROPS,
      baz: BindingTypes.PROPS,
      qux: BindingTypes.PROPS,
      quux: BindingTypes.PROPS,
      quuxx: BindingTypes.PROPS,
      fred: BindingTypes.PROPS,
    })
  })

  it('w/ keyof object', () => {
    const { content, bindings } = compile(`
        <script setup lang="ts">
        import { ref,ExtractPropTypes } from 'vue'
        const testProps = {
            a:{
                type: String
            }
        }

        type TestProps = ExtractPropTypes<typeof testProps>
        defineProps<TestProps>()

        const msg = ref('Hello World!')
        </script>
        `)
    assertCode(content)
    expect(content).toMatch(`a: { type: String, required: false }`)
    expect(bindings).toMatchObject({
      a: BindingTypes.PROPS,
    })
  })

  it('omit keyof', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface BaseProps {
        a: string;
    }
    interface ExtraProps {
        a: string
        b: number
    }
    type Props = Omit<ExtraProps, keyof BaseProps>
    defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`b: { type: Number, required: true }`)
    expect(bindings).toMatchObject({
      b: BindingTypes.PROPS,
    })
  })

  it('w/ Omit and keyof', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface BaseProps {
        a: string
    }
    interface ExtraProps {
        a: string
        b: number
    }
    type Props = Omit<ExtraProps, keyof BaseProps>
    defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`b: { type: Number, required: true }`)
    expect(bindings).toMatchObject({
      b: BindingTypes.PROPS,
    })
  })

  it('w/ import by vue', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    import { InputHTMLAttributes } from "vue"
    interface Props extends InputHTMLAttributes {
      cc: string
    }
    defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`cc: { type: String, required: true }`)
    expect(content).toMatch(
      `disabled: { type: [Boolean, String], required: false, skipCheck: true }`,
    )
    expect(bindings).toMatchObject({
      cc: BindingTypes.PROPS,
      disabled: BindingTypes.PROPS,
    })
  })

  it('w/ import by vue ignore', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    import { InputHTMLAttributes } from "vue"
    interface Props extends 
    /* @vue-ignore */
    InputHTMLAttributes {
      cc: string
    }
    defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`cc: { type: String, required: true }`)
    expect(bindings).toMatchObject({
      cc: BindingTypes.PROPS,
    })
  })
})
