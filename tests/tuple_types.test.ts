import { describe, it, expect } from 'vitest'
import { compile } from './utils'

describe('tuple types', () => {
  it('should resolve tuple types correctly', () => {
    const { content } = compile(`
        <script setup lang="ts">
        import { defineProps } from 'vue'

        const arr = ['1', '2', '3'] as const

        // 1. Array -> Union
        type TupleToUnion<T extends readonly any[]> = T[number]
        type Keys = TupleToUnion<typeof arr>

        // 2. Array -> Object (key/value are literals)
        type TupleToObject<T extends readonly string[]> = {
          [K in T[number]]: K
        }
        type Obj = TupleToObject<typeof arr>

        // 3. Array -> Record (custom value type)
        type TupleToRecord<T extends readonly string[], V> = {
          [K in T[number]]: V
        }
        type Obj2 = TupleToRecord<typeof arr, boolean>

        export const PresetStatusColorTypes = [
          'success',
          'processing',
          'error',
          'default',
          'warning',
        ] as const
        export type PresetStatusColorType = (typeof PresetStatusColorTypes)[number]

        export interface Props {
          union: Keys
          obj: Obj
          record: Obj2
          color: PresetStatusColorType
        }

        defineProps<Props>()
        </script>
    `)

    expect(content).toMatch(`union: { type: String, required: true }`)
    expect(content).toMatch(`obj: { type: Object, required: true }`)
    expect(content).toMatch(`record: { type: Object, required: true }`)
    expect(content).toMatch(`color: { type: String, required: true }`)
  })
  it('should resolve type', () => {
    const { content} = compile(`
    <script setup lang="ts">
        export const PresetStatusColorTypes = [
          'success',
          'processing',
          'error',
          'default',
          'warning',
        ] as const
        export type PresetStatusColorType = (typeof PresetStatusColorTypes)[number]
        defineProps<Record<PresetStatusColorType,boolean>>()
    </script>
    `)
    expect(content).toMatch(`success: { type: Boolean, required: true }`)
  });

  it('should resolve nested tuple types', () => {
    const { content} = compile(`
    <script setup lang="ts">
        const arr = ['1', '2', '3'] as const

        // 1. Array -> Union
        type TupleToUnion<T extends readonly any[]> = T[number]
        type Keys = TupleToUnion<typeof arr>
        defineProps<Record<Keys,boolean>>()
    </script>
   `)
    expect(content).toMatch(`1: { type: Boolean, required: true }`)
    expect(content).toMatch(`2: { type: Boolean, required: true }`)
    expect(content).toMatch(`3: { type: Boolean, required: true }`)
  })

  it('should resolve complex', () => {
    const { content} = compile(`
    <script setup lang="ts">
        const arr = ['1', '2', '3'] as const

        // 1. Array -> Union
        type TupleToObject<T extends readonly string[]> = {
          [K in T[number]]: K
        }
        type Obj = TupleToObject<typeof arr>
        defineProps<Obj>()
    </script>
   `)

    expect(content).toMatch(`1: { type: String, required: true }`)
    expect(content).toMatch(`2: { type: String, required: true }`)
    expect(content).toMatch(`3: { type: String, required: true }`)
  });
  it('should resolve complex2', () => {
    const { content} = compile(`
    <script setup lang="ts">
        const arr = ['1', '2', '3'] as const

        // 1. Array -> Union
        type TupleToRecord<T extends readonly string[], V> = {
          [K in T[number]]: V
        }
        type Obj2 = TupleToRecord<typeof arr, boolean>
        defineProps<Obj2>()
    </script>
   `)

    expect(content).toMatch(`1: { type: Boolean, required: true }`)
    expect(content).toMatch(`2: { type: Boolean, required: true }`)
    expect(content).toMatch(`3: { type: Boolean, required: true }`)
  });
})
