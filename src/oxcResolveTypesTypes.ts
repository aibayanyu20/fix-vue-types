import type { TsModule } from './types'

export interface AnyNode {
  type: string
  start?: number
  end?: number
  [key: string]: any
}

export interface ResolveTypeFS {
  fileExists: (file: string) => boolean
  readFile: (file: string) => string | undefined
  realpath?: (file: string) => string
}

export interface ResolveTypeImportBinding {
  local: string
  imported: string
  source: string
  isType: boolean
}

export interface ResolveTypeExportBinding {
  kind: 'local' | 'reexport'
  local?: string
  source?: string
  imported?: string
}

export interface TypeScope {
  filename: string
  source: string
  program: AnyNode
  declarations: Map<string, AnyNode>
  imports: Map<string, ResolveTypeImportBinding>
  exports: Map<string, ResolveTypeExportBinding>
  exportAllSources: string[]
}

export interface ResolveTypeContextOptions {
  filename: string
  source: string
  fs?: ResolveTypeFS
  ts?: TsModule
}

export interface TypeResolveContext {
  filename: string
  source: string
  program: AnyNode
  fs: ResolveTypeFS
  scopeCache: Map<string, TypeScope>
  options: ResolveTypeContextOptions
  getString: (node: AnyNode, fileName?: string) => string
  error: (message: string, node?: AnyNode, fileName?: string) => never
}

export interface TypeElementProperty {
  key: string
  typeNode: AnyNode
  optional: boolean
  node: AnyNode
  scope?: TypeScope
  genericBindings?: Map<string, AnyNode>
}

export interface TypeElementCall {
  node: AnyNode
  parameters: AnyNode[]
}

export interface TypeElements {
  props: Record<string, TypeElementProperty>
  calls: TypeElementCall[]
}

export interface PropTypeData {
  key: string
  type: string[]
  required: boolean
  skipCheck: boolean
  defaultValue?: string
}
