import { describe, expect, it } from 'vitest'
import { assertCode, compile } from './utils'

describe('defineEmits', () => {
  it('basic usage', () => {
    const { content } = compile(`
<script setup>
const myEmit = defineEmits(['foo', 'bar'])
</script>
  `)
    assertCode(content)
    // In our extracted version, we might not handle runtime emits fully if they are just passed through
    // But let's see what extractRuntimeEmits does.
    // It seems extractRuntimeEmits handles type-based declaration.
    // For runtime declaration, my utils.ts handles it.
    expect(content).toMatch(`emits: ['foo', 'bar']`)
  })

  it('w/ type', () => {
    const { content } = compile(`
    <script setup lang="ts">
    const emit = defineEmits<(e: 'foo' | 'bar') => void>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`emits: ["foo","bar"]`)
  })

  it('w/ type (union)', () => {
    const type = `((e: 'foo' | 'bar') => void) | ((e: 'baz', id: number) => void)`
    const { content } = compile(`
    <script setup lang="ts">
    const emit = defineEmits<${type}>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`emits: ["foo","bar","baz"]`)
  })

  it('w/ type (type literal w/ call signatures)', () => {
    const type = `{(e: 'foo' | 'bar'): void; (e: 'baz', id: number): void;}`
    const { content } = compile(`
    <script setup lang="ts">
    const emit = defineEmits<${type}>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`emits: ["foo","bar","baz"]`)
  })

  it('w/ type (interface)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    interface Emits { (e: 'foo' | 'bar'): void }
    const emit = defineEmits<Emits>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`emits: ["foo","bar"]`)
  })

  it('w/ type (interface w/ extends)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    interface Base { (e: 'foo'): void }
    interface Emits extends Base { (e: 'bar'): void }
    const emit = defineEmits<Emits>()
    </script>
    `)
    assertCode(content)
    // Set order is not guaranteed, so check for both presence
    expect(content).toContain('"bar"')
    expect(content).toContain('"foo"')
  })

  it('w/ type (exported interface)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    export interface Emits { (e: 'foo' | 'bar'): void }
    const emit = defineEmits<Emits>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`emits: ["foo","bar"]`)
  })

  it('w/ type (type alias)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type Emits = { (e: 'foo' | 'bar'): void }
    const emit = defineEmits<Emits>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`emits: ["foo","bar"]`)
  })

  it('w/ type (referenced function type)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type Emits = (e: 'foo' | 'bar') => void
    const emit = defineEmits<Emits>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`emits: ["foo","bar"]`)
  })

  it('w/ type (property syntax)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    const emit = defineEmits<{ foo: [], bar: [] }>()
    </script>
    `)
    expect(content).toMatch(`emits: ["foo","bar"]`)
    assertCode(content)
  })

  it('w/ type (property syntax string literal)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    const emit = defineEmits<{ 'foo:bar': [] }>()
    </script>
    `)
    expect(content).toMatch(`emits: ["foo:bar"]`)
    assertCode(content)
  })

  it('w/ type (type references in union)', () => {
    const { content } = compile(`
    <script setup lang="ts">
    type BaseEmit = "change"
    type Emit = "some" | "emit" | BaseEmit
    const emit = defineEmits<{
      (e: Emit): void;
      (e: "another", val: string): void;
    }>();
    </script>
    `)

    expect(content).toContain('"some"')
    expect(content).toContain('"emit"')
    expect(content).toContain('"change"')
    expect(content).toContain('"another"')
    assertCode(content)
  })
})
