export interface BaseColumnType<RecordType = any> {
  title?: string
  colSpan?: number
  width?: string | number
  rowScope?: string
  render?: (record: RecordType) => unknown
}
