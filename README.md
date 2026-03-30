# Feather

[![Version](https://img.shields.io/badge/version-v2.0.0-0f172a?style=for-the-badge)](https://github.com/immortalized/feather/releases)

Feather is a runtime-first UI engine for building explicit interfaces with fine-grained reactivity, fluent DOM modifiers, and no template layer.

## What Feather Is

Feather keeps the view layer small and readable:

- no JSX
- no template syntax
- no virtual DOM
- no compiler
- no hidden reactive unwrapping

Feather uses plain JavaScript functions, reactive primitives, and chained modifiers:

```js
Box(
  Title('Feather'),
  Paragraph('Runtime-first UI.'),
).padding(24).background('#111').color('#fff');
```

## Core Rule

Functions define reactivity.

Correct:

```js
Text(() => count())
Paragraph().text(() => user.name())
Box().className(() => ({ active: open() }))
```

Incorrect:

```js
Text(count())
Text(ready ? 'yes' : 'no')
Box().className({ active: count })
```

Signals are callable, but bindings should still read them inside a function so reactivity stays explicit.

```js
const count = signal(8);

count(); // 8
count(10); // set
count((value) => value * 2); // update
```

## Quick Start

```js
import {
  Button,
  Paragraph,
  Title,
  VStack,
  mount,
  signal,
} from '../feather/index.js';

const count = signal(0);

mount(
  VStack(
    Title('Counter'),
    Paragraph().text(() => `Count: ${count()}`),
    Button('Increment')
      .onClick(() => count((value) => value + 1)),
  )
    .gap(12)
    .padding(24),
);
```

`mount(...)` renders into `#app` by default.

## Reactivity Examples

### Text And Events

```js
import { Button, Paragraph, VStack, signal } from '../feather/index.js';

const open = signal(false);

VStack(
  Button(() => (open() ? 'Hide' : 'Show'))
    .onClick(() => open((value) => !value)),
  Paragraph('Now visible')
    .showWhen(() => open()),
);
```

### Computed State

```js
import { Paragraph, computed, signal } from '../feather/index.js';

const first = signal('Runtime');
const second = signal('Feather');
const full = computed(() => `${first()} ${second()}`);

Paragraph().text(() => full());
```

### Reactive Objects

Objects are not reactive by themselves. The function boundary is the reactive part.

```js
Box()
  .style(() => ({
    opacity: loading() ? 0.5 : 1,
    pointerEvents: loading() ? 'none' : 'auto',
  }))
  .className(() => ({
    loading: loading(),
    ready: !loading(),
  }));
```

### Lists And Control Flow

```js
import { ForEach, Show, Text, signal } from '../feather/index.js';

const items = signal(['Sword', 'Orb', 'Rune']);
const ready = signal(true);

Show(
  () => ready(),
  ForEach(() => items(), (item) => Text(item)),
  Text('Loading...'),
);
```

## Page Model

Feather pages are plain objects created with `page(...)`.

Use:

- `setup()` for long-lived state
- `render()` for view structure
- `mount()` for DOM-side effects, timers, bindings, and async boot work

```js
import {
  Box,
  Button,
  Paragraph,
  Title,
  page,
  setupState,
  signal,
} from '../feather/index.js';

export default page({
  name: 'SettingsPage',

  setup() {
    return setupState({
      open: signal(false),
    });
  },

  render(ctx) {
    return Box(
      Title('Settings'),
      Button(() => (ctx.open() ? 'Hide details' : 'Show details'))
        .onClick(() => ctx.open((value) => !value)),
      Paragraph('These details stay live because the binding is a function.')
        .showWhen(() => ctx.open()),
    ).padding(24);
  },
});
```

## Routing Example

Feather's current router is small and page-driven. Routes are defined as plain objects in an array and rendered into a root node.

```js
import { createRouter } from '../feather/index.js';
import Home from './pages/Home.js';
import Settings from './pages/Settings.js';

const router = createRouter({
  root: '#app',
  routes: [
    { path: '/', component: Home },
    { path: '/settings', component: Settings },
  ],
  notFoundPath: '/',
});

router.start();
```

Navigation stays direct:

```js
window.router.navigate('/settings');
```

Router links work by marking normal links:

```js
Link('Settings')
  .href('/settings')
  .routerLink();
```

## Real App Flow

Here is a typical Feather app flow for something like a small admin dashboard.

### 1. App Bootstrap

The entry file mounts the router and exposes navigation where needed:

- imports page modules
- defines the route list
- creates the router
- starts routing

```js
const router = createRouter({
  root: '#app',
  routes,
});

router.start();
```

### 2. App Router Layer

Route definitions stay plain and app-owned:

- top-level layout selection
- auth guards
- not-found fallback
- route-specific data loading hooks if the app wants them

That keeps Feather small while the app owns its own navigation policy.

### 3. Page Setup

Each page builds its long-lived state in `setup()`:

- local signals
- computed values
- form state
- grouped context objects

### 4. Reactive Render

`render(ctx)` returns a view tree using primitives such as `Box`, `Input`, `Paragraph`, `Button`, and `Link`.

Live values stay explicit:

```js
Paragraph().text(() => ctx.filters.query())
Button(() => (ctx.panelOpen() ? 'Hide filters' : 'Show filters'))
```

### 5. Async And Navigation

After an async action succeeds, the page can update signals and navigate directly:

```js
ctx.saving(true);
await saveSettings(ctx.form.values());
ctx.saving(false);
window.router.navigate('/settings/saved');
```

That is the typical Feather loop:

1. Router selects a page.
2. `setup()` creates state.
3. `render()` returns the DOM tree.
4. Function bindings keep the UI live.
5. Events and async work update signals or navigate directly.

## Start Here

Reach for these first:

- `mount(...)` for bootstrapping
- `page(...)` for screens
- `signal(...)` and `computed(...)` for state
- `Show(...)` and `ForEach(...)` for control flow
- `createForm(...)` for forms
- `createRouter(...)` for routing

## Runtime Rules

- create reactive state in `setup()` or module scope
- pass functions for live bindings
- objects and arrays are only reactive when wrapped in a function
- dev mode warns about binding misuse
- strict mode turns binding misuse into errors

## Public API

High-level building blocks:

- layout: `Box`, `VStack`, `HStack`, `ZStack`, `Spacer`
- text: `Text`, `Paragraph`, `Title`, `Subtitle`, `Span`
- controls: `Button`, `Input`, `Checkbox`, `Link`, `Form`, `Alert`
- helpers: `mount`, `page`, `Show`, `ForEach`
- state: `signal`, `computed`, `store`, `effect`
- forms: `createForm`, `TextField`, `CheckboxField`, `SubmitButton`
- routing: `createRouter`
- theme: `token`, `resolveThemeProps`, `cx`, `defineTheme`

Low-level helpers are still available, but Feather reads best when you stay inside the small core surface.

## Why Teams Keep It

Feather stays readable after the novelty wears off.

State is explicit.

Bindings are obvious.

DOM output stays close to the code that defines it.

That makes Feather easier to debug, easier to refactor, and calm to maintain.
