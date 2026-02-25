export { createTypeResolveContext } from './oxcResolveTypesContext'
export {
  DEFINE_EMITS,
  extractRuntimeEmits,
  genRuntimeEmits,
} from './oxcResolveTypesDefineEmits'
export {
  DEFINE_PROPS,
  extractRuntimeProps,
  genRuntimeProps,
  WITH_DEFAULTS,
} from './oxcResolveTypesDefineProps'
export {
  inferRuntimeType,
  invalidateTypeCache,
  resolveTypeElements,
  resolveUnionType,
  UNKNOWN_TYPE,
} from './oxcResolveTypesResolveType'
export { registerTS } from './oxcResolveTypesTs'
export type * from './oxcResolveTypesTypes'
