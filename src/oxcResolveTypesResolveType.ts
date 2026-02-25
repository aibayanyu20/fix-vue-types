import type { AnyNode, ResolveTypeExportBinding, ResolveTypeImportBinding, TypeElements, TypeResolveContext, TypeScope } from './oxcResolveTypesTypes'
import { parseSync } from 'oxc-parser'
import { getRegisteredTS } from './oxcResolveTypesTs'
import {
  getIdentifierName,
  getObjectKey,
  getQualifiedNameParts,
  inferParserLang,
  isRelativeImport,
  normalizePath,
  resolveRelativeImportCandidates,
  unique,
  unwrapTypeNode,
} from './oxcResolveTypesUtils'

interface ResolvedTypeReference {
  node: AnyNode
  scope: TypeScope
  genericBindings: GenericBindings
}

type GenericBindings = Map<string, AnyNode>

const RUNTIME_REFERENCE_TYPES: Record<string, string> = {
  String: 'String',
  Number: 'Number',
  Boolean: 'Boolean',
  Object: 'Object',
  Function: 'Function',
  Array: 'Array',
  Date: 'Date',
}

export const UNKNOWN_TYPE = 'Unknown'

export function invalidateTypeCache(): void {
  // cache is context-scoped; kept for API compatibility
}

export function resolveTypeElements(ctx: TypeResolveContext, node: AnyNode): TypeElements {
  const scope = ensureTypeScope(ctx, ctx.filename)
  return resolveTypeElementsInScope(ctx, node, scope, new Set(), new Map())
}

export function resolveUnionType(ctx: TypeResolveContext, node: AnyNode): AnyNode[] {
  const scope = ensureTypeScope(ctx, ctx.filename)
  return resolveUnionTypeInScope(ctx, node, scope, new Set(), new Map())
}

export function inferRuntimeType(
  ctx: TypeResolveContext,
  node: AnyNode,
  scope = ensureTypeScope(ctx, ctx.filename),
  genericBindings: GenericBindings = new Map(),
): string[] {
  return inferRuntimeTypeInScope(ctx, node, scope, new Set(), genericBindings)
}

function ensureTypeScope(ctx: TypeResolveContext, filename: string): TypeScope {
  const normalized = normalizePath(filename)
  const cachedInContext = ctx.scopeCache.get(normalized)
  if (cachedInContext) {
    return cachedInContext
  }

  if (normalized === ctx.filename) {
    const scope = collectTypeScope(ctx.filename, ctx.source, ctx.program)
    ctx.scopeCache.set(normalized, scope)
    return scope
  }

  const source = ctx.fs.readFile(normalized)

  if (!source) {
    ctx.error(`Cannot read type source file: ${normalized}`)
  }

  const { program, errors } = parseSync(normalized, source, {
    lang: inferParserLang(normalized),
    sourceType: 'module',
  })

  if (errors.length) {
    ctx.error(`Cannot parse type source file: ${normalized}, ${errors[0]!.message}`)
  }

  const scope = collectTypeScope(normalized, source, program as AnyNode)
  ctx.scopeCache.set(normalized, scope)
  return scope
}

