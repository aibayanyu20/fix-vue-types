export type TsModule = any

export interface SFCScriptCompileOptions {
  /**
   * Scope ID for prefixing injected CSS variables.
   * This must be consistent with the `id` passed to `compileStyle`.
   */
  id: string
  /**
   * Production mode. Used to determine whether to generate hashed CSS variables
   */
  isProd?: boolean
  /**
   * Enable/disable source map. Defaults to true.
   */
  sourceMap?: boolean
  /**
   * A list of files to parse for global types to be made available for type
   * resolving in SFC macros. The list must be fully resolved file system paths.
   */
  globalTypeFiles?: string[]
  /**
   * Compile the template and inline the resulting render function
   * directly inside setup().
   * - Only affects `<script setup>`
   * - This should only be used in production because it prevents the template
   * from being hot-reloaded separately from component state.
   */
  inlineTemplate?: boolean
  /**
   * Generate the final component as a variable instead of default export.
   * This is useful in e.g. @vitejs/plugin-vue where the script needs to be
   * placed inside the main module.
   */
  genDefaultAs?: string
  /**
   * Options for template compilation when inlining. Note these are options that
   * would normally be passed to `compiler-sfc`'s own `compileTemplate()`, not
   * options passed to `compiler-dom`.
   */
  templateOptions?: Partial<any>
  /**
   * Hoist <script setup> static constants.
   * - Only enables when one `<script setup>` exists.
   * @default true
   */
  hoistStatic?: boolean
  /**
   * Set to `false` to disable reactive destructure for `defineProps` (pre-3.5
   * behavior), or set to `'error'` to throw hard error on props destructures.
   * @default true
   */
  propsDestructure?: boolean | 'error'
  /**
   * File system access methods to be used when resolving types
   * imported in SFC macros. Defaults to ts.sys in Node.js, can be overwritten
   * to use a virtual file system for use in browsers (e.g. in REPLs)
   */
  fs?: {
    fileExists: (file: string) => boolean
    readFile: (file: string) => string | undefined
    realpath?: (file: string) => string
  }
  /**
   * Transform Vue SFCs into custom elements.
   */
  customElement?: boolean | ((filename: string) => boolean)
  /**
   * Type names that must not be resolved into runtime props. A matching
   * reference contributes no members in an `extends`/intersection position
   * and infers to `null` as a prop type, exactly like `/* @vue-ignore *\/`.
   * Unlike the comment it survives declaration emit, so it works on types
   * consumed from a published `.d.ts`. Matched against the local reference
   * name (the last segment of a qualified name). The `VueIgnore<T>` wrapper
   * is always recognised, independent of this option.
   *
   * @example ignoreTypes: [/EmitsProps$/]
   */
  ignoreTypes?: IgnoreTypesOption
}

export type IgnoreTypesOption
  = | (string | RegExp)[]
    | ((name: string, context: { filename: string }) => boolean)

export interface ImportBinding {
  isType: boolean
  imported: string
  local: string
  source: string
  isFromSetup: boolean
  isUsedInTemplate: boolean
}
