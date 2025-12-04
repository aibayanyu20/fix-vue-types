import { describe, it, expect } from "vitest"
import { compile, assertCode } from './utils'

describe("mts support", () => {
    it("should resolve types from .mts file", () => {
        const importedCode = `
        export interface MtsProps {
            foo: string
        }
        `
        const code = `
        <script setup lang="ts">
        import { MtsProps } from './imported.mts'
        defineProps<MtsProps>()
        </script>
        `
        
        const { content } = compile(code, {
            fs: {
                fileExists: (file: string) => file === './imported.mts' || file.endsWith('imported.mts'),
                readFile: (file: string) => {
                    if (file.endsWith('imported.mts')) return importedCode
                    return ''
                },
                realpath: (file: string) => file
            }
        })
        assertCode(content)
        expect(content).toMatch(`foo: { type: String, required: true }`)
    })

    it("should resolve types from .cts file", () => {
        const importedCode = `
        export interface CtsProps {
            bar: number
        }
        `
        const code = `
        <script setup lang="ts">
        import { CtsProps } from './imported.cts'
        defineProps<CtsProps>()
        </script>
        `
        
        const { content } = compile(code, {
            fs: {
                fileExists: (file: string) => file === './imported.cts' || file.endsWith('imported.cts'),
                readFile: (file: string) => {
                    if (file.endsWith('imported.cts')) return importedCode
                    return ''
                },
                realpath: (file: string) => file
            }
        })
        assertCode(content)
        expect(content).toMatch(`bar: { type: Number, required: true }`)
    })

    it("should resolve types from .d.mts file", () => {
        const importedCode = `
        export interface DMtsProps {
            baz: boolean
        }
        `
        const code = `
        <script setup lang="ts">
        import { DMtsProps } from './imported'
        defineProps<DMtsProps>()
        </script>
        `
        
        const { content } = compile(code, {
            fs: {
                fileExists: (file: string) => file === './imported.d.mts' || file.endsWith('imported.d.mts'),
                readFile: (file: string) => {
                    if (file.endsWith('imported.d.mts')) return importedCode
                    return ''
                },
                realpath: (file: string) => file
            }
        })
        assertCode(content)
        expect(content).toMatch(`baz: { type: Boolean, required: true }`)
    })

    it("should resolve types from .d.cts file", () => {
        const importedCode = `
        export interface DCtsProps {
            qux: string[]
        }
        `
        const code = `
        <script setup lang="ts">
        import { DCtsProps } from './imported'
        defineProps<DCtsProps>()
        </script>
        `
        
        const { content } = compile(code, {
            fs: {
                fileExists: (file: string) => file === './imported.d.cts' || file.endsWith('imported.d.cts'),
                readFile: (file: string) => {
                    if (file.endsWith('imported.d.cts')) return importedCode
                    return ''
                },
                realpath: (file: string) => file
            }
        })
        assertCode(content)
        expect(content).toMatch(`qux: { type: Array, required: true }`)
    })
})

