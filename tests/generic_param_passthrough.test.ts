import { describe, expect, it } from 'vitest'
import { assertCode, compile } from './utils'

// A generic that forwards its own type parameters to another generic used to
// hang the resolver when the names matched (`MultiValueType<ValueType,
// IsMultiple>` inside a type that also declares `ValueType`/`IsMultiple`):
// the forwarded argument was looked up in the callee's parameter map and
// resolved to itself forever. antdv-next's DatePickerProps has this shape.
describe('generic parameters forwarded to another generic', () => {
  it('same parameter names (DatePickerProps shape)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type MultiValueType<ValueType, IsMultiple extends boolean = false> = IsMultiple extends true ? ValueType[] : ValueType
    type WithMultiple<ValueType = string, IsMultiple extends boolean = false> = {
      multiple?: IsMultiple
      value?: MultiValueType<ValueType, IsMultiple> | null
    }
    defineProps<WithMultiple>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`value: { type: [String, null], required: false }`)
  })

  it('same names, explicit arguments at the use site', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type MultiValueType<ValueType, IsMultiple extends boolean = false> = IsMultiple extends true ? ValueType[] : ValueType
    type WithMultiple<ValueType = string, IsMultiple extends boolean = false> = {
      value?: MultiValueType<ValueType, IsMultiple>
    }
    defineProps<WithMultiple<number, true>>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`value: { type: Array, required: false }`)
  })

  it('different parameter names', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type MultiValueType<V, M extends boolean = false> = M extends true ? V[] : V
    type WithMultiple<ValueType = string, IsMultiple extends boolean = false> = {
      value?: MultiValueType<ValueType, IsMultiple> | null
    }
    defineProps<WithMultiple>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`value: { type: [String, null], required: false }`)
  })

  it('parameters forwarded crosswise (A -> B, B -> A)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type Pick1<A, B> = A extends true ? string : number
    type Outer<B = true, A = false> = { v?: Pick1<B, A> }
    defineProps<Outer>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`v: { type: String, required: false }`)
  })

  it('a type parameter bound to its own name does not recurse', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type Id<T> = T extends string ? string : number
    type Wrap<T = string> = { v?: Id<T> }
    defineProps<Wrap>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`v: { type: String, required: false }`)
  })
})
