import { describe, it, expect } from "vitest"
import { compile, assertCode } from './utils'

describe("bugfix",()=>{

    it("type",()=>{
        const code = `
        <script setup lang="ts">
        interface PanelProps {
            foo: string
        }
        
        type ContentProps = {
           motionName?: string
           ariaId: string
           onVisibleChanged: (visible: boolean) => void
        } & PanelProps

        defineProps<ContentProps>()
        </script>
        `
        const { content } = compile(code)
        assertCode(content)
        expect(content).toMatch(`onVisibleChanged: { type: Function, required: true }`)
    })

    it("should not fail when importing .tsx file with values", () => {
        const importedCode = `
        export const foo = {
            bar: () => {}
        }
        `
        const code = `
        <script setup lang="ts">
        import { foo } from './imported.tsx'
        defineProps<typeof foo>()
        </script>
        `
        
        const { content } = compile(code, {
            fs: {
                fileExists: (file: string) => file === './imported.tsx' || file.endsWith('imported.tsx'),
                readFile: (file: string) => {
                    if (file.endsWith('imported.tsx')) return importedCode
                    return ''
                },
                realpath: (file: string) => file
            }
        })
        assertCode(content)
    })
})