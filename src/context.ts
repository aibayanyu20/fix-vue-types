import type { BindingMetadata } from '@vue/compiler-core'
import type { SFCDescriptor } from 'vue/compiler-sfc'
import type { CallExpression, Node, ObjectPattern, Program } from './ast'
import type { PropsDestructureBindings } from './defineProps'
import type { TypeScope } from './resolveType'
import type { ImportBinding, SFCScriptCompileOptions } from './types'
import { generateCodeFrame } from '@vue/shared'
import MagicString from 'magic-string'
import { parseOxcProgram } from './oxcCompat'
import { isJS, isTS } from './utils'

export type ModelDecl = any // Mocked since defineModel is not extracted

export class ScriptCompileContext {
  isJS: boolean
  isTS: boolean
  isCE = false

  scriptAst: Program | null
  scriptSetupAst: Program | null

  source: string
  filename: string
  s: MagicString
  startOffset: number | undefined
  endOffset: number | undefined

  // import / type analysis
  scope?: TypeScope
  globalScopes?: TypeScope[]
  userImports: Record<string, ImportBinding> = Object.create(null)

  // macros presence check
  hasDefinePropsCall = false
  hasDefineEmitCall = false
  hasDefineExposeCall = false
  hasDefaultExportName = false
  hasDefaultExportRender = false
  hasDefineOptionsCall = false
  hasDefineSlotsCall = false
  hasDefineModelCall = false

  // defineProps
  propsCall: CallExpression | undefined
  propsDecl: Node | undefined
  propsRuntimeDecl: Node | undefined
  propsTypeDecl: Node | undefined
  propsDestructureDecl: ObjectPattern | undefined
  propsDestructuredBindings: PropsDestructureBindings = Object.create(null)
  propsDestructureRestId: string | undefined
  propsRuntimeDefaults: Node | undefined

  // defineEmits
  emitsRuntimeDecl: Node | undefined
  emitsTypeDecl: Node | undefined
  emitDecl: Node | undefined
  emitsCall: CallExpression | undefined

  // defineModel
  modelDecls: Record<string, ModelDecl> = Object.create(null)

  // defineOptions
  optionsRuntimeDecl: Node | undefined

  // codegen
  bindingMetadata: BindingMetadata = {}
  helperImports: Set<string> = new Set()
  helper(key: string): string {
    this.helperImports.add(key)
    return `_${key}`
  }

  /**
   * to be exposed on compiled script block for HMR cache busting
   */
  deps?: Set<string>

  /**
   * cache for resolved fs
   */
  fs?: NonNullable<SFCScriptCompileOptions['fs']>

  descriptor: SFCDescriptor
  options: Partial<SFCScriptCompileOptions>

  constructor(
    descriptor: SFCDescriptor,
    options: Partial<SFCScriptCompileOptions>,
  ) {
    this.descriptor = descriptor
    this.options = options
    this.source = descriptor.source
    this.filename = descriptor.filename
    this.s = new MagicString(this.source)
    this.startOffset = descriptor.scriptSetup?.loc.start.offset
    this.endOffset = descriptor.scriptSetup?.loc.end.offset

    const { script, scriptSetup } = descriptor
    const scriptLang = script && script.lang
    const scriptSetupLang = scriptSetup && scriptSetup.lang

    this.isJS = isJS(scriptLang, scriptSetupLang)
    this.isTS = isTS(scriptLang, scriptSetupLang)

    const customElement = options.customElement
    const filename = this.descriptor.filename
    if (customElement) {
      this.isCE
        = typeof customElement === 'boolean'
          ? customElement
          : customElement(filename)
    }
    function parse(input: string, offset: number): Program {
      try {
        return parseOxcProgram(
          descriptor.filename,
          input,
          (scriptLang || scriptSetupLang)!,
        )
      }
      catch (e: any) {
        e.message = `[vue/compiler-sfc] ${e.message}\n\n${descriptor.filename
        }\n${generateCodeFrame(
          descriptor.source,
          e.pos + offset,
          e.pos + offset + 1,
        )}`
        throw e
      }
    }

    this.scriptAst
      = descriptor.script
        && parse(descriptor.script.content, descriptor.script.loc.start.offset)

    this.scriptSetupAst
      = descriptor.scriptSetup
        && parse(descriptor.scriptSetup!.content, this.startOffset!)
  }

  getString(node: Node, scriptSetup = true): string {
    const block = scriptSetup
      ? this.descriptor.scriptSetup!
      : this.descriptor.script!
    return block.content.slice(node.start!, node.end!)
  }

  warn(msg: string, node: Node, scope?: TypeScope): void {
    console.warn(generateError(msg, node, this, scope))
  }

  error(msg: string, node: Node, scope?: TypeScope): never {
    throw new Error(
      `[@vue/compiler-sfc] ${generateError(msg, node, this, scope)}`,
    )
  }
}

function generateError(
  msg: string,
  node: Node,
  ctx: ScriptCompileContext,
  scope?: TypeScope,
) {
  const offset = scope ? scope.offset : ctx.startOffset!
  return `${msg}\n\n${(scope || ctx.descriptor).filename}\n${generateCodeFrame(
    (scope || ctx.descriptor).source,
    node.start! + offset,
    node.end! + offset,
  )}`
}
