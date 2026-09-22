// Mimics a published d.ts whose tsconfig `paths` were rewritten into a
// monorepo source path that does not exist in the tarball.
import { ValueType } from '../../pkg/src'
export interface Props {
  min?: ValueType
}
