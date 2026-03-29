# Feather

Feather is a runtime-first UI engine for building explicit interfaces with fine-grained reactivity, fluent DOM modifiers, and no template layer.

## Version

| Tag | Status | Style |
| --- | --- | --- |
| `v0.0.0` | active local framework build | runtime-first, fluent, explicit |

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
  Title('Bloodwave'),
  Paragraph('Runtime-first UI.'),
).padding(24).background('#111').color('#fff');
```

## Core Rule

Reactive values are only reactive when passed as functions.

Correct:

```js
Text(() => count.get())
Paragraph().text(() => user.name.get())
Box().className(() => ({ active: open.get() }))
```

Incorrect:

```js
Text(count.get())
Text(count)
Box().className({ active: count })
```

If something should update, wrap the whole binding in a function.

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
    Paragraph().text(() => `Count: ${count.get()}`),
    Button('Increment')
      .onClick(() => count.update((value) => value + 1)),
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
  Button(() => (open.get() ? 'Hide' : 'Show'))
    .onClick(() => open.update((value) => !value)),
  Paragraph('Now visible')
    .showWhen(() => open.get()),
);
```

### Computed State

```js
import { Paragraph, computed, signal } from '../feather/index.js';

const first = signal('Project');
const second = signal('Bloodwave');
const full = computed(() => `${first.get()} ${second.get()}`);

Paragraph().text(() => full.get());
```

### Reactive Objects

Objects are not reactive by themselves. The function boundary is the reactive part.

```js
Box()
  .style(() => ({
    opacity: loading.get() ? 0.5 : 1,
    pointerEvents: loading.get() ? 'none' : 'auto',
  }))
  .className(() => ({
    loading: loading.get(),
    ready: !loading.get(),
  }));
```

### Lists And Control Flow

```js
import { ForEach, Show, Text, signal } from '../feather/index.js';

const items = signal(['Sword', 'Orb', 'Rune']);
const ready = signal(true);

Show(
  () => ready.get(),
  ForEach(() => items.get(), (item) => Text(item)),
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
      Button(() => (ctx.open.get() ? 'Hide details' : 'Show details'))
        .onClick(() => ctx.open.update((value) => !value)),
      Paragraph('These details stay live because the binding is a function.')
        .showWhen(() => ctx.open.get()),
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

This repository already uses Feather end-to-end.

### 1. App Bootstrap

In [`src/js/main.js`](/c:/Users/User/Documents/GitHub/Project-Bloodwave-Web/src/js/main.js), the app:

- imports page modules
- defines the route list
- creates the app router
- exposes `window.router`
- starts routing

```js
const router = Router(routes);
window.router = router;
router.start();
```

### 2. App Router Layer

In [`src/js/router.js`](/c:/Users/User/Documents/GitHub/Project-Bloodwave-Web/src/js/router.js), the app wraps Feather's router with project-specific behavior:

- auth redirects
- starfield toggling
- footer injection
- route-level post-render work

That keeps the framework router small while the app owns its own policies.

### 3. Page Setup

In pages like [`src/js/pages/Login.js`](/c:/Users/User/Documents/GitHub/Project-Bloodwave-Web/src/js/pages/Login.js), `setup()` creates:

- local signals
- computed values
- form state
- grouped context objects

### 4. Reactive Render

`render(ctx)` returns a view tree using primitives such as `Box`, `Input`, `Paragraph`, `Button`, and `Link`.

Live values are passed as functions:

```js
Paragraph().text(() => ctx.submit.error.get())
SubmitButton(...).className(() => ({ success: ctx.submit.success.get() }))
```

### 5. Async And Navigation

After login succeeds, the page does not need a separate router hook system. It just navigates:

```js
ctx.timeout(() => window.router.navigate('/main'), 700, 'lifetime');
```

That is the typical Feather loop in this app:

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