function collectTypeScope(filename: string, source: string, program: AnyNode): TypeScope {
  const declarations = new Map<string, AnyNode>()
  const imports = new Map<string, ResolveTypeImportBinding>()
  const exports = new Map<string, ResolveTypeExportBinding>()
  const exportAllSources: string[] = []

  for (const statement of program.body || []) {
    if (statement.type === 'ImportDeclaration') {
      const sourceValue = typeof statement.source?.value === 'string'
        ? statement.source.value
        : ''
      for (const specifier of statement.specifiers || []) {
        const local = getIdentifierName(specifier.local)
        if (!local) {
          continue
        }

        let imported = 'default'
        if (specifier.type === 'ImportSpecifier') {
          imported = getIdentifierName(specifier.imported) ?? local
        }
        else if (specifier.type === 'ImportNamespaceSpecifier') {
          imported = '*'
        }

        imports.set(local, {
          local,
          imported,
          source: sourceValue,
          isType: statement.importKind === 'type' || specifier.importKind === 'type',
        })
      }
      continue
    }

    if (statement.type === 'TSTypeAliasDeclaration' || statement.type === 'TSInterfaceDeclaration') {
      const localName = getIdentifierName(statement.id)
      if (localName) {
        declarations.set(localName, statement)
      }
      continue
    }

    if (statement.type === 'ExportDefaultDeclaration') {
      const declaration = statement.declaration
      if (!declaration) {
        continue
      }
      if (declaration.type === 'TSTypeAliasDeclaration' || declaration.type === 'TSInterfaceDeclaration') {
        const localName = getIdentifierName(declaration.id)
        if (localName) {
          declarations.set(localName, declaration)
          exports.set('default', {
            kind: 'local',
            local: localName,
          })
        }
      }
      else if (declaration.type === 'Identifier') {
        const localName = getIdentifierName(declaration)
        if (localName) {
          exports.set('default', {
            kind: 'local',
            local: localName,
          })
        }
      }
      continue
    }

    if (statement.type === 'ExportAllDeclaration') {
      const sourceValue = typeof statement.source?.value === 'string'
        ? statement.source.value
        : undefined
      if (sourceValue) {
        exportAllSources.push(sourceValue)
      }
      continue
    }

    if (statement.type !== 'ExportNamedDeclaration') {
      continue
    }

    const declaration = statement.declaration
    if (declaration && (declaration.type === 'TSTypeAliasDeclaration' || declaration.type === 'TSInterfaceDeclaration')) {
      const localName = getIdentifierName(declaration.id)
      if (localName) {
        declarations.set(localName, declaration)
        exports.set(localName, {
          kind: 'local',
          local: localName,
        })
      }
    }

    const sourceValue = typeof statement.source?.value === 'string'
      ? statement.source.value
      : undefined

    for (const specifier of statement.specifiers || []) {
      if (specifier.type !== 'ExportSpecifier') {
        continue
      }

      const exported = getIdentifierName(specifier.exported)
      const local = getIdentifierName(specifier.local)
      if (!exported || !local) {
        continue
      }

      if (sourceValue) {
        exports.set(exported, {
          kind: 'reexport',
          source: sourceValue,
          imported: local,
        })
      }
      else {
        exports.set(exported, {
          kind: 'local',
          local,
        })
      }
    }
  }

  return {
    filename,
    source,
    program,
    declarations,
    imports,
    exports,
    exportAllSources,
  }
}

function resolveTypeElementsInScope(
  ctx: TypeResolveContext,
  node: AnyNode | undefined,
  scope: TypeScope,
  seen: Set<string>,
  genericBindings: GenericBindings,
): TypeElements {
  const current = unwrapTypeNode(node)
  if (!current) {
    return {
      props: {},
      calls: [],
    }
  }

  if (current.type === 'TSTypeAliasDeclaration') {
    const nextBindings = createDeclarationGenericBindings(
      current,
      undefined,
      genericBindings,
    )
    return resolveTypeElementsInScope(ctx, current.typeAnnotation, scope, seen, nextBindings)
  }

  if (current.type === 'TSInterfaceDeclaration') {
    const nextBindings = createDeclarationGenericBindings(
      current,
      undefined,
      genericBindings,
    )
    const base = resolveTypeLiteralMembers(current.body?.body || [], scope, nextBindings)
    for (const heritage of current.extends || []) {
      const refNode: AnyNode = {
        type: 'TSTypeReference',
        typeName: heritage.expression,
        typeArguments: heritage.typeArguments,
      }
      const resolved = resolveTypeElementsInScope(ctx, refNode, scope, seen, nextBindings)
      mergeTypeElements(base, resolved)
    }
    return base
  }

  if (current.type === 'TSTypeLiteral') {
    return resolveTypeLiteralMembers(current.members || [], scope, genericBindings)
  }

  if (current.type === 'TSIntersectionType') {
    const merged: TypeElements = { props: {}, calls: [] }
    for (const part of current.types || []) {
      const partElements = resolveTypeElementsInScope(ctx, part, scope, seen, genericBindings)
      mergeTypeElements(merged, partElements)
    }
    return merged
  }

  if (current.type === 'TSUnionType') {
    return {
      props: {},
      calls: [],
    }
  }

  if (current.type === 'TSTypeReference') {
    const utility = resolveUtilityTypeElements(ctx, current, scope, seen, genericBindings)
    if (utility) {
      return utility
    }

    const resolved = resolveTypeReference(ctx, current, scope, seen, genericBindings)
    if (!resolved) {
      return {
        props: {},
        calls: [],
      }
    }
    return resolveTypeElementsInScope(
      ctx,
      resolved.node,
      resolved.scope,
      seen,
      resolved.genericBindings,
    )
  }

  return {
    props: {},
    calls: [],
  }
}

