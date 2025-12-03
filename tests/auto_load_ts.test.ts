
import { describe, expect, it, afterEach } from 'vitest'
import { compile } from './utils'
import { registerTS } from '../src/resolveType'
import ts from 'typescript'

describe('auto load ts', () => {
  afterEach(() => {
    // Restore TS after test
    registerTS(() => ts)
  })

  it('should fail if TS is not registered (reproduction)', () => {
    // Unregister TS
    registerTS(undefined as any)

    try {
      compile(`
      <script setup lang="ts">
      import { InputHTMLAttributes } from "vue"
      interface Props extends InputHTMLAttributes {
        cc: string
      }
      defineProps<Props>()
      </script>
      `)
    } catch (e: any) {
      expect(e.message).toContain('TypeScript is required as a peer dep')
      return
    }
    throw new Error('Should have failed')
  })
})
