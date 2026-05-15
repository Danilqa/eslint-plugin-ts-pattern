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
      name: 'switch statement — neither IfStatement nor ConditionalExpression',
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
      name: 'single string literal with null — not enough literals to qualify',
      code: `
        type T = 'a' | null;
        declare const t: T;
        if (t === 'a') {}
      `,
    },
    {
      name: 'mixed-type union with nullish — non-nullish non-literal disqualifies',
      code: `
        type M = 'a' | 'b' | number | null;
        declare const m: M;
        if (m === 'a') {}
      `,
    },
    {
      name: 'while loop test — loops are iteration, match() does not apply',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const s: State;
        while (s !== 'failed') {}
      `,
    },
    {
      name: 'do-while loop test — symmetric with while',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const s: State;
        do {} while (s !== 'failed');
      `,
    },
    {
      name: 'while loop test inside &&  — exclusion walks through LogicalExpression',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const s: State;
        declare const other: boolean;
        while (s !== 'failed' && other) {}
      `,
    },
    {
      name: 'non-literal binary in assignment — broad visitor still respects operand filter',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const a: State;
        declare const b: State;
        const r = a === b;
      `,
    },
  ],
  invalid: [
    {
      name: 'union propery from interface',
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
    {
      name: 'ternary — ConditionalExpression visitor fires too',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const s: State;
        const r = s === 'failed' ? 1 : 0;
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
    {
      name: 'ternary with !== and literal on the LEFT',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const s: State;
        const r = 'failed' !== s ? 1 : 0;
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
    {
      name: 'nested ternary — both ConditionalExpression tests fire',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const s: State;
        const r = s === 'failed' ? 'a' : s === 'success' ? 'b' : 'c';
      `,
      errors: [{ messageId: 'preferMatch' }, { messageId: 'preferMatch' }],
    },
    {
      name: 'optional property — type includes undefined alongside string literals',
      code: `
        type State = 'failed' | 'success' | 'pending';
        interface Payment { state?: State }
        declare const payment: Payment;
        if (payment.state === 'failed') {}
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
    {
      name: 'nullable property — type includes null alongside string literals',
      code: `
        type State = 'failed' | 'success' | 'pending';
        interface Payment { state: State | null }
        declare const payment: Payment;
        if (payment.state === 'failed') {}
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
    {
      name: 'optional chain on nullable receiver — String | undefined still fires',
      code: `
        type State = 'failed' | 'success' | 'pending';
        interface Payment { state: State }
        declare const payment: Payment | undefined;
        if (payment?.state === 'failed') {}
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
    {
      name: 'logical AND inside if test — both children inspected',
      code: `
        type Currency = 'GBP' | 'USD' | 'EUR';
        type Tier = 'ZERO' | 'TWO_PERCENT';
        interface Account { currency: Currency }
        interface Payrun { tier: Tier }
        declare const account: Account;
        declare const payrun: Payrun;
        if (account.currency !== 'GBP' && payrun.tier !== 'ZERO') {}
      `,
      errors: [{ messageId: 'preferMatch' }, { messageId: 'preferMatch' }],
    },
    {
      name: 'logical OR inside if test',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const s: State;
        declare const other: boolean;
        if (s === 'failed' || other) {}
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
    {
      name: 'negated comparison',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const s: State;
        if (!(s === 'failed')) {}
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
    {
      name: 'variable initializer',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const s: State;
        const isFailed = s === 'failed';
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
    {
      name: 'return statement',
      code: `
        type State = 'failed' | 'success' | 'pending';
        function isFailed(s: State) { return s === 'failed'; }
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
    {
      name: 'arrow function body',
      code: `
        type State = 'failed' | 'success' | 'pending';
        const isFailed = (s: State) => s === 'failed';
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
    {
      name: 'function argument',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const s: State;
        declare function log(v: boolean): void;
        log(s === 'failed');
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
    {
      name: 'object property value',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const s: State;
        const o = { failed: s === 'failed' };
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
    {
      name: 'array element',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const s: State;
        const a = [s === 'failed'];
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
    {
      name: 'ternary branch (not the test)',
      code: `
        type State = 'failed' | 'success' | 'pending';
        declare const s: State;
        declare const flag: boolean;
        const r = flag ? (s === 'failed') : false;
      `,
      errors: [{ messageId: 'preferMatch' }],
    },
  ],
})
