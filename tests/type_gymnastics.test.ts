
import { describe, expect, it } from 'vitest'
import { compile } from './utils'

describe('type gymnastics', () => {
  it('should resolve mapped types with key remapping', () => {
    const { content } = compile(`
      <script setup lang="ts">
      type User = {
        name: string;
        age: number;
        id: number;
      }
      
      type Getters<T> = {
        [K in keyof T as \`get\${Capitalize<string & K>}\`]: () => T[K]
      }
      
      defineProps<Getters<User>>()
      </script>
    `)
    expect(content).toMatch(`getName: { type: Function, required: true }`)
    expect(content).toMatch(`getAge: { type: Function, required: true }`)
    expect(content).toMatch(`getId: { type: Function, required: true }`)
  })

  it('should resolve mapped types with modifiers', () => {
    const { content } = compile(`
      <script setup lang="ts">
      type User = {
        readonly id: number;
        name?: string;
        age: number;
      }
      
      type MutableRequired<T> = {
        -readonly [K in keyof T]-?: T[K]
      }
      
      defineProps<MutableRequired<User>>()
      </script>
    `)
    // All should be required and present
    expect(content).toMatch(`id: { type: Number, required: true }`)
    expect(content).toMatch(`name: { type: String, required: true }`)
    expect(content).toMatch(`age: { type: Number, required: true }`)
  })

  it('should resolve conditional types (Extract)', () => {
    const { content } = compile(`
      <script setup lang="ts">
      type Shape = 
        | { kind: 'circle', radius: number }
        | { kind: 'square', side: number }
        | { kind: 'triangle', side: number }
      
      type ExtractSquare<T> = T extends { kind: 'square' } ? T : never
      
      defineProps<ExtractSquare<Shape>>()
      </script>
    `)
    expect(content).toMatch(`kind: { type: String, required: true }`)
    expect(content).toMatch(`side: { type: Number, required: true }`)
    expect(content).not.toMatch(`radius`)
  })

  it('should resolve conditional types (Exclude)', () => {
    const { content } = compile(`
      <script setup lang="ts">
      type Keys = 'a' | 'b' | 'c'
      type ExcludeC<T> = T extends 'c' ? never : T
      
      defineProps<Record<ExcludeC<Keys>, boolean>>()
      </script>
    `)
    expect(content).toMatch(`a: { type: Boolean, required: true }`)
    expect(content).toMatch(`b: { type: Boolean, required: true }`)
    expect(content).not.toMatch(`c:`)
  })

  it('should resolve template literal types', () => {
    const { content } = compile(`
      <script setup lang="ts">
      type Color = 'red' | 'blue'
      type Size = 'small' | 'large'
      
      type Classes = {
        [K in \`\${Color}-\${Size}\`]: boolean
      }
      
      defineProps<Classes>()
      </script>
    `)
    expect(content).toMatch(`"red-small": { type: Boolean, required: true }`)
    expect(content).toMatch(`"red-large": { type: Boolean, required: true }`)
    expect(content).toMatch(`"blue-small": { type: Boolean, required: true }`)
    expect(content).toMatch(`"blue-large": { type: Boolean, required: true }`)
  })

  it('should resolve deep partial', () => {
    const { content } = compile(`
      <script setup lang="ts">
      type DeepPartial<T> = {
        [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
      };
      
      type User = {
        info: {
          name: string;
          address: {
            city: string;
          }
        }
      }
      
      defineProps<DeepPartial<User>>()
      </script>
    `)
    expect(content).toMatch(`info: { type: Object, required: false }`)
  })
  
  it('should resolve tuple first/last', () => {
     const { content } = compile(`
      <script setup lang="ts">
      type Arr = [string, number, boolean]
      type First<T extends any[]> = T[0]
      type Last<T extends any[]> = T extends [...infer _, infer L] ? L : never
      
      defineProps<{
        first: First<Arr>
        last: Last<Arr>
      }>()
      </script>
    `)
    expect(content).toMatch(`first: { type: String, required: true }`)
    // Last is hard to support with current AST-based resolution (requires infer in tuple spread)
    // So we expect it to fallback to unknown (no type check)
    expect(content).toMatch(`last: { required: true }`)
  })
})