function resolveTypeLiteralMembers(
  members: AnyNode[],
  scope: TypeScope,
  genericBindings: GenericBindings,
): TypeElements {
  const result: TypeElements = {
    props: {},
    calls: [],
  }

  for (const member of members) {
    if (member.type === 'TSPropertySignature') {
      const key = getObjectKey(member.key, member.computed)
      if (!key) {
        continue
      }
      result.props[key] = {
        key,
        optional: !!member.optional,
        typeNode: member.typeAnnotation?.typeAnnotation ?? { type: 'TSUnknownKeyword' },
        node: member,
        scope,
        genericBindings,
      }
      continue
    }

    if (member.type === 'TSMethodSignature') {
      const key = getObjectKey(member.key, member.computed)
      if (!key) {
        continue
      }
      result.props[key] = {
        key,
        optional: !!member.optional,
        typeNode: {
          type: 'TSFunctionType',
          params: member.params || [],
          returnType: member.returnType,
          typeParameters: member.typeParameters,
        },
        node: member,
        scope,
        genericBindings,
      }
      continue
    }

    if (member.type === 'TSCallSignatureDeclaration') {
      result.calls.push({
        node: member,
        parameters: member.params || [],
      })
    }
  }

  return result
}

function mergeTypeElements(target: TypeElements, source: TypeElements): void {
  for (const [key, prop] of Object.entries(source.props)) {
    const existing = target.props[key]
    if (!existing) {
      target.props[key] = prop
      continue
    }
    target.props[key] = {
      ...prop,
      optional: existing.optional && prop.optional,
    }
  }
  target.calls.push(...source.calls)
}

