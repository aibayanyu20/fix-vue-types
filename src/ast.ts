export interface AnyNode {
  type: string
  start?: number
  end?: number
  leadingComments?: Array<{ type?: string, value: string, start?: number, end?: number }>
  [key: string]: any
}

export type Node = AnyNode
export type Program = AnyNode & { body: AnyNode[], sourceType?: string }
export type Statement = AnyNode
export type Expression = AnyNode
export type TemplateLiteral = AnyNode
export type Identifier = AnyNode
export type StringLiteral = AnyNode
export type CallExpression = AnyNode
export type ObjectExpression = AnyNode
export type ObjectPattern = AnyNode
export type ObjectProperty = AnyNode
export type ObjectMethod = AnyNode
export type ArrayPattern = AnyNode
export type RestElement = AnyNode
export type ImportSpecifier = AnyNode
export type ImportDefaultSpecifier = AnyNode
export type ImportNamespaceSpecifier = AnyNode
export type ClassDeclaration = AnyNode
export type ClassProperty = AnyNode
export type ClassMethod = AnyNode
export type TSType = AnyNode
export type TSTypeAnnotation = AnyNode
export type TSTypeElement = AnyNode
export type TSTypeLiteral = AnyNode
export type TSPropertySignature = AnyNode
export type TSMethodSignature = AnyNode
export type TSCallSignatureDeclaration = AnyNode
export type TSConditionalType = AnyNode
export type TSEnumDeclaration = AnyNode
export type TSExpressionWithTypeArguments = AnyNode
export type TSFunctionType = AnyNode
export type TSImportType = AnyNode
export type TSIndexedAccessType = AnyNode
export type TSInterfaceDeclaration = AnyNode
export type TSMappedType = AnyNode
export type TSModuleBlock = AnyNode
export type TSModuleDeclaration = AnyNode
export type TSQualifiedName = AnyNode
export type TSTemplateLiteralType = AnyNode
export type TSTypeQuery = AnyNode
export type TSTypeReference = AnyNode
