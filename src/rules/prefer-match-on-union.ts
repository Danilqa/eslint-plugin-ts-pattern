import type { TSESTree } from '@typescript-eslint/utils'
import { ESLintUtils } from '@typescript-eslint/utils'
import type * as ts from 'typescript'

import { createRule } from '../utils/create-rule'

type MessageIds = 'preferMatch'

function isNullish(type: ts.Type, checker: ts.TypeChecker): boolean {
  const printed = checker.typeToString(type)
  return printed === 'null' || printed === 'undefined'
}

function isStringLiteralUnion(type: ts.Type, checker: ts.TypeChecker): boolean {
  if (!type.isUnion()) return false
  const constituents = type.types
  const literals = constituents.filter((t) => t.isStringLiteral())
  if (literals.length < 2) return false
  return constituents.every((t) => t.isStringLiteral() || isNullish(t, checker))
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

export const preferMatchOnUnion = createRule<[], MessageIds>({
  name: 'prefer-match-on-union',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Warn when `===`/`!==` is used against a string-literal union type. Prefer ts-pattern's `match(...).exhaustive()`.",
    },
    schema: [],
    messages: {
      preferMatch:
        'Avoid `===`/`!==` checks on string-literal union types. Use `match(value).with(...).exhaustive()` from ts-pattern so missing cases are caught at compile time. Use .otherwise() for dynamic backend types. Read more: https://github.com/Danilqa/eslint-plugin-ts-pattern',
    },
  },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context)
    const checker = services.program.getTypeChecker()

    function check(node: TSESTree.BinaryExpression) {
      if (node.operator !== '===' && node.operator !== '!==') return

      const target = getNonLiteralOperand(node)
      if (!target) return

      const tsNode = services.esTreeNodeToTSNodeMap.get(target)
      const type = checker.getTypeAtLocation(tsNode)

      if (!isStringLiteralUnion(type, checker)) return

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