function resolveUtilityTypeElements(
  ctx: TypeResolveContext,
  reference: AnyNode,
  scope: TypeScope,
  seen: Set<string>,
  genericBindings: GenericBindings,
): TypeElements | undefined {
  const typeNameParts = getQualifiedNameParts(reference.typeName)
  if (typeNameParts.length !== 1) {
    return
  }

  const utilityName = typeNameParts[0]
  const typeArgs = reference.typeArguments?.params || []

  if (utilityName === 'Partial' && typeArgs[0]) {
    const resolved = resolveTypeElementsInScope(ctx, typeArgs[0], scope, seen, genericBindings)
    for (const prop of Object.values(resolved.props)) {
      prop.optional = true
    }
    return resolved
  }

  if (utilityName === 'Required' && typeArgs[0]) {
    const resolved = resolveTypeElementsInScope(ctx, typeArgs[0], scope, seen, genericBindings)
    for (const prop of Object.values(resolved.props)) {
      prop.optional = false
    }
    return resolved
  }

  if (utilityName === 'Readonly' && typeArgs[0]) {
    return resolveTypeElementsInScope(ctx, typeArgs[0], scope, seen, genericBindings)
  }

  if (utilityName === 'Pick' && typeArgs[0] && typeArgs[1]) {
    const resolved = resolveTypeElementsInScope(ctx, typeArgs[0], scope, seen, genericBindings)
    const picked = new Set(resolveStringLiteralUnion(ctx, typeArgs[1], scope, seen, genericBindings))
    const filtered: TypeElements = { props: {}, calls: resolved.calls.slice() }
    for (const [key, prop] of Object.entries(resolved.props)) {
      if (picked.has(key)) {
        filtered.props[key] = prop
      }
    }
    return filtered
  }

  if (utilityName === 'Omit' && typeArgs[0] && typeArgs[1]) {
    const resolved = resolveTypeElementsInScope(ctx, typeArgs[0], scope, seen, genericBindings)
    const omitted = new Set(resolveStringLiteralUnion(ctx, typeArgs[1], scope, seen, genericBindings))
    const filtered: TypeElements = { props: {}, calls: resolved.calls.slice() }
    for (const [key, prop] of Object.entries(resolved.props)) {
      if (!omitted.has(key)) {
        filtered.props[key] = prop
      }
    }
    return filtered
  }

  if (utilityName === 'Record' && typeArgs[0] && typeArgs[1]) {
    const keys = resolveStringLiteralUnion(ctx, typeArgs[0], scope, seen, genericBindings)
    const props: TypeElements = { props: {}, calls: [] }
    for (const key of keys) {
      props.props[key] = {
        key,
        optional: false,
        typeNode: typeArgs[1],
        node: reference,
        scope,
        genericBindings,
      }
    }
    return props
  }
}

function resolveTypeReference(
  ctx: TypeResolveContext,
  reference: AnyNode,
  scope: TypeScope,
  seen: Set<string>,
  genericBindings: GenericBindings,
): ResolvedTypeReference | undefined {
  const typeNameParts = getQualifiedNameParts(reference.typeName)
  if (!typeNameParts.length) {
    return
  }

  if (typeNameParts.length === 1 && genericBindings.has(typeNameParts[0]!)) {
    return {
      node: genericBindings.get(typeNameParts[0]!)!,
      scope,
      genericBindings,
    }
  }

  if (typeNameParts.length === 1) {
    const resolved = resolveNamedTypeReference(ctx, typeNameParts[0]!, scope, seen)
    return applyReferenceTypeArguments(
      resolved,
      reference.typeArguments?.params || [],
      genericBindings,
    )
  }

  const [base, ...rest] = typeNameParts
  const binding = scope.imports.get(base!)
  if (!binding || binding.imported !== '*') {
    return
  }

  const importedScope = resolveImportedScope(ctx, scope.filename, binding.source)
  if (!importedScope) {
    ctx.error(
      `Cannot resolve namespace import "${binding.source}" for type "${typeNameParts.join('.')}"`,
      reference,
      scope.filename,
    )
  }

  if (!rest.length) {
    return
  }

  const resolved = resolveExportedTypeReference(ctx, importedScope, rest[0]!, seen)
  return applyReferenceTypeArguments(
    resolved,
    reference.typeArguments?.params || [],
    genericBindings,
  )
}

function resolveNamedTypeReference(
  ctx: TypeResolveContext,
  name: string,
  scope: TypeScope,
  seen: Set<string>,
): ResolvedTypeReference | undefined {
  const cycleKey = `${scope.filename}::${name}`
  if (seen.has(cycleKey)) {
    return
  }
  seen.add(cycleKey)

  const local = scope.declarations.get(name)
  if (local) {
    return {
      node: local,
      scope,
      genericBindings: new Map(),
    }
  }

  const imported = scope.imports.get(name)
  if (imported) {
    const importedScope = resolveImportedScope(ctx, scope.filename, imported.source)
    if (!importedScope) {
      ctx.error(
        `Cannot resolve imported type "${name}" from "${imported.source}"`,
        undefined,
        scope.filename,
      )
    }
    if (imported.imported === '*') {
      return
    }
    return resolveExportedTypeReference(ctx, importedScope, imported.imported, seen)
  }

  const exported = scope.exports.get(name)
  if (exported?.kind === 'local' && exported.local) {
    const declared = scope.declarations.get(exported.local)
    if (declared) {
      return {
        node: declared,
        scope,
        genericBindings: new Map(),
      }
    }
  }
}

