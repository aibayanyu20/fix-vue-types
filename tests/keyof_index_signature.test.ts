import { describe, expect, it } from 'vitest'
import { assertCode, compile } from './utils'

// TypeScript widens `keyof` of a string index signature to `string | number`
// (numeric keys are valid string keys), so the runtime check must accept both.
describe('keyof string index signature', () => {
  it('keyof Record<string, T>', () => {
    const { content } = compile(`
    <script setup lang="ts">
    defineProps<{ k?: keyof Record<string, any> }>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`k: { type: [String, Number], required: false }`)
  })

  it('keyof { [key: string]: T }', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type Dict = { [key: string]: number }
    interface Map { [key: string]: number }
    defineProps<{ a?: keyof Dict, b?: keyof Map }>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`a: { type: [String, Number], required: false }`)
    expect(content).toMatch(`b: { type: [String, Number], required: false }`)
  })

  it('keyof of a generic defaulting to Record<string, any> (Table rowKey)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type AnyObject = Record<string, any>
    interface TableProps<RecordType = AnyObject> {
      rowKey?: string | keyof RecordType | ((record: RecordType) => string)
    }
    defineProps<TableProps>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`rowKey: { type: [String, Number, Function], required: false }`)
  })

  it('keeps number and literal keys unchanged', () => {
    const { content } = compile(`
    <script setup lang="ts">
    interface Named { a: string, b: number }
    defineProps<{
      num?: keyof Record<number, any>
      numSig?: keyof { [key: number]: any }
      named?: keyof Named
      literal?: keyof Record<'x' | 'y', any>
    }>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`num: { type: Number, required: false }`)
    expect(content).toMatch(`numSig: { type: Number, required: false }`)
    expect(content).toMatch(`named: { type: String, required: false }`)
    expect(content).toMatch(`literal: { type: String, required: false }`)
  })

  it('mixed index signatures keep every key kind', () => {
    const { content } = compile(`
    <script setup lang="ts">
    interface Foo {
      [key: symbol]: 1
      [key: string]: 1
      [key: number]: 1
    }
    defineProps<{ foo?: keyof Foo }>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`foo: { type: [Symbol, String, Number], required: false }`)
  })
})
