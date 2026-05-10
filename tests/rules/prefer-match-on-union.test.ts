import * as path from 'node:path'
import { after, describe, it } from 'node:test'

import * as tsParser from '@typescript-eslint/parser'
import { RuleTester } from '@typescript-eslint/rule-tester'

import { preferMatchOnUnion } from '../../src/rules/prefer-match-on-union'

RuleTester.afterAll = after
RuleTester.it = it
RuleTester.itOnly = it.only
RuleTester.describe = describe

const ruleTester = new RuleTester({
  languageOptions: {
    parser: tsParser,
    parserOptions: {
      project: './tsconfig.json',
      tsconfigRootDir: path.join(import.meta.dirname, '..', 'fixtures'),
    },
  },
})

ruleTester.run('prefer-match-on-union', preferMatchOnUnion, {
  valid: [
    {
      name: 'plain string operand — no union',
      code: `
        const s: string = 'hi';
        if (s === 'hi') {}
      `,
    },
    {
      name: 'single-member literal type — union of 1 does not qualify',
      code: `
        type Single = 'only';
        const x: Single = 'only';
        if (x === 'only') {}
      `,
    },
    {
      name: 'two non-literal operands — no string Literal in the comparison',
      code: `
        const a: string = 'x';
        const b: string = 'y';
        if (a === b) {}
      `,
    },
    {
      name: 'number-literal union — rule is string-only',
      code: `
        type N = 1 | 2;
        declare const n: N;
        if (n === 1) {}
      `,
    },
    {
      name: 'boolean union — rule is string-only',
      code: `
        type B = true | false;
        declare const b: B;
        if (b === true) {}
      `,
    },
    {
      name: 'mixed-type union — not a pure string-literal union',
      code: `
        type M = 'a' | number;
        declare const m: M;
        if (m === 'a') {}
      `,
    },
    {
      name: 'loose equality (==) — only ===/!== triggers',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const s: State;
        if (s == 'failed') {}
      `,
    },
    {
      name: 'loose inequality (!=) — only ===/!== triggers',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const s: State;
        if (s != 'failed') {}
      `,
    },
    {
      name: 'switch statement — visitor is IfStatement only',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const s: State;
        switch (s) {
          case 'failed': break;
          case 'success': break;
          case 'pending': break;
        }
      `,
    },
    {
      name: 'ternary — visitor is IfStatement only',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const s: State;
        const r = s === 'failed' ? 1 : 0;
      `,
    },
    {
      name: 'both operands typed as the union — no string Literal',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const a: State;
        declare const b: State;
        if (a === b) {}
      `,
    },
    {
      name: 'match() itself — sanity: the construct we encourage must not fire',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const s: State;
        declare function match<T>(v: T): {
          with: (p: T, h: () => string) => { exhaustive: () => string; with: (p: T, h: () => string) => any };
          exhaustive: () => string;
        };
        const r = match(s)
          .with('failed', () => 'a')
          .with('success', () => 'b')
          .with('pending', () => 'c')
          .exhaustive();
      `,
    },
    {
      name: 'optional chain on nullable receiver — type includes undefined, not pure string union',
      code: `
        type State = 'failed' | 'success' | 'pending';
        interface Payment { state: State }
        declare const payment: Payment | undefined;
        if (payment?.state === 'failed') {}
      `,
    },
  ],
  invalid: [
    {
      name: 'README example via interface',
      code: `
        type State = 'failed' | 'success' | 'pending';
        interface Payment { state: State }
        declare const payment: Payment;
        if (payment.state === 'failed') {}
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
    {
      name: 'bare identifier with !==',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const s: State;
        if (s !== 'failed') {}
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
    {
      name: 'literal on the LEFT — symmetric branch',
      code: `
        type State = 'failed' | 'success' | 'pending';
        interface Payment { state: State }
        declare const payment: Payment;
        if ('failed' === payment.state) {}
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
    {
      name: 'chained member expression',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const obj: { inner: { state: State } };
        if (obj.inner.state === 'failed') {}
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
    {
      name: 'two-member union boundary — fires at the minimum',
      code: `
        type T = 'a' | 'b';
        declare const t: T;
        if (t === 'a') {}
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
    {
      name: 'five-member union — many-member sanity',
      code: `
        type T = 'a' | 'b' | 'c' | 'd' | 'e';
        declare const t: T;
        if (t === 'c') {}
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
    {
      name: 'else-if chain — TS narrows along the chain, last branch (single literal) does not fire',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const s: State;
        if (s === 'failed') {} else if (s === 'success') {} else if (s === 'pending') {}
      `,
      errors: [{ messageId: 'preferMatch' }, { messageId: 'preferMatch' }],
    },
    {
      name: 'optional chain on non-nullable receiver — TS narrows to the union, fires',
      code: `
        type State = 'failed' | 'success' | 'pending';
        interface Payment { state: State }
        declare const payment: Payment;
        if (payment?.state === 'failed') {}
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
  ],
})
