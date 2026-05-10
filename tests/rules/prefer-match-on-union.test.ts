import * as path from 'node:path';

import * as tsParser from '@typescript-eslint/parser';
import { RuleTester } from '@typescript-eslint/rule-tester';
import { afterAll, describe, it } from 'vitest';

import { preferMatchOnUnion } from '../../src/rules/prefer-match-on-union.js';

RuleTester.afterAll = afterAll;
RuleTester.it = it;
RuleTester.itOnly = it.only;
RuleTester.describe = describe;

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      project: './tsconfig.json',
      tsconfigRootDir: path.join(import.meta.dirname, '..', 'fixtures'),
    },
  },
});

ruleTester.run('prefer-match-on-union', preferMatchOnUnion, {
  valid: [
    `
      const s: string = 'hi';
      if (s === 'hi') {}
    `,
    `
      type Single = 'only';
      const x: Single = 'only';
      if (x === 'only') {}
    `,
    `
      const a: string = 'x';
      const b: string = 'y';
      if (a === b) {}
    `,
  ],
  invalid: [
    {
      code: `
        type State = 'failed' | 'success' | 'pending';
        interface Payment { state: State }
        declare const payment: Payment;
        if (payment.state === 'failed') {}
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
    {
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const s: State;
        if (s !== 'failed') {}
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
  ],
});
