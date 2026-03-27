import { isReactive, read } from './state.js';

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeClassValue(value) {
  if (!value) return [];

  if (isReactive(value)) {
    return normalizeClassValue(read(value));
  }

  if (Array.isArray(value)) {
    return value.flatMap(normalizeClassValue);
  }

  if (isObject(value)) {
    return Object.entries(value)
      .filter(([, enabled]) => Boolean(read(enabled)))
      .map(([className]) => className);
  }

  return String(value)
    .split(/\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function deepMerge(baseValue, nextValue) {
  if (!isObject(baseValue) || !isObject(nextValue)) {
    return nextValue === undefined ? baseValue : nextValue;
  }

  const merged = { ...baseValue };

  Object.entries(nextValue).forEach(([key, value]) => {
    merged[key] = deepMerge(baseValue[key], value);
  });

  return merged;
}

function getPathValue(source, path) {
  return String(path)
    .split('.')
    .filter(Boolean)
    .reduce((value, key) => (value == null ? undefined : value[key]), source);
}

function resolveVariantEntry(entry, value, options) {
  if (typeof entry === 'function') {
    return entry(value, options);
  }

  if (!isObject(entry)) {
    return entry;
  }

  const resolved = entry[value] ?? entry[String(value)];
  if (resolved === undefined) {
    return '';
  }

  return resolveVariantEntry(resolved, value, options);
}

const DEFAULT_THEME = {
  background: {
    app: 'bg-slate-50',
    surface: 'bg-white',
    muted: 'bg-slate-100',
    accent: 'bg-slate-950',
    inverse: 'bg-slate-950',
  },
  text: {
    base: 'text-slate-950',
    muted: 'text-slate-500',
    accent: 'text-sky-700',
    inverse: 'text-white',
    danger: 'text-rose-700',
    success: 'text-emerald-700',
  },
  border: {
    base: 'border-slate-200',
    muted: 'border-slate-300',
    accent: 'border-slate-950',
    danger: 'border-rose-200',
    success: 'border-emerald-200',
  },
  surface: {
    screen: 'w-full min-h-screen',
    card: 'rounded-2xl border',
    panel: 'rounded-2xl border',
    navbar: 'w-full border-b backdrop-blur',
    alert: 'rounded-xl border px-4 py-3',
  },
  button: {
    base: 'inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition-colors duration-200 ease-out',
    variant: {
      primary: 'border-slate-950 bg-slate-950 text-white hover:bg-slate-800',
      secondary: 'border-slate-200 bg-slate-100 text-slate-950 hover:bg-slate-200',
      outline: 'border-slate-300 bg-white text-slate-950 hover:bg-slate-50',
      ghost: 'border-transparent bg-transparent text-slate-700 hover:bg-slate-100',
    },
    size: {
      sm: 'h-9 px-3 text-sm',
      md: 'h-10 px-4 text-sm',
      lg: 'h-11 px-5 text-base',
    },
    block: 'w-full',
    loading: 'pointer-events-none opacity-70',
  },
  input: {
    base: 'h-10 w-full rounded-xl border border-slate-300 bg-white px-3 text-slate-950 shadow-sm outline-none transition-colors duration-200 ease-out placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-200',
  },
  link: {
    base: 'text-slate-950 underline-offset-4 transition-colors duration-200 ease-out hover:text-slate-700',
  },
  alert: {
    variant: {
      info: 'border-sky-200 bg-sky-50 text-sky-800',
      success: 'border-emerald-200 bg-emerald-50 text-emerald-800',
      error: 'border-rose-200 bg-rose-50 text-rose-800',
    },
  },
  animation: {
    enter: 'feather-animate-enter',
    fade: 'feather-animate-fade',
    rise: 'feather-animate-rise',
    pulse: 'animate-pulse',
    ping: 'animate-ping',
    spin: 'animate-spin',
    bounce: 'animate-bounce',
  },
};

let activeTheme = DEFAULT_THEME;

export function cx(...values) {
  return normalizeClassValue(values).join(' ').trim();
}

export function defineTheme(overrides = {}) {
  return deepMerge(DEFAULT_THEME, overrides);
}

export function setTheme(overrides = {}) {
  activeTheme = defineTheme(overrides);
  return activeTheme;
}

export function getTheme() {
  return activeTheme;
}

export function token(path, fallback = '') {
  return cx(getPathValue(activeTheme, path) ?? fallback);
}

export function resolveToken(group, value, fallback = '') {
  return token(`${group}.${value}`, fallback);
}

export function defineVariants({
  base = '',
  variants = {},
  defaults = {},
} = {}) {
  return function resolveVariants(options = {}) {
    const resolvedOptions = { ...defaults, ...options };
    const classNames = [
      typeof base === 'function' ? base(resolvedOptions) : base,
    ];

    Object.entries(variants).forEach(([name, entry]) => {
      const value = resolvedOptions[name];
      if (value === null || value === undefined || value === false) return;
      classNames.push(resolveVariantEntry(entry, value, resolvedOptions));
    });

    classNames.push(resolvedOptions.class, resolvedOptions.className);
    return cx(classNames);
  };
}
