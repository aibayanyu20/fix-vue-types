import { parse } from '@babel/parser'

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
  parse(code, {
    plugins: ['typescript'],
    sourceType: 'module'
  })
  console.log("Parse successful")
} catch (e) {
  console.error("Parse failed:", e.message)
}
