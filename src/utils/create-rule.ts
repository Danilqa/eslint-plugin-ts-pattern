import { ESLintUtils } from '@typescript-eslint/utils';

export const createRule = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/danilqa/eslint-plugin-ts-pattern/blob/main/docs/rules/${name}.md`,
);
