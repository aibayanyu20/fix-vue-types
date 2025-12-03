export { ScriptCompileContext } from './context'

export { extractRuntimeEmits } from './defineEmits'
export { extractRuntimeProps } from './defineProps'
export {
  inferRuntimeType,
  invalidateTypeCache,
  registerTS,
  resolveTypeElements,
  type TypeResolveContext,
} from './resolveType'
export * from './types'
