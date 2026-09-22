import { ValueType } from './interface'
export type { ValueType }
export interface InputNumberProps<T extends ValueType = ValueType> {
  min?: T
  max?: T
  step?: ValueType
  class?: string
}
