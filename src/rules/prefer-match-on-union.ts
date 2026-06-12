import type { TSESTree } from '@typescript-eslint/utils'
import { ESLintUtils } from '@typescript-eslint/utils'
import type * as ts from 'typescript'

import { createRule } from '../utils/create-rule'

type MessageIds = 'preferMatch'

export interface Options {
  maxUnionSize: number
}

const DEFAULT_MAX_UNION_SIZE = 10

function isNullish(type: ts.Type, checker: ts.TypeChecker): boolean {
  const printed = checker.typeToString(type)
  return printed === 'null' || printed === 'undefined'
}

function getStringLiteralUnionSize(
  type: ts.Type,
  checker: ts.TypeChecker,
): number | null {
  if (!type.isUnion()) return null
  const constituents = type.types
  const literals = constituents.filter((t) => t.isStringLiteral())
  if (literals.length < 2) return null
  const allLiteralOrNullish = constituents.every(
    (t) => t.isStringLiteral() || isNullish(t, checker),
  )
  if (!allLiteralOrNullish) return null
  return literals.length
}

function getNonLiteralOperand(
  node: TSESTree.BinaryExpression,
): TSESTree.Expression | null {
  const { left, right } = node
  if (left.type === 'PrivateIdentifier') return null
  const leftIsStringLit =
    left.type === 'Literal' && typeof left.value === 'string'
  const rightIsStringLit =
    right.type === 'Literal' && typeof right.value === 'string'
  if (leftIsStringLit && !rightIsStringLit) return right
  if (rightIsStringLit && !leftIsStringLit) return left
  return null
}

function isTypeofExpression(node: TSESTree.Expression): boolean {
  return node.type === 'UnaryExpression' && node.operator === 'typeof'
}

function isInsideLoopTest(node: TSESTree.BinaryExpression): boolean {
  let current: TSESTree.Node = node
  let parent: TSESTree.Node | undefined = current.parent
  while (
    parent &&
    (parent.type === 'LogicalExpression' || parent.type === 'UnaryExpression')
  ) {
    current = parent
    parent = current.parent
  }
  if (!parent) return false
  return (
    (parent.type === 'WhileStatement' || parent.type === 'DoWhileStatement') &&
    parent.test === current
  )
}

function isInsideTypePredicate(node: TSESTree.BinaryExpression): boolean {
  let current: TSESTree.Node | undefined = node.parent
  while (current) {
    if (
      current.type === 'FunctionDeclaration' ||
      current.type === 'FunctionExpression' ||
      current.type === 'ArrowFunctionExpression'
    ) {
      return current.returnType?.typeAnnotation.type === 'TSTypePredicate'
    }
    current = current.parent
  }
  return false
}

export const preferMatchOnUnion = createRule<[Options], MessageIds>({
  name: 'prefer-match-on-union',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Warn when `===`/`!==` is used against a string-literal union type. Prefer ts-pattern's `match(...).exhaustive()`.",
    },
    schema: [
      {
        type: 'object',
        properties: {
          maxUnionSize: {
            type: 'integer',
            minimum: 2,
            description:
              'Skip unions with more string-literal members than this. Large unions (currencies, country codes, locales) are impractical to cover with an exhaustive match.',
          },
        },
        additionalProperties: false,
      },
    ],
    messages: {
      preferMatch:
        'Avoid `===`/`!==` checks on string-literal union types. Use `match(value).with(...).exhaustive()` from ts-pattern so missing cases are caught at compile time. Use .otherwise() for dynamic backend types. Read more: https://github.com/Danilqa/eslint-plugin-ts-pattern',
    },
  },
  defaultOptions: [{ maxUnionSize: DEFAULT_MAX_UNION_SIZE }],
  create(context, [options]) {
    const services = ESLintUtils.getParserServices(context)
    const checker = services.program.getTypeChecker()

    function check(node: TSESTree.BinaryExpression) {
      if (node.operator !== '===' && node.operator !== '!==') return

      const target = getNonLiteralOperand(node)
      if (!target) return

      // `typeof x` is typed as a string-literal union ("string" | "number" | ...),
      // but it is a runtime type check, not a domain state to match on.
      if (isTypeofExpression(target)) return

      const tsNode = services.esTreeNodeToTSNodeMap.get(target)
      const type = checker.getTypeAtLocation(tsNode)

      const unionSize = getStringLiteralUnionSize(type, checker)
      if (unionSize === null) return
      if (unionSize > options.maxUnionSize) return

      // A `x is T` predicate is itself the narrowing primitive — the comparison
      // inside it is the implementation, and match() returns plain boolean.
      if (isInsideTypePredicate(node)) return

      context.report({ node, messageId: 'preferMatch' })
    }

    return {
      BinaryExpression(node) {
        if (isInsideLoopTest(node)) return
        check(node)
      },
    }
  },
})
