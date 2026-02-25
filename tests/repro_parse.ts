import { parseSync } from 'oxc-parser'

const code = `
declare module "foo" {
    interface PanelProps {
        foo: string
    }

    type ContentProps = {
       motionName?: string
       ariaId: string
       onVisibleChanged: (visible: boolean) => void
    } & PanelProps
}
`

try {
  const result = parseSync('repro.ts', code, {
    lang: 'ts',
    sourceType: 'module',
  })
  if (result.errors.length)
    throw new Error(result.errors[0]!.message)
  console.log("Parse successful")
} catch (e: any) {
  console.error("Parse failed:", e.message)
}
