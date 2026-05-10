# @danilqa/eslint-plugin-ts-pattern

An ESLint plugin that warns when you branch on a string-literal union type with `if`/`else`, and points you at [`ts-pattern`](https://github.com/gvergnaud/ts-pattern)'s exhaustive `match` instead.

## Problem

```ts
type State = 'failed' | 'success' | 'pending';

interface Payment {
  state: State;
}

function describe(payment: Payment) {
  if (payment.state === 'failed') return 'a';
  // …
}
```

When `State` later grows a `'refunded'` variant, the compiler does not flag this `if`. The branch silently misses the new case — and so does every other `if` block scattered across the codebase.

## Solution

```ts
import { match } from 'ts-pattern';

function describe(payment: Payment) {
  return match(payment.state)
    .with('failed', () => 'a')
    .with('success', () => 'b')
    .with('pending', () => 'c')
    .exhaustive();
}
```

`.exhaustive()` makes a missing case a **compile-time error**. Adding `'refunded'` to `State` immediately fails the build everywhere it isn't handled.

## Install

```sh
npm i --dev @danilqa/eslint-plugin-ts-pattern 
```

```
yarn add -D @danilqa/eslint-plugin-ts-pattern
```

```
pnpm add -D @danilqa/eslint-plugin-ts-pattern
```

## Usage (flat config)

```js
import tsPattern from '@danilqa/eslint-plugin-ts-pattern';

export default [
  {
    // ...
    plugins: { 'ts-pattern': tsPattern },
    rules: {
      'ts-pattern/prefer-match-on-union': 'warn',
    },
    // ...
  },
];
```

## Rules

| Rule | Description |
| --- | --- |
| `prefer-match-on-union` | Warn on `if (x === 'literal')` when `x` has a string-literal union type. |