function resolveExportedTypeReference(
  ctx: TypeResolveContext,
  scope: TypeScope,
  exportName: string,
  seen: Set<string>,
): ResolvedTypeReference | undefined {
  const cycleKey = `${scope.filename}::export::${exportName}`
  if (seen.has(cycleKey)) {
    return
  }
  seen.add(cycleKey)

  const direct = scope.exports.get(exportName)
  if (direct?.kind === 'local' && direct.local) {
    const local = scope.declarations.get(direct.local)
    if (local) {
      return {
        node: local,
        scope,
        genericBindings: new Map(),
      }
    }

    const importedBinding = scope.imports.get(direct.local)
    if (importedBinding) {
      const importedScope = resolveImportedScope(
        ctx,
        scope.filename,
        importedBinding.source,
      )
      if (importedScope && importedBinding.imported !== '*') {
        return resolveExportedTypeReference(
          ctx,
          importedScope,
          importedBinding.imported,
          seen,
        )
      }
    }
  }
  else if (direct?.kind === 'reexport' && direct.source && direct.imported) {
    const importedScope = resolveImportedScope(ctx, scope.filename, direct.source)
    if (importedScope) {
      return resolveExportedTypeReference(ctx, importedScope, direct.imported, seen)
    }
  }

  // Fallback for declaration-only files where export maps are sparse
  const declaration = scope.declarations.get(exportName)
  if (declaration) {
    return {
      node: declaration,
      scope,
      genericBindings: new Map(),
    }
  }

  for (const exportAllSource of scope.exportAllSources) {
    const importedScope = resolveImportedScope(ctx, scope.filename, exportAllSource)
    if (!importedScope) {
      continue
    }
    const resolved = resolveExportedTypeReference(ctx, importedScope, exportName, seen)
    if (resolved) {
      return resolved
    }
  }
}

function applyReferenceTypeArguments(
  resolved: ResolvedTypeReference | undefined,
  referenceTypeArguments: AnyNode[],
  inheritedBindings: GenericBindings,
): ResolvedTypeReference | undefined {
  if (!resolved) {
    return
  }

  const genericBindings = createDeclarationGenericBindings(
    resolved.node,
    referenceTypeArguments,
    inheritedBindings,
  )

  return {
    node: resolved.node,
    scope: resolved.scope,
    genericBindings,
  }
}

function createDeclarationGenericBindings(
  declaration: AnyNode,
  referenceTypeArguments: AnyNode[] | undefined,
  inheritedBindings: GenericBindings,
): GenericBindings {
  const declarationTypeParameters = declaration.typeParameters?.params
  if (!declarationTypeParameters?.length) {
    return inheritedBindings
  }

  const nextBindings = new Map(inheritedBindings)
  for (let index = 0; index < declarationTypeParameters.length; index += 1) {
    const parameter = declarationTypeParameters[index]
    const parameterName = getIdentifierName(parameter.name)
    if (!parameterName) {
      continue
    }

    let targetType = referenceTypeArguments?.[index]
      ?? parameter.default
      ?? parameter.constraint

    if (!targetType) {
      continue
    }

    const targetParts = targetType.type === 'TSTypeReference'
      ? getQualifiedNameParts(targetType.typeName)
      : []

    if (targetParts.length === 1 && nextBindings.has(targetParts[0]!)) {
      targetType = nextBindings.get(targetParts[0]!)!
    }

    nextBindings.set(parameterName, targetType)
  }

  return nextBindings
}

