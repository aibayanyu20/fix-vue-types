
import { describe, expect, it } from 'vitest'
import { compile, assertCode } from './utils'
import { BindingTypes } from '@vue/compiler-core'

describe('Deep Record and Utility Types', () => {
  it('Record with Pick and Template Literal Keys', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface User {
      id: number
      name: string
      email: string
    }
    
    type UserKeys = keyof User
    type IdKey = Pick<User, 'id'>
    
    defineProps<Record<\`get\${Capitalize<UserKeys>}\`, () => void>>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`getId: { type: Function, required: false }`)
    expect(content).toMatch(`getName: { type: Function, required: false }`)
    expect(content).toMatch(`getEmail: { type: Function, required: false }`)
    expect(bindings).toMatchObject({
      getId: BindingTypes.PROPS,
      getName: BindingTypes.PROPS,
      getEmail: BindingTypes.PROPS,
    })
  })

  it('Record with Omit and Uppercase', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    interface Config {
      host: string
      port: number
      debug: boolean
    }
    
    // Record<Uppercase<keyof Omit<Config, 'debug'>>, string>
    defineProps<Record<Uppercase<keyof Omit<Config, 'debug'>>, string>>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`HOST: { type: String, required: false }`)
    expect(content).toMatch(`PORT: { type: String, required: false }`)
    expect(content).not.toMatch(`DEBUG`)
    expect(bindings).toMatchObject({
      HOST: BindingTypes.PROPS,
      PORT: BindingTypes.PROPS,
    })
  })

  it('Parameters<T>', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    type Func = (a: string, b: number) => void
    
    // Parameters returns tuple [string, number]
    // This test checks if we can resolve it, though defining props from tuple is unusual directly,
    // usually it's used in other contexts. But let's see if we can use it in Record key? No, key must be string.
    // Let's test Parameters in a way that affects props, e.g. extracting type from it.
    
    // Actually, let's test if we can use Parameters to get a type for a prop.
    interface Props {
      args: Parameters<Func>
    }
    defineProps<Props>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`args: { type: Array, required: true }`)
    expect(bindings).toMatchObject({
      args: BindingTypes.PROPS,
    })
  })

  it('ReturnType<T>', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    type Func = () => { foo: string }
    
    defineProps<ReturnType<Func>>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`foo: { type: String, required: true }`)
    expect(bindings).toMatchObject({
      foo: BindingTypes.PROPS,
    })
  })
  
  it('InstanceType<T>', () => {
      const { content, bindings } = compile(`
      <script setup lang="ts">
      class MyClass {
        prop: string
      }
      
      defineProps<InstanceType<typeof MyClass>>()
      </script>
      `)
      assertCode(content)
      expect(content).toMatch(`prop: { type: String, required: true }`)
      expect(bindings).toMatchObject({
        prop: BindingTypes.PROPS,
      })
    })

  it('Awaited<T>', () => {
    const { content, bindings } = compile(`
    <script setup lang="ts">
    type P = Promise<{ data: string }>
    
    defineProps<Awaited<P>>()
    </script>
    `)
    assertCode(content)
    expect(content).toMatch(`data: { type: String, required: true }`)
    expect(bindings).toMatchObject({
      data: BindingTypes.PROPS,
    })
  })
})
