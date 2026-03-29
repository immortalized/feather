function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isThemeReference(value) {
  return (typeof value === 'string' && value.startsWith('$'))
    || (isObject(value) && typeof value.$token === 'string');
}

function isThemePropsObject(value) {
  return isObject(value) && ('className' in value || 'style' in value);
}

function normalizeClassValue(value) {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap(normalizeClassValue);
  }

  if (isObject(value)) {
    if (isThemePropsObject(value)) {
      return normalizeClassValue(value.className);
    }

    return Object.entries(value)
      .filter(([, enabled]) => typeof enabled !== 'function' && typeof enabled !== 'object' && Boolean(enabled))
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

function createThemeCycleMessage(path) {
  return `Feather: Circular theme token reference detected while resolving "${path}".`;
}

function resolveThemeReference(value, stack) {
  const path = typeof value === 'string' ? value.slice(1) : value.$token;
  if (!path) {
    return undefined;
  }

  if (stack.includes(path)) {
    throw new Error(createThemeCycleMessage(path));
  }

  return resolveThemeValue(getPathValue(activeTheme, path), [...stack, path]);
}

function resolveThemeValue(value, stack = []) {
  if (isThemeReference(value)) {
    return resolveThemeReference(value, stack);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => resolveThemeValue(entry, stack));
  }

  if (!isObject(value)) {
    return value;
  }

  if (isThemePropsObject(value)) {
    const resolved = {};
    const className = resolveThemeValue(value.className, stack);
    const style = resolveThemeValue(value.style, stack);

    if (className) {
      resolved.className = cx(className);
    }

    if (isObject(style) && Object.keys(style).length > 0) {
      resolved.style = style;
    }

    return resolved;
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [key, resolveThemeValue(entryValue, stack)]),
  );
}

function normalizeThemePropsEntry(entry) {
  const resolvedEntry = resolveThemeValue(entry);
  if (!resolvedEntry) {
    return null;
  }

  if (typeof resolvedEntry === 'string' || Array.isArray(resolvedEntry)) {
    const className = cx(resolvedEntry);
    return className ? { className } : null;
  }

  if (!isObject(resolvedEntry)) {
    return null;
  }

  if (isThemePropsObject(resolvedEntry)) {
    const nextProps = {};

    if (resolvedEntry.className) {
      const className = cx(resolvedEntry.className);
      if (className) {
        nextProps.className = className;
      }
    }

    if (isObject(resolvedEntry.style) && Object.keys(resolvedEntry.style).length > 0) {
      nextProps.style = resolvedEntry.style;
    }

    return Object.keys(nextProps).length > 0 ? nextProps : null;
  }

  return Object.keys(resolvedEntry).length > 0 ? { style: resolvedEntry } : null;
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
  const value = getPathValue(activeTheme, path);
  return resolveThemeValue(value === undefined ? fallback : value, [String(path)]);
}

export function resolveToken(group, value, fallback = '') {
  return token(`${group}.${value}`, fallback);
}

export function resolveThemeProps(...entries) {
  const classNames = [];
  const styles = [];

  entries
    .filter((entry) => entry !== null && entry !== undefined && entry !== false)
    .forEach((entry) => {
      const resolvedEntry = normalizeThemePropsEntry(entry);
      if (!resolvedEntry) {
        return;
      }

      if (resolvedEntry.className) {
        classNames.push(resolvedEntry.className);
      }

      if (resolvedEntry.style) {
        styles.push(resolvedEntry.style);
      }
    });

  if (classNames.length === 0 && styles.length === 0) {
    return null;
  }

  const nextProps = {};

  if (classNames.length > 0) {
    const className = cx(classNames);
    if (className) {
      nextProps.className = className;
    }
  }

  if (styles.length > 0) {
    nextProps.style = Object.assign({}, ...styles);
  }

  return Object.keys(nextProps).length > 0 ? nextProps : null;
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