function resolveImportedScope(
  ctx: TypeResolveContext,
  importerFilename: string,
  source: string,
): TypeScope | undefined {
  if (!source) {
    return
  }

  if (isRelativeImport(source)) {
    const candidates = resolveRelativeImportCandidates(importerFilename, source)
    const matched = candidates.find(candidate => ctx.fs.fileExists(candidate))
    if (matched) {
      const normalized = normalizePath(ctx.fs.realpath?.(matched) ?? matched)
      return ensureTypeScope(ctx, normalized)
    }
  }

  const resolvedByTs = resolveModuleByTs(ctx, importerFilename, source)
  if (resolvedByTs) {
    return ensureTypeScope(ctx, resolvedByTs)
  }

  if (!isRelativeImport(source)) {
    ctx.error(
      `Cannot resolve module "${source}" from "${importerFilename}". If this module needs TS module resolution, call registerTS(ts) first.`,
      undefined,
      importerFilename,
    )
  }
}

function resolveModuleByTs(
  ctx: TypeResolveContext,
  importerFilename: string,
  source: string,
): string | undefined {
  const ts = getRegisteredTS()
  if (!ts) {
    return
  }

  const moduleResolutionKind
    = ts.ModuleResolutionKind?.Bundler
      ?? ts.ModuleResolutionKind?.NodeNext
      ?? ts.ModuleResolutionKind?.Node16
      ?? ts.ModuleResolutionKind?.Node10
      ?? ts.ModuleResolutionKind?.Classic

  const compilerOptions = {
    moduleResolution: moduleResolutionKind,
    allowJs: true,
    target: ts.ScriptTarget?.ESNext,
  }

  const host = {
    fileExists: (file: string) => ctx.fs.fileExists(file) || !!ts.sys.fileExists?.(file),
    readFile: (file: string) => ctx.fs.readFile(file) ?? ts.sys.readFile?.(file),
    realpath: (file: string) => ctx.fs.realpath?.(file) ?? ts.sys.realpath?.(file) ?? file,
    directoryExists: (dir: string) => ts.sys.directoryExists?.(dir) ?? false,
    getDirectories: (dir: string) => ts.sys.getDirectories?.(dir) ?? [],
    getCurrentDirectory: () => process.cwd(),
    useCaseSensitiveFileNames: () => true,
  }

  const resolvedModule = ts.resolveModuleName(
    source,
    importerFilename,
    compilerOptions,
    host,
  ).resolvedModule

  const resolvedFileName = resolvedModule?.resolvedFileName
  if (!resolvedFileName) {
    return
  }

  return normalizePath(host.realpath(resolvedFileName))
}

function resolveUnionTypeInScope(
  ctx: TypeResolveContext,
  node: AnyNode | undefined,
  scope: TypeScope,
  seen: Set<string>,
  genericBindings: GenericBindings,
): AnyNode[] {
  const current = unwrapTypeNode(node)
  if (!current) {
    return []
  }

  if (current.type === 'TSUnionType') {
    return current.types.flatMap((item: AnyNode) =>
      resolveUnionTypeInScope(ctx, item, scope, seen, genericBindings),
    )
  }

  if (current.type === 'TSTypeReference') {
    const typeNameParts = getQualifiedNameParts(current.typeName)
    if (typeNameParts.length === 1 && genericBindings.has(typeNameParts[0]!)) {
      return resolveUnionTypeInScope(
        ctx,
        genericBindings.get(typeNameParts[0]!)!,
        scope,
        seen,
        genericBindings,
      )
    }

    const resolved = resolveTypeReference(ctx, current, scope, seen, genericBindings)
    if (resolved) {
      return resolveUnionTypeInScope(
        ctx,
        resolved.node,
        resolved.scope,
        seen,
        resolved.genericBindings,
      )
    }
  }

  if (current.type === 'TSTypeAliasDeclaration') {
    const nextBindings = createDeclarationGenericBindings(
      current,
      undefined,
      genericBindings,
    )
    return resolveUnionTypeInScope(ctx, current.typeAnnotation, scope, seen, nextBindings)
  }

  return [current]
}

