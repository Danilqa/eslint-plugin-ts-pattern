# @danilqa/eslint-plugin-ts-pattern

Warns when you branch on a string-literal union type with `if`/`else`, and points you at [`ts-pattern`](https://github.com/gvergnaud/ts-pattern)'s exhaustive `match` instead.

## Problem

```ts
type State = 'failed' | 'success' | 'pending'

interface Payment {
  state: State
}

function describe(payment: Payment) {
  // Case 1.
  // When "State" later grows a "refunded" variant, the compiler does not flag this "if". The branch silently misses
  // the new case — and so does every other `if` block scattered across the codebase.
  if (payment.state === 'failed') return 'a'

  // Case 2.
  // We implicitly convert union to "boolean" type instead of covering all cases now and in the future. Added 'refunded'?
  // It will be implicitly mached to "b" and we won't notice.
  return payment.state === 'failed' ? 'a' : 'b'
}
```

## Solution

```ts
import { match } from 'ts-pattern'

function describe(payment: Payment) {
  return match(payment.state)
    .with('failed', () => 'a')
    .with('success', () => 'b')
    .with('pending', () => 'c')
    .exhaustive()
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

## Usage

```js
import tsPattern from '@danilqa/eslint-plugin-ts-pattern'

export default [
  {
    // ...
    plugins: { 'ts-pattern': tsPattern },
    rules: {
      'ts-pattern/prefer-match-on-union': 'warn',
    },
    // ...
  },
]
```

## Rules

```ts
type State = 'failed' | 'success' | 'pending'
let state: State
```

| Case                                                | Example                               | Fires |
| --------------------------------------------------- | ------------------------------------- | :---: |
| String-literal union, `===` with literal            | `if (state === 'failed') {}`          |  ✅   |
| String-literal union, `!==` with literal            | `if (state !== 'failed') {}`          |  ✅   |
| Literal on the left side                            | `if ('failed' === state) {}`          |  ✅   |
| Ternary on a string-literal union                   | `state === 'failed' ? 1 : 0`          |  ✅   |
| Member access into a union property                 | `if (payment.state === 'failed') {}`  |  ✅   |
| Optional chain on non-nullable receiver             | `if (payment?.state === 'failed') {}` |  ✅   |
| Optional / nullable property (`State \| undefined`) | `if (payment.state === 'failed') {}`  |  ✅   |
| Plain `string` operand                              | `if (s === 'hi') {}`                  |  ❌   |
| Single-member literal type (`'only'`)               | `if (x === 'only') {}`                |  ❌   |
| Number- or boolean-literal union (`1 \| 2`)         | `if (n === 1) {}`                     |  ❌   |
| Mixed-type union (`'a' \| number`)                  | `if (m === 'a') {}`                   |  ❌   |
| Loose equality (`==` / `!=`)                        | `if (s == 'failed') {}`               |  ❌   |
| Both operands are non-literal                       | `if (a === b) {}`                     |  ❌   |
| `switch` statement                                  | `switch (s) { case 'failed': … }`     |  ❌   |
