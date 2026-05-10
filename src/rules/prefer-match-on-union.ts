import type { TSESTree } from '@typescript-eslint/utils'
import { ESLintUtils } from '@typescript-eslint/utils'
import type * as ts from 'typescript'

import { createRule } from '../utils/create-rule'

type MessageIds = 'preferMatch'

function isStringLiteralUnion(type: ts.Type): boolean {
  if (!type.isUnion()) return false
  const constituents = type.types
  if (constituents.length < 2) return false
  return constituents.every((t) => t.isStringLiteral())
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

export const preferMatchOnUnion = createRule<[], MessageIds>({
  name: 'prefer-match-on-union',
  meta: {
    type: 'suggestion',
    docs: {
      description:
        "Warn when `if` branches on a string-literal union type. Prefer ts-pattern's `match(...).exhaustive()`.",
    },
    schema: [],
    messages: {
      preferMatch:
        'Avoid `if` on string-literal union types. Use `match(value).with(...).exhaustive()` from ts-pattern so missing cases are caught at compile time.',
    },
  },
  defaultOptions: [],
  create(context) {
    const services = ESLintUtils.getParserServices(context)
    const checker = services.program.getTypeChecker()

    return {
      IfStatement(node) {
        const test = node.test
        if (test.type !== 'BinaryExpression') return
        if (test.operator !== '===' && test.operator !== '!==') return

        const target = getNonLiteralOperand(test)
        if (!target) return

        const tsNode = services.esTreeNodeToTSNodeMap.get(target)
        const type = checker.getTypeAtLocation(tsNode)

        if (!isStringLiteralUnion(type)) return

        context.report({ node: test, messageId: 'preferMatch' })
      },
    }
  },
})