function resolveStringLiteralUnion(
  ctx: TypeResolveContext,
  node: AnyNode,
  scope: TypeScope,
  seen: Set<string>,
  genericBindings: GenericBindings,
): string[] {
  return unique(
    resolveUnionTypeInScope(ctx, node, scope, seen, genericBindings)
      .map(getLiteralValue)
      .filter((value): value is string => typeof value === 'string'),
  )
}

function getLiteralValue(node: AnyNode): string | undefined {
  if (node.type !== 'TSLiteralType') {
    return
  }

  const literal = node.literal
  if (!literal) {
    return
  }

  if (literal.type === 'Literal' && (typeof literal.value === 'string' || typeof literal.value === 'number')) {
    return String(literal.value)
  }

  if (literal.type === 'TemplateLiteral' && !literal.expressions?.length) {
    return (literal.quasis || []).map((quasi: AnyNode) => quasi.value?.cooked ?? quasi.value?.raw ?? '').join('')
  }
}

function inferRuntimeTypeInScope(
  ctx: TypeResolveContext,
  node: AnyNode | undefined,
  scope: TypeScope,
  seen: Set<string>,
  genericBindings: GenericBindings,
): string[] {
  const current = unwrapTypeNode(node)
  if (!current) {
    return [UNKNOWN_TYPE]
  }

  switch (current.type) {
    case 'TSStringKeyword':
      return ['String']
    case 'TSNumberKeyword':
      return ['Number']
    case 'TSBooleanKeyword':
      return ['Boolean']
    case 'TSObjectKeyword':
    case 'TSTypeLiteral':
      return ['Object']
    case 'TSArrayType':
    case 'TSTupleType':
      return ['Array']
    case 'TSFunctionType':
    case 'TSConstructorType':
      return ['Function']
    case 'TSNullKeyword':
    case 'TSUndefinedKeyword':
    case 'TSVoidKeyword':
    case 'TSNeverKeyword':
      return ['null']
    case 'TSLiteralType': {
      const literalValue = getLiteralValue(current)
      if (literalValue === undefined) {
        return [UNKNOWN_TYPE]
      }
      if (!Number.isNaN(Number(literalValue)) && literalValue.trim() !== '') {
        return ['Number']
      }
      return ['String']
    }
    case 'TSUnionType':
      return unique(
        current.types.flatMap((part: AnyNode) =>
          inferRuntimeTypeInScope(ctx, part, scope, seen, genericBindings),
        ),
      )
    case 'TSIntersectionType': {
      const merged = unique(
        current.types.flatMap((part: AnyNode) =>
          inferRuntimeTypeInScope(ctx, part, scope, seen, genericBindings),
        ),
      )
      if (merged.length > 1 && merged.includes('Object')) {
        return ['Object']
      }
      return merged as string[]
    }
    case 'TSInterfaceDeclaration':
      return ['Object']
    case 'TSTypeAliasDeclaration':
      return inferRuntimeTypeInScope(
        ctx,
        current.typeAnnotation,
        scope,
        seen,
        createDeclarationGenericBindings(current, undefined, genericBindings),
      )
    case 'TSTypeReference': {
      const typeNameParts = getQualifiedNameParts(current.typeName)
      if (typeNameParts.length === 1) {
        const genericMapped = genericBindings.get(typeNameParts[0]!)
        if (genericMapped) {
          return inferRuntimeTypeInScope(
            ctx,
            genericMapped,
            scope,
            seen,
            genericBindings,
          )
        }

        const mapped = RUNTIME_REFERENCE_TYPES[typeNameParts[0]!]
        if (mapped) {
          return [mapped]
        }
      }
      const resolved = resolveTypeReference(
        ctx,
        current,
        scope,
        seen,
        genericBindings,
      )
      if (resolved) {
        return inferRuntimeTypeInScope(
          ctx,
          resolved.node,
          resolved.scope,
          seen,
          resolved.genericBindings,
        )
      }
      return [UNKNOWN_TYPE]
    }
    default:
      return [UNKNOWN_TYPE]
  }
}
