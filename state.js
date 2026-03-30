import { getInternalFeatherConfig } from './config.js';

const FEATHER_REACTIVE = Symbol('feather.reactive');
const observerQueue = new Set();
const reactiveUsageWarnings = new Set();

let activeObserver = null;
let batchDepth = 0;
let isFlushing = false;
let reactiveCreationPhase = null;

function warnReactiveUsage(message) {
  const config = getInternalFeatherConfig();

  // Strict mode enforces rules with errors.
  if (config.strictBindings) {
    throw new Error(message);
  }

  // Dev mode enables warnings and guidance.
  if (!config.dev) {
    return;
  }

  if (reactiveUsageWarnings.has(message)) {
    return;
  }

  reactiveUsageWarnings.add(message);
  console.warn(message);
}

function warnReactiveReadDuringRender() {
  if (!reactiveCreationPhase || activeObserver) {
    return;
  }

  warnReactiveUsage('Feather: Reactive values are only reactive when passed as functions (() => value). Move this read into a function binding.');
}

function scheduleFlush() {
  if (isFlushing || batchDepth > 0) return;
  isFlushing = true;
  queueMicrotask(flushObservers);
}

function flushObservers() {
  isFlushing = false;

  while (observerQueue.size > 0) {
    const pending = Array.from(observerQueue);
    observerQueue.clear();

    pending.forEach((observer) => {
      observer.scheduled = false;
      observer.run();
    });
  }
}

function cleanupObserver(observer) {
  observer.sources.forEach((source) => {
    source.observers.delete(observer);
  });

  observer.sources.clear();
}

function trackDependency(source) {
  if (!activeObserver) return;
  source.observers.add(activeObserver);
  activeObserver.sources.add(source);
}

function notifySource(source, value) {
  source.listeners.forEach((listener) => listener(value));
  source.observers.forEach((observer) => observer.schedule());
}

function createSource() {
  return {
    observers: new Set(),
    listeners: new Set(),
  };
}

function createReactiveHandle(kind, api, invoke) {
  const handle = typeof invoke === 'function'
    ? function featherReactiveHandle(...args) {
      return invoke(...args);
    }
    : {};

  Object.defineProperties(handle, {
    ...Object.getOwnPropertyDescriptors(api),
    [FEATHER_REACTIVE]: {
      value: true,
    },
    __featherReactive: {
      value: true,
    },
    kind: {
      value: kind,
      enumerable: true,
    },
  });

  return handle;
}

function createObserver(run, options = {}) {
  const observer = {
    disposed: false,
    scheduled: false,
    sources: new Set(),
    run() {
      if (observer.disposed) return;

      cleanupObserver(observer);

      const previousObserver = activeObserver;
      activeObserver = observer;

      try {
        run();
      } finally {
        activeObserver = previousObserver;
      }
    },
    schedule() {
      if (observer.disposed || observer.scheduled) return;
      observer.scheduled = true;
      observerQueue.add(observer);
      scheduleFlush();
    },
    dispose() {
      observer.disposed = true;
      observerQueue.delete(observer);
      cleanupObserver(observer);
    },
  };

  if (!options.lazy) {
    observer.run();
  }

  return observer;
}

function assertReactiveCreationAllowed(kind) {
  if (!reactiveCreationPhase) {
    return;
  }

  throw new Error(
    `Feather: ${kind}() cannot be created during ${reactiveCreationPhase}. `
    + 'Create reactive state in setup() or module scope instead.',
  );
}

export function isReactive(value) {
  return Boolean(value) && value[FEATHER_REACTIVE] === true;
}

export function read(value) {
  if (!isReactive(value)) {
    return value;
  }

  if (typeof value === 'function') {
    return value();
  }

  return value.get();
}

export function batch(fn) {
  batchDepth += 1;

  try {
    return fn();
  } finally {
    batchDepth -= 1;
    if (batchDepth === 0) {
      scheduleFlush();
    }
  }
}

export function untrack(fn) {
  const previousObserver = activeObserver;
  activeObserver = null;

  try {
    return fn();
  } finally {
    activeObserver = previousObserver;
  }
}

export function beginReactiveCreationPhase(phase) {
  reactiveCreationPhase = phase;
}

export function endReactiveCreationPhase() {
  reactiveCreationPhase = null;
}

export function signal(initialValue) {
  assertReactiveCreationAllowed('signal');
  const source = createSource();
  let value = initialValue;

  const readValue = () => {
    warnReactiveReadDuringRender();
    trackDependency(source);
    return value;
  };

  const writeValue = (nextValue) => {
    if (Object.is(value, nextValue)) {
      return value;
    }

    value = nextValue;
    notifySource(source, value);
    return value;
  };

  const updateValue = (updater) => writeValue(updater(value));

  return createReactiveHandle('signal', {
    get value() {
      return readValue();
    },
    set value(nextValue) {
      writeValue(nextValue);
    },
    get() {
      return readValue();
    },
    peek() {
      return value;
    },
    set(nextValue) {
      return writeValue(nextValue);
    },
    update(updater) {
      return updateValue(updater);
    },
    subscribe(listener) {
      source.listeners.add(listener);
      return () => source.listeners.delete(listener);
    },
  }, (...args) => {
    if (args.length === 0) {
      return readValue();
    }

    const [nextValue] = args;
    return typeof nextValue === 'function'
      ? updateValue(nextValue)
      : writeValue(nextValue);
  });
}

export function computed(getter) {
  assertReactiveCreationAllowed('computed');
  const source = createSource();
  let initialized = false;
  let value;

  const observer = createObserver(() => {
    const nextValue = getter();
    const changed = !initialized || !Object.is(value, nextValue);

    initialized = true;
    value = nextValue;

    if (changed) {
      notifySource(source, value);
    }
  }, { lazy: true });

  const readValue = () => {
    warnReactiveReadDuringRender();
    trackDependency(source);

    if (!initialized) {
      observer.run();
    }

    return value;
  };

  return createReactiveHandle('computed', {
    get value() {
      return readValue();
    },
    get() {
      return readValue();
    },
    peek() {
      if (!initialized) {
        observer.run();
      }

      return value;
    },
    subscribe(listener) {
      source.listeners.add(listener);
      return () => source.listeners.delete(listener);
    },
  }, (...args) => {
    if (args.length > 0) {
      throw new Error('Feather: computed values are read-only. Call computed() with no arguments to read the current value.');
    }

    return readValue();
  });
}

export function effect(fn) {
  assertReactiveCreationAllowed('effect');
  let cleanup = null;

  const observer = createObserver(() => {
    if (typeof cleanup === 'function') {
      cleanup();
      cleanup = null;
    }

    const nextCleanup = fn();
    cleanup = typeof nextCleanup === 'function' ? nextCleanup : null;
  });

  return () => {
    observer.dispose();

    if (typeof cleanup === 'function') {
      cleanup();
      cleanup = null;
    }
  };
}

export function store(initialState = {}) {
  assertReactiveCreationAllowed('store');
  const state = signal({ ...initialState });

  return createReactiveHandle('store', {
    get value() {
      return state.value;
    },
    get() {
      return state();
    },
    peek() {
      return state.peek();
    },
    set(nextState) {
      return state({ ...nextState });
    },
    patch(partialState) {
      return state((currentState) => ({
        ...currentState,
        ...partialState,
      }));
    },
    update(updater) {
      return state((currentState) => ({
        ...currentState,
        ...updater(currentState),
      }));
    },
    subscribe(listener) {
      return state.subscribe(listener);
    },
  });
}
