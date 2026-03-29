import { beginReactiveCreationPhase, effect, endReactiveCreationPhase, isReactive, read, untrack } from './state.js';
import { getInternalFeatherConfig } from './config.js';
import { cx, resolveThemeProps, token } from './theme.js';

const FRAGMENT = Symbol('feather.fragment');
const FEATHER_RUNTIME_STYLE_ID = 'feather-runtime-styles';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const bindingWarnings = new Set();
const DIRECT_REACTIVE_VALUE_WARNING = 'Feather: Reactive values must be wrapped in a function (() => value).';
const DIRECT_REACTIVE_CHILD_WARNING = 'Feather: Pass reactive children as functions. Use Box(() => count.get()) instead of passing the reactive value directly.';
const SVG_TAGS = new Set([
  'svg',
  'path',
  'g',
  'circle',
  'rect',
  'line',
  'polyline',
  'polygon',
  'ellipse',
  'defs',
  'clipPath',
  'mask',
  'linearGradient',
  'radialGradient',
  'stop',
  'use',
  'symbol',
]);

function ensureRuntimeStyles() {
  if (typeof document === 'undefined') return;
  if (document.getElementById(FEATHER_RUNTIME_STYLE_ID)) return;

  const style = document.createElement('style');
  style.id = FEATHER_RUNTIME_STYLE_ID;
  style.textContent = `
    .feather-vstack{display:flex;flex-direction:column}
    .feather-hstack{display:flex;flex-direction:row}
    .feather-zstack{display:grid}
    .feather-zstack>*{grid-area:1/1}
    .feather-spacer{flex:1 1 auto}
    .feather-field{display:flex;flex-direction:column;gap:.5rem}
    .feather-field-control{position:relative}
    .feather-field-error{font-size:.875rem;line-height:1.25rem;color:#b91c1c}
    .feather-field-hint{font-size:.875rem;line-height:1.25rem;color:#64748b}
    .feather-checkbox-field{display:flex;flex-direction:column;gap:.5rem}
    .feather-animate-enter{animation:feather-enter .22s cubic-bezier(.22,1,.36,1)}
    .feather-animate-fade{animation:feather-fade .18s ease-out}
    .feather-animate-rise{animation:feather-rise .2s cubic-bezier(.22,1,.36,1)}
    @keyframes feather-enter{from{opacity:0;transform:translateY(10px) scale(.985)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes feather-fade{from{opacity:0}to{opacity:1}}
    @keyframes feather-rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
  `;

  document.head.appendChild(style);
}

function isDomNode(value) {
  return typeof Node !== 'undefined' && value instanceof Node;
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return false;
  if (isDomNode(value)) return false;
  if (value.__feather === true) return false;
  return Object.getPrototypeOf(value) === Object.prototype;
}

function isViewNode(value) {
  return Boolean(value) && typeof value === 'object' && value.__feather === true;
}

function isFormObject(value) {
  return Boolean(value) && typeof value === 'object' && value.__featherForm === true;
}

function flattenValue(value) {
  if (Array.isArray(value)) {
    return value.map(flattenValue).join('');
  }

  if (value === null || value === undefined || value === false) {
    return '';
  }

  if (isReactive(value)) {
    warnBinding(DIRECT_REACTIVE_VALUE_WARNING);
    return '';
  }

  return String(value);
}

function normalizeChildren(children) {
  const normalized = [];

  children.forEach((child) => {
    if (Array.isArray(child)) {
      normalized.push(...normalizeChildren(child));
      return;
    }

    if (child === null || child === undefined || child === false) {
      return;
    }

    normalized.push(child);
  });

  return normalized;
}

function parseArguments(args) {
  if (args.length === 0) {
    return { props: {}, children: [] };
  }

  const [first, ...rest] = args;
  if (isPlainObject(first)) {
    return {
      props: { ...first },
      children: normalizeChildren(rest),
    };
  }

  return {
    props: {},
    children: normalizeChildren(args),
  };
}

function composeHandlers(...handlers) {
  return function composedHandler(event, ...rest) {
    handlers.filter((handler) => typeof handler === 'function').forEach((handler) => {
      handler(event, ...rest);
    });
  };
}

function warnBinding(message) {
  const config = getInternalFeatherConfig();

  // Strict mode enforces rules with errors.
  if (config.strictBindings) {
    throw new Error(message);
  }

  // Dev mode enables warnings and guidance.
  if (!config.dev) {
    return;
  }

  if (bindingWarnings.has(message)) {
    return;
  }

  bindingWarnings.add(message);
  console.warn(message);
}

function warnReactiveValueOutsideFunction(value, message = DIRECT_REACTIVE_VALUE_WARNING) {
  if (typeof value === 'function') {
    return false;
  }

  if (isReactive(value)) {
    warnBinding(message);
    return true;
  }

  if (Array.isArray(value) && value.some((entry) => isReactive(entry))) {
    warnBinding(message);
    return true;
  }

  if (isPlainObject(value) && Object.values(value).some((entry) => isReactive(entry))) {
    warnBinding(message);
    return true;
  }

  return false;
}

function getBindingTargetName(key) {
  if (key === 'class') {
    return 'className';
  }

  return key;
}

function applyBinding(value, apply) {
  if (typeof value === 'function') {
    return effect(() => apply(value()));
  }

  return apply(value);
}

function resolveFieldBindings(props = {}) {
  const { field, onInput, onChange, type, checked, value, ...rest } = props;

  if (!field) {
    return mergeProps(rest, {
      type: type === undefined ? (typeof type === 'function' ? type() : type) : type,
      checked,
      value,
      onInput,
      onChange,
    });
  }

  const currentType = typeof type === 'function' ? type() : type;
  const nextType = type === undefined ? currentType : type;
  const isCheckboxLike = currentType === 'checkbox' || currentType === 'radio';
  const invalidAttrs = field?.invalid
    ? () => ({ 'aria-invalid': field.invalid.get() })
    : null;

  if (isCheckboxLike) {
    return mergeProps(rest, {
      type: nextType,
      checked: () => field.value.get(),
      onChange: composeHandlers((event) => {
        field.set(Boolean(event.target.checked));

        field.touch?.();
      }, onChange),
      attrs: invalidAttrs,
    });
  }

  return mergeProps(rest, {
    type: nextType,
    value: () => field.value.get(),
    onInput: composeHandlers((event) => {
      field.set(event.target.value);
      field.touch?.();
    }, onInput),
    onChange,
    attrs: invalidAttrs,
  });
}

function resolveFormProps(props = {}) {
  const { form, onSubmit, ...rest } = props;

  if (!form) {
    return props;
  }

  return mergeProps(rest, {
    onSubmit: composeHandlers((event) => {
      form.submit(event);
    }, onSubmit),
    attrs: {
      novalidate: true,
    },
  });
}

function createMemoizedResolver(resolve) {
  let initialized = false;
  let previousValue;
  let previousResult;

  return (value) => {
    if (initialized && Object.is(previousValue, value)) {
      return previousResult;
    }

    initialized = true;
    previousValue = value;
    previousResult = resolve(value);
    return previousResult;
  };
}

function resolveSemanticThemeProps(group, value, fallbackPrefix) {
  const resolveSemanticValue = createMemoizedResolver((resolvedValue) => {
    const themeProps = resolveThemeProps(token(`${group}.${resolvedValue}`));
    if (themeProps) {
      return themeProps;
    }

    if (!fallbackPrefix || resolvedValue === null || resolvedValue === undefined || resolvedValue === false) {
      return {};
    }

    return { className: `${fallbackPrefix}-${resolvedValue}` };
  });

  if (typeof value !== 'function') {
    return resolveSemanticValue(value);
  }

  return {
    className: () => resolveSemanticValue(value()).className,
    style: () => resolveSemanticValue(value()).style,
  };
}

function resolveTailwindSize(prefix, value) {
  if (value === 'fill' || value === 'full') return `${prefix}-full`;
  if (value === 'screen') return `${prefix}-screen`;
  if (value === 'fit') return `${prefix}-fit`;
  if (value === 'min') return `${prefix}-min`;
  if (value === 'max') return `${prefix}-max`;
  if (value === 'auto') return `${prefix}-auto`;
  return `${prefix}-${value}`;
}

function resolveTailwindSpace(prefix, value) {
  return `${prefix}-${value}`;
}

function resolveJustifyClass(value) {
  const map = {
    start: 'justify-start',
    center: 'justify-center',
    end: 'justify-end',
    between: 'justify-between',
    around: 'justify-around',
    evenly: 'justify-evenly',
  };

  return map[value] || `justify-${value}`;
}

function resolveAlignClass(value) {
  const map = {
    start: 'items-start',
    center: 'items-center',
    end: 'items-end',
    stretch: 'items-stretch',
    baseline: 'items-baseline',
  };

  return map[value] || `items-${value}`;
}

function resolveAnimateClass(value = 'pulse') {
  const resolveAnimation = createMemoizedResolver((resolvedValue) => {
    const themeProps = resolveThemeProps(token(`animation.${resolvedValue}`));
    if (themeProps) {
      return themeProps;
    }

    if (String(resolvedValue).startsWith('animate-')) {
      return { className: String(resolvedValue) };
    }

    return { className: `animate-${resolvedValue}` };
  });

  if (typeof value !== 'function') {
    return resolveAnimation(value);
  }

  return {
    className: () => resolveAnimation(value()).className,
    style: () => resolveAnimation(value()).style,
  };
}

function runCleanups(cleanups) {
  while (cleanups.length > 0) {
    const cleanup = cleanups.pop();

    try {
      cleanup();
    } catch {
      // Best effort cleanup keeps navigation resilient.
    }
  }
}

function resolveTarget(target, container) {
  if (!target) return null;
  if (typeof target === 'string') {
    return container.querySelector(target) || document.querySelector(target);
  }

  return target;
}

function createNode(type, props = {}, children = [], meta = null) {
  return withModifiers({
    __feather: true,
    nodeType: type,
    nodeProps: props,
    children,
    meta,
  });
}

function scheduleFrame(callback) {
  if (typeof requestAnimationFrame === 'function') {
    return requestAnimationFrame(callback);
  }

  return setTimeout(() => callback(Date.now()), 16);
}

function cancelFrame(handle) {
  if (typeof cancelAnimationFrame === 'function') {
    cancelAnimationFrame(handle);
    return;
  }

  clearTimeout(handle);
}

function cloneMeta(meta, overrides = {}) {
  if (!meta && !overrides) {
    return null;
  }

  return {
    ...(meta || {}),
    ...(overrides || {}),
    state: {
      ...(meta?.state || {}),
      ...(overrides.state || {}),
    },
    modifiers: overrides.modifiers || meta?.modifiers,
    resolveClassName: overrides.resolveClassName || meta?.resolveClassName,
    resolveProps: overrides.resolveProps || meta?.resolveProps,
    prepareProps: overrides.prepareProps || meta?.prepareProps,
  };
}

function cloneNode(node, overrides = {}) {
  return withModifiers({
    ...node,
    nodeType: overrides.nodeType || node.nodeType,
    nodeProps: mergeProps(node.nodeProps, overrides.props || {}),
    children: overrides.children || node.children,
    meta: cloneMeta(node.meta, overrides.meta),
  });
}

function addClass(node, nextClassName) {
  return cloneNode(node, {
    props: {
      className: nextClassName,
    },
  });
}

function addStyles(node, nextStyles) {
  return cloneNode(node, {
    props: {
      style: nextStyles,
    },
  });
}

function addStyleEntries(node, nextStyles) {
  return cloneNode(node, {
    props: {
      style: mergeProps(
        node.nodeProps?.style ? { style: node.nodeProps.style } : null,
        { style: nextStyles },
      ).style,
    },
  });
}

function isPlainStyleObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function assignDirectionalStyles(property, key, value, styles) {
  const normalizedKey = String(key).toLowerCase();

  if (normalizedKey === 'x' || normalizedKey === 'horizontal' || normalizedKey === 'inline') {
    styles[`${property}Left`] = value;
    styles[`${property}Right`] = value;
    return;
  }

  if (normalizedKey === 'y' || normalizedKey === 'vertical' || normalizedKey === 'block') {
    styles[`${property}Top`] = value;
    styles[`${property}Bottom`] = value;
    return;
  }

  const aliases = {
    top: 'Top',
    right: 'Right',
    bottom: 'Bottom',
    left: 'Left',
    topleft: 'TopLeft',
    topright: 'TopRight',
    bottomleft: 'BottomLeft',
    bottomright: 'BottomRight',
    start: 'InlineStart',
    end: 'InlineEnd',
  };

  const suffix = aliases[normalizedKey] || `${String(key).charAt(0).toUpperCase()}${String(key).slice(1)}`;
  styles[`${property}${suffix}`] = value;
}

function resolveBoxModelStyles(property, args) {
  if (args.length === 0) {
    return {};
  }

  if (args.length === 1) {
    const [value] = args;

    if (typeof value === 'function') {
      return () => {
        const resolvedValue = value();
        if (isPlainStyleObject(resolvedValue)) {
          const styles = {};
          Object.entries(resolvedValue).forEach(([key, entryValue]) => {
            assignDirectionalStyles(property, key, entryValue, styles);
          });
          return styles;
        }

        return { [property]: resolvedValue };
      };
    }

    if (isPlainStyleObject(value)) {
      const styles = {};
      Object.entries(value).forEach(([key, entryValue]) => {
        assignDirectionalStyles(property, key, entryValue, styles);
      });
      return styles;
    }

    return { [property]: value };
  }

  if (typeof args[0] === 'string') {
    const [key, value] = args;
    if (typeof value === 'function') {
      return () => {
        const resolvedValue = value();
        const styles = {};
        assignDirectionalStyles(property, key, resolvedValue, styles);
        return styles;
      };
    }

    const styles = {};
    assignDirectionalStyles(property, key, value, styles);
    return styles;
  }

  if (args.some((value) => typeof value === 'function')) {
    return () => {
      const styles = {};
      styles[property] = args.map((value) => (typeof value === 'function' ? value() : value)).join(' ');
      return styles;
    };
  }

  return { [property]: args.join(' ') };
}

function resolveShadowValue(args) {
  if (args.length === 0) {
    return null;
  }

  if (args.length === 1) {
    const [value] = args;

    if (typeof value === 'function') {
      return () => {
        const resolvedValue = value();
        if (!isPlainStyleObject(resolvedValue)) {
          return resolvedValue;
        }

        const {
          inset = false,
          x = 0,
          y = 0,
          blur = 0,
          spread = 0,
          color = 'currentColor',
        } = resolvedValue;

        return `${inset ? 'inset ' : ''}${x} ${y} ${blur} ${spread} ${color}`.trim();
      };
    }

    if (isPlainStyleObject(value)) {
      const {
        inset = false,
        x = 0,
        y = 0,
        blur = 0,
        spread = 0,
        color = 'currentColor',
      } = value;

      return `${inset ? 'inset ' : ''}${x} ${y} ${blur} ${spread} ${color}`.trim();
    }

    return value;
  }

  if (args.some((value) => typeof value === 'function')) {
    return () => args.map((value) => (typeof value === 'function' ? value() : value)).join(' ');
  }

  return args.join(' ');
}

function addAttributes(node, nextAttributes) {
  return cloneNode(node, {
    props: {
      attrs: nextAttributes,
    },
  });
}

function setDatasetEntry(node, key, value) {
  return cloneNode(node, {
    props: {
      dataset: typeof value === 'function'
        ? () => ({ [key]: value() })
        : { [key]: value },
    },
  });
}

function addEventHandler(node, eventName, handler) {
  const propName = `on${String(eventName).charAt(0).toUpperCase()}${String(eventName).slice(1)}`;
  return cloneNode(node, {
    props: {
      [propName]: composeHandlers(node.nodeProps?.[propName], handler),
    },
  });
}

function setNodeProp(node, key, value) {
  return cloneNode(node, {
    props: {
      [key]: value,
    },
  });
}

function setNodeProps(node, nextProps) {
  return cloneNode(node, {
    props: nextProps,
  });
}

function addThemedProps(node, themedProps) {
  return cloneNode(node, {
    props: themedProps,
  });
}

function addModifierMethod(node, name, implementation) {
  Object.defineProperty(node, name, {
    value: implementation,
    enumerable: false,
    configurable: false,
    writable: false,
  });
}

function applyPrimitiveModifier(node, name, value) {
  const modifier = node.meta?.modifiers?.[name];
  if (typeof modifier === 'function') {
    return modifier(node, value);
  }

  return node;
}

function updateNodeState(node, nextState) {
  return cloneNode(node, {
    meta: {
      state: nextState,
    },
  });
}

export function setPrimitiveState(node, nextState) {
  return updateNodeState(node, nextState);
}

function withModifiers(node) {
  addModifierMethod(node, 'prop', (key, value) => setNodeProp(node, key, value));
  addModifierMethod(node, 'props', (value) => setNodeProps(node, value));
  addModifierMethod(node, 'with', (value) => {
    if (typeof value === 'function') {
      return value(node);
    }

    if (value && typeof value === 'object') {
      return setNodeProps(node, value);
    }

    return node;
  });
  addModifierMethod(node, 'when', (condition, applyWhenTrue) => ((typeof condition === 'function' ? condition() : condition)
    ? (typeof applyWhenTrue === 'function' ? applyWhenTrue(node) : node)
    : node));
  addModifierMethod(node, 'if', (condition, truthyValue, falsyValue = null) => {
    if (typeof condition === 'function' ? condition() : condition) {
      return typeof truthyValue === 'function' ? truthyValue(node) : truthyValue || node;
    }

    return typeof falsyValue === 'function' ? falsyValue(node) : (falsyValue || node);
  });
  addModifierMethod(node, 'as', (value) => withModifiers({
    ...cloneNode(node),
    nodeType: (typeof value === 'function' ? value() : value) || node.nodeType,
  }));
  addModifierMethod(node, 'aria', (key, value = true) => addAttributes(node, typeof value === 'function'
    ? () => ({ [`aria-${String(key).replace(/^aria-/, '')}`]: value() })
    : { [`aria-${String(key).replace(/^aria-/, '')}`]: value }));
  addModifierMethod(node, 'ariaInvalid', (value = true) => node.aria('invalid', value));
  addModifierMethod(node, 'ariaLabel', (value) => node.aria('label', value));
  addModifierMethod(node, 'ariaLabelledBy', (value) => node.aria('labelledby', value));
  addModifierMethod(node, 'ariaDescribedBy', (value) => node.aria('describedby', value));
  addModifierMethod(node, 'ariaHidden', (value = true) => node.aria('hidden', value));
  addModifierMethod(node, 'className', (value) => addClass(node, value));
  addModifierMethod(node, 'class', (value) => addClass(node, value));
  addModifierMethod(node, 'toggleClass', (name, condition = true) => addClass(node, typeof condition === 'function'
    ? () => ({ [name]: condition() })
    : { [name]: condition }));
  addModifierMethod(node, 'tw', (...values) => addClass(node, values.filter(Boolean).join(' ')));
  addModifierMethod(node, 'style', (value) => addStyles(node, value));
  addModifierMethod(node, 'padding', (...args) => addStyleEntries(node, resolveBoxModelStyles('padding', args)));
  addModifierMethod(node, 'paddingRight', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ paddingRight: value() }) : { paddingRight: value }));
  addModifierMethod(node, 'paddingLeft', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ paddingLeft: value() }) : { paddingLeft: value }));
  addModifierMethod(node, 'paddingTop', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ paddingTop: value() }) : { paddingTop: value }));
  addModifierMethod(node, 'paddingBottom', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ paddingBottom: value() }) : { paddingBottom: value }));
  addModifierMethod(node, 'margin', (...args) => addStyleEntries(node, resolveBoxModelStyles('margin', args)));
  addModifierMethod(node, 'gap', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ gap: value() }) : { gap: value }));
  addModifierMethod(node, 'rowGap', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ rowGap: value() }) : { rowGap: value }));
  addModifierMethod(node, 'columnGap', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ columnGap: value() }) : { columnGap: value }));
  addModifierMethod(node, 'textAlign', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ textAlign: value() }) : { textAlign: value }));
  addModifierMethod(node, 'justifyContent', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ justifyContent: value() }) : { justifyContent: value }));
  addModifierMethod(node, 'alignItems', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ alignItems: value() }) : { alignItems: value }));
  addModifierMethod(node, 'alignSelf', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ alignSelf: value() }) : { alignSelf: value }));
  addModifierMethod(node, 'placeItems', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ placeItems: value() }) : { placeItems: value }));
  addModifierMethod(node, 'display', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ display: value() }) : { display: value }));
  addModifierMethod(node, 'position', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ position: value() }) : { position: value }));
  addModifierMethod(node, 'top', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ top: value() }) : { top: value }));
  addModifierMethod(node, 'right', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ right: value() }) : { right: value }));
  addModifierMethod(node, 'bottom', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ bottom: value() }) : { bottom: value }));
  addModifierMethod(node, 'left', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ left: value() }) : { left: value }));
  addModifierMethod(node, 'inset', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ inset: value() }) : { inset: value }));
  addModifierMethod(node, 'overflow', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ overflow: value() }) : { overflow: value }));
  addModifierMethod(node, 'overflowX', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ overflowX: value() }) : { overflowX: value }));
  addModifierMethod(node, 'overflowY', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ overflowY: value() }) : { overflowY: value }));
  addModifierMethod(node, 'opacity', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ opacity: value() }) : { opacity: value }));
  addModifierMethod(node, 'fontSize', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ fontSize: value() }) : { fontSize: value }));
  addModifierMethod(node, 'fontWeight', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ fontWeight: value() }) : { fontWeight: value }));
  addModifierMethod(node, 'lineHeight', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ lineHeight: value() }) : { lineHeight: value }));
  addModifierMethod(node, 'letterSpacing', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ letterSpacing: value() }) : { letterSpacing: value }));
  addModifierMethod(node, 'color', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ color: value() }) : { color: value }));
  addModifierMethod(node, 'backgroundColor', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ backgroundColor: value() }) : { backgroundColor: value }));
  addModifierMethod(node, 'borderRadius', (...args) => addStyleEntries(node, resolveBoxModelStyles('borderRadius', args)));
  addModifierMethod(node, 'borderColor', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ borderColor: value() }) : { borderColor: value }));
  addModifierMethod(node, 'borderWidth', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ borderWidth: value() }) : { borderWidth: value }));
  addModifierMethod(node, 'boxShadow', (...args) => {
    const shadowValue = resolveShadowValue(args);
    return addStyleEntries(node, typeof shadowValue === 'function'
      ? () => ({ boxShadow: shadowValue() })
      : { boxShadow: shadowValue });
  });
  addModifierMethod(node, 'shadow', (...args) => {
    const shadowValue = resolveShadowValue(args);
    return addStyleEntries(node, typeof shadowValue === 'function'
      ? () => ({ boxShadow: shadowValue() })
      : { boxShadow: shadowValue });
  });
  addModifierMethod(node, 'transform', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ transform: value() }) : { transform: value }));
  addModifierMethod(node, 'transition', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ transition: value() }) : { transition: value }));
  addModifierMethod(node, 'pointerEvents', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ pointerEvents: value() }) : { pointerEvents: value }));
  addModifierMethod(node, 'cursor', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ cursor: value() }) : { cursor: value }));
  addModifierMethod(node, 'id', (value) => setNodeProp(node, 'id', value));
  addModifierMethod(node, 'name', (value) => setNodeProp(node, 'name', value));
  addModifierMethod(node, 'type', (value) => setNodeProp(node, 'type', value));
  addModifierMethod(node, 'value', (value) => setNodeProp(node, 'value', value));
  addModifierMethod(node, 'checked', (value = true) => setNodeProp(node, 'checked', value));
  addModifierMethod(node, 'placeholder', (value) => setNodeProp(node, 'placeholder', value));
  addModifierMethod(node, 'autocomplete', (value) => setNodeProp(node, 'autocomplete', value));
  addModifierMethod(node, 'field', (value) => setNodeProp(node, 'field', value));
  addModifierMethod(node, 'form', (value) => setNodeProp(node, 'form', value));
  addModifierMethod(node, 'href', (value) => setNodeProp(node, 'href', value));
  addModifierMethod(node, 'src', (value) => setNodeProp(node, 'src', value));
  addModifierMethod(node, 'alt', (value) => setNodeProp(node, 'alt', value));
  addModifierMethod(node, 'text', (value) => setNodeProp(node, 'text', value));
  addModifierMethod(node, 'html', (value) => setNodeProp(node, 'html', value));
  addModifierMethod(node, 'ref', (value) => setNodeProp(node, 'ref', value));
  addModifierMethod(node, 'routerLink', (value = true) => setNodeProp(node, 'routerLink', value));
  addModifierMethod(node, 'attr', (key, value) => addAttributes(node, typeof value === 'function'
    ? () => ({ [key]: value() })
    : { [key]: value }));
  addModifierMethod(node, 'attrs', (value) => addAttributes(node, value));
  addModifierMethod(node, 'data', (key, value) => setDatasetEntry(node, key, value));
  addModifierMethod(node, 'slot', (name, child = null) => {
    if (child && child.__feather === true) {
      return cloneNode(node, {
        children: [...node.children, child.attr('slot', name)],
      });
    }

    return node.attr('slot', name);
  });
  addModifierMethod(node, 'on', (eventName, handler) => addEventHandler(node, eventName, handler));
  addModifierMethod(node, 'onClick', (handler) => node.on('click', handler));
  addModifierMethod(node, 'onInput', (handler) => node.on('input', handler));
  addModifierMethod(node, 'onChange', (handler) => node.on('change', handler));
  addModifierMethod(node, 'onSubmit', (handler) => node.on('submit', handler));
  addModifierMethod(node, 'onEnter', (handler) => node.on('keydown', (event) => {
    if (event.key === 'Enter') {
      handler(event);
    }
  }));
  addModifierMethod(node, 'onEscape', (handler) => node.on('keydown', (event) => {
    if (event.key === 'Escape') {
      handler(event);
    }
  }));
  addModifierMethod(node, 'variant', (value) => applyPrimitiveModifier(node, 'variant', value));
  addModifierMethod(node, 'tone', (value) => applyPrimitiveModifier(node, 'tone', value));
  addModifierMethod(node, 'size', (value) => applyPrimitiveModifier(node, 'size', value));
  addModifierMethod(node, 'block', (value = true) => applyPrimitiveModifier(node, 'block', value));
  addModifierMethod(node, 'loading', (value = true) => applyPrimitiveModifier(node, 'loading', value));
  addModifierMethod(node, 'to', (value) => applyPrimitiveModifier(node, 'to', value));
  addModifierMethod(node, 'disabled', (value = true) => cloneNode(node, { props: { disabled: value } }));
  addModifierMethod(node, 'disabledWhen', (value = true) => node.disabled(value));
  addModifierMethod(node, 'submit', () => cloneNode(node, { props: { type: 'submit' } }));

  addModifierMethod(node, 'width', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ width: value() }) : { width: value }));
  addModifierMethod(node, 'height', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ height: value() }) : { height: value }));
  addModifierMethod(node, 'minWidth', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ minWidth: value() }) : { minWidth: value }));
  addModifierMethod(node, 'minHeight', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ minHeight: value() }) : { minHeight: value }));
  addModifierMethod(node, 'maxWidth', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ maxWidth: value() }) : { maxWidth: value }));
  addModifierMethod(node, 'maxHeight', (value) => addStyleEntries(node, typeof value === 'function' ? () => ({ maxHeight: value() }) : { maxHeight: value }));
  addModifierMethod(node, 'widthClass', (value) => addClass(node, (typeof value === 'function') ? () => resolveTailwindSize('w', value()) : resolveTailwindSize('w', value)));
  addModifierMethod(node, 'heightClass', (value) => addClass(node, (typeof value === 'function') ? () => resolveTailwindSize('h', value()) : resolveTailwindSize('h', value)));
  addModifierMethod(node, 'minWidthClass', (value) => addClass(node, (typeof value === 'function') ? () => resolveTailwindSize('min-w', value()) : resolveTailwindSize('min-w', value)));
  addModifierMethod(node, 'minHeightClass', (value) => addClass(node, (typeof value === 'function') ? () => resolveTailwindSize('min-h', value()) : resolveTailwindSize('min-h', value)));
  addModifierMethod(node, 'maxWidthClass', (value) => addClass(node, (typeof value === 'function') ? () => resolveTailwindSize('max-w', value()) : resolveTailwindSize('max-w', value)));
  addModifierMethod(node, 'maxHeightClass', (value) => addClass(node, (typeof value === 'function') ? () => resolveTailwindSize('max-h', value()) : resolveTailwindSize('max-h', value)));
  addModifierMethod(node, 'rounded', (value = 'md') => addClass(node, (typeof value === 'function') ? () => (value() === 'none' ? 'rounded-none' : `rounded-${value()}`) : (value === 'none' ? 'rounded-none' : `rounded-${value}`)));
  addModifierMethod(node, 'background', (value) => addThemedProps(node, resolveSemanticThemeProps('background', value, 'bg')));
  addModifierMethod(node, 'textColor', (value) => addThemedProps(node, resolveSemanticThemeProps('text', value, 'text')));
  addModifierMethod(node, 'border', (value = true) => addClass(node, (typeof value === 'function') ? () => (value() === true ? 'border' : `border-${value()}`) : (value === true ? 'border' : `border-${value}`)));
  addModifierMethod(node, 'borderColorClass', (value) => addThemedProps(node, resolveSemanticThemeProps('border', value, 'border')));
  addModifierMethod(node, 'opacityClass', (value) => addClass(node, (typeof value === 'function') ? () => `opacity-${value()}` : `opacity-${value}`));
  addModifierMethod(node, 'displayClass', (value) => addClass(node, (typeof value === 'function') ? () => String(value()) : String(value)));
  addModifierMethod(node, 'font', (value) => addClass(node, (typeof value === 'function') ? () => `font-${value()}` : `font-${value}`));
  addModifierMethod(node, 'textSize', (value) => addClass(node, (typeof value === 'function') ? () => `text-${value()}` : `text-${value}`));
  addModifierMethod(node, 'leading', (value) => addClass(node, (typeof value === 'function') ? () => `leading-${value()}` : `leading-${value}`));
  addModifierMethod(node, 'tracking', (value) => addClass(node, (typeof value === 'function') ? () => `tracking-${value()}` : `tracking-${value}`));
  addModifierMethod(node, 'justify', (value) => addClass(node, (typeof value === 'function') ? () => resolveJustifyClass(value()) : resolveJustifyClass(value)));
  addModifierMethod(node, 'align', (value) => addClass(node, (typeof value === 'function') ? () => resolveAlignClass(value()) : resolveAlignClass(value)));
  addModifierMethod(node, 'items', (value) => addClass(node, (typeof value === 'function') ? () => `items-${value()}` : `items-${value}`));
  addModifierMethod(node, 'self', (value) => addClass(node, (typeof value === 'function') ? () => `self-${value()}` : `self-${value}`));
  addModifierMethod(node, 'grow', (value = true) => addClass(node, (typeof value === 'function') ? () => (value() === true ? 'grow' : `grow-${value()}`) : (value === true ? 'grow' : `grow-${value}`)));
  addModifierMethod(node, 'shrink', (value = true) => addClass(node, (typeof value === 'function') ? () => (value() === true ? 'shrink' : `shrink-${value()}`) : (value === true ? 'shrink' : `shrink-${value}`)));
  addModifierMethod(node, 'transitionClass', (value = 'colors') => addClass(node, (typeof value === 'function') ? () => `transition-${value() === 'colors' ? 'colors' : value()}` : `transition-${value === 'colors' ? 'colors' : value}`));
  addModifierMethod(node, 'duration', (value) => addClass(node, (typeof value === 'function') ? () => `duration-${value()}` : `duration-${value}`));
  addModifierMethod(node, 'ease', (value = 'out') => addClass(node, (typeof value === 'function')
    ? () => (String(value()).startsWith('ease-') ? String(value()) : `ease-${value()}`)
    : (String(value).startsWith('ease-') ? String(value) : `ease-${value}`)));
  addModifierMethod(node, 'animate', (value = 'pulse') => addThemedProps(node, resolveAnimateClass(value)));
  addModifierMethod(node, 'absolute', () => addClass(node, 'absolute'));
  addModifierMethod(node, 'relative', () => addClass(node, 'relative'));
  addModifierMethod(node, 'fixed', () => addClass(node, 'fixed'));
  addModifierMethod(node, 'sticky', () => addClass(node, 'sticky top-0'));
  addModifierMethod(node, 'centered', () => addClass(node, 'items-center justify-center text-center'));
  addModifierMethod(node, 'hidden', () => addClass(node, 'hidden'));
  addModifierMethod(node, 'visible', () => addClass(node, 'block'));
  addModifierMethod(node, 'showWhen', (value = true) => setNodeProp(node, 'showWhen', value));
  addModifierMethod(node, 'hideWhen', (value = true) => setNodeProp(node, 'hideWhen', value));
  addModifierMethod(node, 'focusWhen', (value = true) => setNodeProp(node, 'focusWhen', value));

  Object.keys(node.meta?.modifiers || {}).forEach((name) => {
    if (name in node) {
      return;
    }

    addModifierMethod(node, name, (value) => applyPrimitiveModifier(node, name, value));
  });

  return node;
}

export function mergeProps(...sources) {
  const nextProps = {};
  const styleEntries = [];
  const attrsEntries = [];
  const datasetEntries = [];
  const classNames = [];

  sources
    .filter(Boolean)
    .forEach((source) => {
      Object.entries(source).forEach(([key, value]) => {
        if (value === undefined) return;

        if (key === 'class' || key === 'className') {
          warnReactiveValueOutsideFunction(value, 'Feather: className must wrap reactive values in a function (() => value).');
          classNames.push(value);
          return;
        }

        if (key === 'style') {
          warnReactiveValueOutsideFunction(value, 'Feather: style must wrap reactive values in a function (() => value).');
          styleEntries.push(value);
          return;
        }

        if (key === 'attrs') {
          warnReactiveValueOutsideFunction(value, 'Feather: attrs must wrap reactive values in a function (() => value).');
          attrsEntries.push(value);
          return;
        }

        if (key === 'dataset') {
          warnReactiveValueOutsideFunction(value, 'Feather: dataset must wrap reactive values in a function (() => value).');
          datasetEntries.push(value);
          return;
        }

        warnReactiveValueOutsideFunction(value, `Feather: ${key} must be passed as a function (() => value).`);
        nextProps[key] = value;
      });
    });

  if (classNames.length > 0) {
    if (classNames.some((value) => typeof value === 'function')) {
      nextProps.className = () => cx(classNames.map((value) => (typeof value === 'function' ? value() : value)));
    } else {
      const mergedClassName = cx(classNames);
      if (mergedClassName) {
        nextProps.className = mergedClassName;
      }
    }
  }

  if (styleEntries.length > 0) {
    nextProps.style = styleEntries.some((value) => typeof value === 'function')
      ? () => Object.assign({}, ...styleEntries.map((value) => {
        const resolvedValue = typeof value === 'function' ? value() : value;
        return resolvedValue && typeof resolvedValue === 'object' ? resolvedValue : {};
      }))
      : Object.assign({}, ...styleEntries.filter((value) => value && typeof value === 'object'));
  }

  if (attrsEntries.length > 0) {
    nextProps.attrs = attrsEntries.some((value) => typeof value === 'function')
      ? () => Object.assign({}, ...attrsEntries.map((value) => {
        const resolvedValue = typeof value === 'function' ? value() : value;
        return resolvedValue && typeof resolvedValue === 'object' ? resolvedValue : {};
      }))
      : Object.assign({}, ...attrsEntries.filter((value) => value && typeof value === 'object'));
  }

  if (datasetEntries.length > 0) {
    nextProps.dataset = datasetEntries.some((value) => typeof value === 'function')
      ? () => Object.assign({}, ...datasetEntries.map((value) => {
        const resolvedValue = typeof value === 'function' ? value() : value;
        return resolvedValue && typeof resolvedValue === 'object' ? resolvedValue : {};
      }))
      : Object.assign({}, ...datasetEntries.filter((value) => value && typeof value === 'object'));
  }

  delete nextProps.class;
  return nextProps;
}

export function splitProps(props, keys = []) {
  const picked = {};
  const rest = {};
  const keySet = new Set(keys);

  Object.entries(props || {}).forEach(([key, value]) => {
    if (keySet.has(key)) {
      picked[key] = value;
      return;
    }

    rest[key] = value;
  });

  return [picked, rest];
}

export function resolveComponentArgs(args, defaults = {}) {
  const { props, children } = parseArguments(Array.from(args));
  return {
    props: mergeProps(defaults, props),
    children,
  };
}

export function unstyled(component) {
  return function unstyledComponent(...args) {
    const { props, children } = resolveComponentArgs(args);
    return component(
      mergeProps({ unstyled: true }, props),
      ...children,
    );
  };
}

function appendChild(parent, child, context) {
  const node = createDomNode(child, context);
  if (node) {
    parent.appendChild(node);
  }
}

function clearBetween(start, end) {
  let current = start.nextSibling;

  while (current && current !== end) {
    const next = current.nextSibling;
    current.remove();
    current = next;
  }
}

function createRegionContext(parentContext) {
  const regionContext = createRenderContext({
    container: parentContext?.container,
    route: parentContext?.route,
    router: parentContext?.router,
    scope: parentContext || {},
  });

  if (parentContext?.once) {
    regionContext.once = parentContext.once;
  }

  return regionContext;
}

function createReactiveRegion(getter, context) {
  const fragment = document.createDocumentFragment();
  const start = document.createComment('feather-reactive-start');
  const end = document.createComment('feather-reactive-end');
  const regionContext = createRegionContext(context);
  let active = true;

  fragment.appendChild(start);

  const initialNode = untrack(() => createDomNode(getter(), regionContext));
  if (initialNode) {
    fragment.appendChild(initialNode);
  }

  fragment.appendChild(end);

  context?.cleanup?.(() => {
    active = false;
    regionContext.destroy();
  });

  queueMicrotask(() => {
    if (!context?.cleanup || !active) {
      return;
    }

    const stop = effect(() => {
      const parent = end.parentNode;
      if (!parent) {
        return;
      }

      regionContext.prepareRender();
      clearBetween(start, end);
      const nextNode = createDomNode(getter(), regionContext);
      if (nextNode) {
        parent.insertBefore(nextNode, end);
      }
    });

    regionContext.cleanup(stop, 'lifetime');
  });

  return fragment;
}

function createReactiveChildNode(binding, context) {
  return createReactiveRegion(binding, context);
}

function applyStyles(element, styles) {
  if (!styles || typeof styles !== 'object') return;

  warnReactiveValueOutsideFunction(styles, 'Feather: style must wrap reactive values in a function (() => value).');

  Object.entries(styles).forEach(([property, value]) => {
    if (value === null || value === undefined || value === false) return;
    if (property.startsWith('--') || property.includes('-')) {
      element.style.setProperty(property, String(value));
      return;
    }

    element.style[property] = String(value);
  });
}

function applyClassName(element, value) {
  if (isReactive(value)) {
    warnBinding('Feather: className must wrap reactive values in a function (() => value).');
    element.removeAttribute('class');
    return;
  }

  warnReactiveValueOutsideFunction(value, 'Feather: className must wrap reactive values in a function (() => value).');
  const classNames = cx(value);
  if (classNames) {
    element.setAttribute('class', classNames);
    return;
  }

  element.removeAttribute('class');
}

function clearStyleProperty(element, property) {
  if (property.startsWith('--') || property.includes('-')) {
    element.style.removeProperty(property);
    return;
  }

  element.style[property] = '';
}

function applyStyleObject(element, previousValue, nextValue) {
  warnReactiveValueOutsideFunction(nextValue, 'Feather: style must wrap reactive values in a function (() => value).');
  const previousEntries = previousValue && typeof previousValue === 'object' ? previousValue : {};
  const nextEntries = nextValue && typeof nextValue === 'object' ? nextValue : {};
  const keys = new Set([
    ...Object.keys(previousEntries),
    ...Object.keys(nextEntries),
  ]);

  keys.forEach((property) => {
    const value = nextEntries[property];
    if (value === null || value === undefined || value === false) {
      clearStyleProperty(element, property);
      return;
    }

    if (property.startsWith('--') || property.includes('-')) {
      element.style.setProperty(property, String(value));
      return;
    }

    element.style[property] = String(value);
  });

  if (Object.keys(nextEntries).length === 0 && !element.getAttribute('style')) {
    element.removeAttribute('style');
  }
}

function applyDatasetObject(element, previousValue, nextValue) {
  warnReactiveValueOutsideFunction(nextValue, 'Feather: dataset must wrap reactive values in a function (() => value).');
  const previousEntries = previousValue && typeof previousValue === 'object' ? previousValue : {};
  const nextEntries = nextValue && typeof nextValue === 'object' ? nextValue : {};
  const keys = new Set([
    ...Object.keys(previousEntries),
    ...Object.keys(nextEntries),
  ]);

  keys.forEach((key) => {
    const value = nextEntries[key];
    if (value === null || value === undefined || value === false) {
      delete element.dataset[key];
      return;
    }

    element.dataset[key] = String(value);
  });
}

function applyAttributeObject(element, previousValue, nextValue) {
  warnReactiveValueOutsideFunction(nextValue, 'Feather: attrs must wrap reactive values in a function (() => value).');
  const previousEntries = previousValue && typeof previousValue === 'object' ? previousValue : {};
  const nextEntries = nextValue && typeof nextValue === 'object' ? nextValue : {};
  const keys = new Set([
    ...Object.keys(previousEntries),
    ...Object.keys(nextEntries),
  ]);

  keys.forEach((key) => {
    const value = nextEntries[key];
    if (value === true) {
      element.setAttribute(key, '');
      return;
    }

    if (value === null || value === undefined || value === false) {
      element.removeAttribute(key);
      return;
    }

    element.setAttribute(key, String(value));
  });
}

function createPropApplicator(element, key, context) {
  let previousValue;

  return (nextValue) => {
    if (key === 'style') {
      applyStyleObject(element, previousValue, nextValue);
      previousValue = nextValue && typeof nextValue === 'object' ? { ...nextValue } : null;
      return null;
    }

    if (key === 'dataset') {
      applyDatasetObject(element, previousValue, nextValue);
      previousValue = nextValue && typeof nextValue === 'object' ? { ...nextValue } : null;
      return null;
    }

    if (key === 'attrs') {
      applyAttributeObject(element, previousValue, nextValue);
      previousValue = nextValue && typeof nextValue === 'object' ? { ...nextValue } : null;
      return null;
    }

    previousValue = nextValue;
    return applyResolvedProp(element, key, nextValue, context);
  };
}

function applyResolvedProp(element, key, nextValue, context) {
  if (isReactive(nextValue)) {
    warnBinding(`Feather: ${getBindingTargetName(key)} must be passed as a function (() => value).`);
    nextValue = undefined;
  }

  if (key === 'checked') {
    element.checked = Boolean(nextValue);
    return;
  }

  if (key === 'showWhen') {
    element.hidden = !Boolean(nextValue);
    return;
  }

  if (key === 'hideWhen') {
    element.hidden = Boolean(nextValue);
    return;
  }

  if (key === 'focusWhen') {
    if (nextValue) {
      queueMicrotask(() => {
        if (document.activeElement !== element) {
          element.focus?.();
        }
      });
    }
    return;
  }

  if (nextValue === null || nextValue === undefined || nextValue === false) {
    if (key === 'class' || key === 'className') {
      element.removeAttribute('class');
      return;
    }

    if (key === 'style') {
      element.removeAttribute('style');
      return;
    }

    if (key === 'text' || key === 'html' || key === 'value') {
      element[key === 'html' ? 'innerHTML' : key === 'text' ? 'textContent' : 'value'] = '';
      return;
    }

    if (key === 'routerLink') {
      element.removeAttribute('data-link');
      return;
    }

    if (key === 'showWhen') {
      element.hidden = true;
      return;
    }

    if (key === 'hideWhen') {
      element.hidden = false;
      return;
    }

    if (key === 'focusWhen') {
      return;
    }

    if (key in element) {
      try {
        element[key] = '';
      } catch {
        element.removeAttribute(key);
      }
      return;
    }

    element.removeAttribute(key);
    return;
  }

  if (key === 'class' || key === 'className') {
    applyClassName(element, nextValue);
    return null;
  }

  if (key === 'style') {
    applyStyles(element, nextValue);
    return null;
  }

  if (key === 'dataset' && typeof nextValue === 'object') {
    Object.entries(nextValue).forEach(([entryKey, entryValue]) => {
      if (entryValue !== null && entryValue !== undefined) {
        element.dataset[entryKey] = String(entryValue);
      }
    });
    return null;
  }

  if (key === 'routerLink') {
    if (nextValue) {
      element.setAttribute('data-link', '');
    }
    return null;
  }

  if (key === 'attrs' && typeof nextValue === 'object') {
    Object.entries(nextValue).forEach(([entryKey, entryValue]) => {
      if (entryValue === true) {
        element.setAttribute(entryKey, '');
        return;
      }

      if (entryValue === null || entryValue === undefined || entryValue === false) {
        element.removeAttribute(entryKey);
        return;
      }

      element.setAttribute(entryKey, String(entryValue));
    });
    return null;
  }

  if (key === 'html') {
    element.innerHTML = String(nextValue);
    return null;
  }

  if (key === 'text') {
    element.textContent = String(nextValue);
    return null;
  }

  if (key === 'ref' && typeof nextValue === 'function') {
    nextValue(element, context);
    return null;
  }

  if (key.startsWith('on') && typeof nextValue === 'function') {
    const eventName = key.slice(2).toLowerCase();
    element.addEventListener(eventName, nextValue);
    return () => element.removeEventListener(eventName, nextValue);
  }

  if (key === 'value') {
    element.value = String(nextValue);
    return null;
  }

  if (key in element && typeof nextValue !== 'object') {
    try {
      element[key] = nextValue;
      return null;
    } catch {
      // Fall through to setAttribute.
    }
  }

  if (nextValue === true) {
    element.setAttribute(key, '');
    return null;
  }

  element.setAttribute(key, String(nextValue));
  return null;
}

function shouldApplyPropBinding(key, value) {
  return typeof value === 'function' && !key.startsWith('on') && key !== 'ref';
}

function createPropController(element, context) {
  const entries = new Map();
  let previousProps = {};

  function getEntry(key) {
    if (entries.has(key)) {
      return entries.get(key);
    }

    const entry = {
      apply: createPropApplicator(element, key, context),
      stop: null,
    };

    entries.set(key, entry);
    return entry;
  }

  function setProp(key, value) {
    const entry = getEntry(key);
    if (typeof entry.stop === 'function') {
      entry.stop();
      entry.stop = null;
    }

    const stop = shouldApplyPropBinding(key, value)
      ? applyBinding(value, entry.apply)
      : entry.apply(value);

    entry.stop = typeof stop === 'function' ? stop : null;
  }

  function update(nextProps = {}) {
    const keys = new Set([
      ...Object.keys(previousProps),
      ...Object.keys(nextProps),
    ]);

    keys.forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(nextProps, key)) {
        setProp(key, undefined);
        return;
      }

      if (Object.is(previousProps[key], nextProps[key])) {
        return;
      }

      setProp(key, nextProps[key]);
    });

    previousProps = { ...nextProps };
  }

  function destroy() {
    entries.forEach(({ stop }) => {
      if (typeof stop === 'function') {
        stop();
      }
    });
    entries.clear();
    previousProps = {};
  }

  context?.cleanup(destroy);

  return {
    update,
    destroy,
  };
}

function createElementNode(node, context) {
  ensureRuntimeStyles();
  const resolvedNode = untrack(() => resolveRuntimeNode(node));

  if (resolvedNode.nodeType === FRAGMENT) {
    const fragment = document.createDocumentFragment();
    resolvedNode.children.forEach((child) => appendChild(fragment, child, context));
    return fragment;
  }

  if (typeof resolvedNode.nodeType === 'function') {
    return createDomNode(resolvedNode.nodeType({ ...resolvedNode.nodeProps, children: resolvedNode.children, context }), context);
  }

  const inSvgTree = Boolean(context?.svgNamespace);
  const isSvgTag = typeof resolvedNode.nodeType === 'string' && SVG_TAGS.has(resolvedNode.nodeType);
  const usesSvgNamespace = inSvgTree || isSvgTag;
  const element = usesSvgNamespace
    ? document.createElementNS(SVG_NAMESPACE, resolvedNode.nodeType)
    : document.createElement(resolvedNode.nodeType);
  const childContext = usesSvgNamespace && !inSvgTree
    ? { ...context, svgNamespace: true }
    : context;
  const propController = createPropController(element, childContext);
  const hasRuntimeResolvers = Boolean(
    node.meta?.prepareProps
    || node.meta?.resolveClassName
    || node.meta?.resolveProps,
  );

  if (hasRuntimeResolvers) {
    const stop = effect(() => {
      propController.update(resolveRuntimeNode(node).nodeProps);
    });

    childContext?.cleanup(stop);
  } else {
    propController.update(resolvedNode.nodeProps);
  }

  if (!resolvedNode.nodeProps.html && !resolvedNode.nodeProps.text) {
    resolvedNode.children.forEach((child) => appendChild(element, child, childContext));
  }

  return element;
}

function resolveRuntimeNode(node) {
  const runtimeState = node.meta?.state || {};
  const preparedProps = typeof node.meta?.prepareProps === 'function'
    ? node.meta.prepareProps(node.nodeProps, node.children)
    : node.nodeProps;
  const resolvedClassName = typeof node.meta?.resolveClassName === 'function'
    ? resolveThemeProps(node.meta.resolveClassName(runtimeState, node))
    : null;
  const resolvedProps = typeof node.meta?.resolveProps === 'function'
    ? node.meta.resolveProps(runtimeState, node)
    : null;

  if (!node.meta?.prepareProps && !resolvedClassName && !resolvedProps) {
    return node;
  }

  return {
    ...node,
    nodeProps: mergeProps(
      preparedProps,
      resolvedProps || {},
      resolvedClassName ? { className: resolvedClassName } : null,
    ),
  };
}

export function createDomNode(value, context) {
  if (value === null || value === undefined || value === false) {
    return null;
  }

  if (isReactive(value)) {
    warnBinding(DIRECT_REACTIVE_CHILD_WARNING);
    return null;
  }

  if (typeof value === 'function') {
    return createReactiveRegion(value, context);
  }

  if (isDomNode(value)) {
    return value;
  }

  if (isViewNode(value)) {
    return createElementNode(value, context);
  }

  if (Array.isArray(value)) {
    const fragment = document.createDocumentFragment();
    value.forEach((child) => appendChild(fragment, child, context));
    return fragment;
  }

  return document.createTextNode(String(value));
}

export function mountView(output, container, context) {
  ensureRuntimeStyles();

  if (typeof output === 'string') {
    container.innerHTML = output;
    return;
  }

  container.innerHTML = '';
  const node = createDomNode(output, context);
  if (node) {
    container.appendChild(node);
  }
}

function resolveQueryRoot(root = document) {
  if (typeof document === 'undefined') {
    return root || null;
  }

  if (!root) {
    return document;
  }

  if (typeof root === 'string') {
    return document.querySelector(root);
  }

  return root;
}

function resolveMountTarget(target = '#app') {
  if (typeof document === 'undefined') {
    return target || null;
  }

  if (!target) {
    return null;
  }

  if (typeof target === 'string') {
    return document.querySelector(target);
  }

  return target;
}

export function $(selector, root = document) {
  const resolvedRoot = resolveQueryRoot(root);
  if (!resolvedRoot?.querySelector) {
    return null;
  }

  return resolvedRoot.querySelector(selector);
}

export function $all(selector, root = document) {
  const resolvedRoot = resolveQueryRoot(root);
  if (!resolvedRoot?.querySelectorAll) {
    return [];
  }

  return Array.from(resolvedRoot.querySelectorAll(selector));
}

export function render(output, container, options = {}) {
  const context = options.context || createRenderContext({
    container,
    route: options.route,
    router: options.router,
    scope: options.scope,
  });

  const resolveOutput = typeof output === 'function' ? output : () => output;
  const performRender = () => {
    context.prepareRender();
    let nextView;
    beginReactiveCreationPhase('render()');
    try {
      nextView = untrack(() => resolveOutput(context));
    } finally {
      endReactiveCreationPhase();
    }
    mountView(nextView, container, context);

    if (typeof options.mount === 'function') {
      untrack(() => options.mount(context));
    }

    if (typeof options.afterRender === 'function') {
      untrack(() => options.afterRender(context));
    }
  };

  performRender();

  return {
    context,
    render: performRender,
    destroy() {
      context.destroy();
    },
  };
}

export function mount(output, target = '#app', options = {}) {
  const container = resolveMountTarget(target);

  if (!container) {
    throw new Error(`Feather: Could not find mount target "${String(target)}". Pass a DOM element or a valid selector.`);
  }

  return render(output, container, options);
}

export function html(strings, ...values) {
  let output = '';

  for (let index = 0; index < strings.length; index += 1) {
    output += strings[index];
    if (index < values.length) {
      output += flattenValue(values[index]);
    }
  }

  return output;
}

export function view(type, props = {}, ...children) {
  return createNode(type, props || {}, normalizeChildren(children));
}

export function page(definition) {
  return {
    name: definition.name || 'AnonymousPage',
    setup: definition.setup || null,
    render: definition.render || (() => ''),
    mount: definition.mount || null,
  };
}

export function setupGroup(name, value) {
  if (!name || typeof name !== 'string') {
    throw new Error('Feather: setupGroup(name, value) requires a string name for the group key.');
  }

  return {
    [name]: typeof value === 'function' ? value() : value,
  };
}

export function setupState(...entries) {
  const nextState = {};

  entries
    .filter((entry) => entry !== null && entry !== undefined && entry !== false)
    .forEach((entry) => {
      const resolvedEntry = typeof entry === 'function' ? entry() : entry;

      if (!isPlainObject(resolvedEntry)) {
        throw new Error('Feather: setupState(...) only accepts plain objects or factories that return plain objects. Return a plain object from setupState inputs.');
      }

      Object.entries(resolvedEntry).forEach(([key, value]) => {
        if (Object.prototype.hasOwnProperty.call(nextState, key)) {
          throw new Error(`Feather: setupState(...) received a duplicate key "${key}". Rename the group or merge the values before returning them.`);
        }

        nextState[key] = value;
      });
    });

  return nextState;
}

export function createRenderContext({ container, route, router, scope = {} }) {
  const renderCleanups = [];
  const lifetimeCleanups = [];
  const onceEntries = new Map();

  const context = {
    ...scope,
    container,
    route,
    router,
    navigate(path, options) {
      return router?.navigate(path, options);
    },
    cleanup(fn, scopeName = 'render') {
      if (typeof fn !== 'function') {
        return fn;
      }

      if (scopeName === 'lifetime') {
        lifetimeCleanups.push(fn);
      } else {
        renderCleanups.push(fn);
      }

      return fn;
    },
    once(key, fn) {
      if (typeof key === 'function') {
        fn = key;
        key = fn;
      }

      if (typeof fn !== 'function') {
        return onceEntries.get(key);
      }

      if (onceEntries.has(key)) {
        return onceEntries.get(key);
      }

      let result;
      try {
        result = fn();
      } catch (error) {
        onceEntries.delete(key);
        throw error;
      }

      onceEntries.set(key, result);

      if (result && typeof result.then === 'function') {
        result.catch(() => {
          if (onceEntries.get(key) === result) {
            onceEntries.delete(key);
          }
        });
      }

      return result;
    },
    prepareRender() {
      runCleanups(renderCleanups);
    },
    $(selector) {
      return container.querySelector(selector);
    },
    $all(selector) {
      return Array.from(container.querySelectorAll(selector));
    },
    bind(target, type, handler, options) {
      const resolvedTarget = resolveTarget(target, container);
      if (!resolvedTarget?.addEventListener) return () => {};

      resolvedTarget.addEventListener(type, handler, options);
      const remove = () => resolvedTarget.removeEventListener(type, handler, options);
      renderCleanups.push(remove);
      return remove;
    },
    timeout(callback, delay = 0, scopeName = 'lifetime') {
      const timeoutId = setTimeout(() => {
        cleanup();
        callback();
      }, delay);

      const cleanup = () => clearTimeout(timeoutId);
      context.cleanup(cleanup, scopeName);
      return cleanup;
    },
    interval(callback, delay = 0, scopeName = 'lifetime') {
      const intervalId = setInterval(callback, delay);
      const cleanup = () => clearInterval(intervalId);
      context.cleanup(cleanup, scopeName);
      return cleanup;
    },
    raf(callback, scopeName = 'render') {
      const frameId = scheduleFrame(callback);
      const cleanup = () => cancelFrame(frameId);
      context.cleanup(cleanup, scopeName);
      return cleanup;
    },
    watch(source, listener, options = {}) {
      const {
        immediate = true,
        scope: scopeName = 'render',
        equals = Object.is,
      } = options;
      const readSource = typeof source === 'function' ? source : () => read(source);
      let initialized = false;
      let previousValue;

      const stop = effect(() => {
        const nextValue = readSource();

        if (!initialized) {
          initialized = true;
          previousValue = nextValue;
          if (immediate) {
            return listener(nextValue, undefined);
          }
          return undefined;
        }

        if (equals(previousValue, nextValue)) {
          return undefined;
        }

        const currentPrevious = previousValue;
        previousValue = nextValue;
        return listener(nextValue, currentPrevious);
      });

      context.cleanup(stop, scopeName);
      return stop;
    },
    setHTML(nextHtml) {
      context.prepareRender();
      container.innerHTML = nextHtml;
    },
    setView(nextView) {
      context.prepareRender();
      mountView(nextView, container, context);
    },
    render(nextView) {
      context.prepareRender();
      mountView(nextView, container, context);
    },
  };

  context.destroy = () => {
    runCleanups(renderCleanups);
    runCleanups(lifetimeCleanups);
  };

  return context;
}

export function Fragment(...children) {
  return createNode(FRAGMENT, {}, normalizeChildren(children));
}

export function El(type, ...args) {
  const { props, children } = parseArguments(args);
  return createNode(type, props, children);
}

export function createPrimitive(tagName, options = {}) {
  const primitive = function primitiveComponent(...args) {
    const { props, children } = resolveComponentArgs(args, options.defaults || {});
    const { styled = false, unstyled = false, ...nextProps } = props;
    const baseClassName = typeof options.className === 'function'
      ? options.className(nextProps, children)
      : options.className;
    const baseThemeProps = styled && !unstyled ? resolveThemeProps(baseClassName) : null;

    return createNode(
      tagName,
      mergeProps(nextProps, baseThemeProps),
      children,
      {
        kind: options.kind || tagName,
        state: { ...(options.state || {}) },
        modifiers: options.modifiers || {},
        resolveClassName: options.resolveClassName || null,
        resolveProps: options.resolveProps || null,
        prepareProps: options.prepareProps || null,
        styled: styled && !unstyled,
      },
    );
  };

  Object.entries(options.shortcuts || {}).forEach(([name, applyShortcut]) => {
    Object.defineProperty(primitive, name, {
      value: (...args) => applyShortcut(primitive(...args)),
      enumerable: false,
      configurable: false,
      writable: false,
    });
  });

  return primitive;
}

function createAlias(tagName, defaultClassName = '') {
  return function aliasComponent(...args) {
    const { props, children } = resolveComponentArgs(args);
    const { styled = false, unstyled = false, ...rest } = props;
    const defaultThemeProps = styled && !unstyled ? resolveThemeProps(defaultClassName) : null;

    return createNode(
      tagName,
      mergeProps(defaultThemeProps, rest),
      children,
    );
  };
}

function resolveButtonVariant(node, value) {
  return updateNodeState(node, {
    variant: value,
  });
}

function resolveButtonSize(node, value) {
  return updateNodeState(node, {
    size: value,
  });
}

function resolveButtonBlock(node, value = true) {
  return updateNodeState(node, {
    block: value,
  });
}

function resolveButtonLoading(node, value = true) {
  return updateNodeState(node, {
    loading: value,
  });
}

function resolveAlertVariant(node, value) {
  return updateNodeState(node, {
    variant: value,
  });
}

function resolveLinkTo(node, value) {
  return cloneNode(node, {
    props: {
      href: value,
      routerLink: true,
    },
  });
}

function resolveAriaLabel(node, value) {
  return cloneNode(node, {
    props: {
      attrs: typeof value === 'function'
        ? () => ({ 'aria-label': value() })
        : { 'aria-label': value },
    },
  });
}

function resolveAriaLabelledBy(node, value) {
  return cloneNode(node, {
    props: {
      attrs: typeof value === 'function'
        ? () => ({ 'aria-labelledby': value() })
        : { 'aria-labelledby': value },
    },
  });
}

function resolveAriaDescribedBy(node, value) {
  return cloneNode(node, {
    props: {
      attrs: typeof value === 'function'
        ? () => ({ 'aria-describedby': value() })
        : { 'aria-describedby': value },
    },
  });
}

function resolveLandmarkRole(node, value = 'region') {
  return cloneNode(node, {
    props: {
      attrs: typeof value === 'function'
        ? () => {
          const resolvedValue = value();
          return { role: resolvedValue === true ? 'region' : resolvedValue };
        }
        : { role: value === true ? 'region' : value },
    },
  });
}

function resolveTextWrapBalance(node, value = true) {
  return cloneNode(node, {
    props: {
      style: typeof value === 'function'
        ? () => (value() ? { textWrap: 'balance' } : {})
        : (value ? { textWrap: 'balance' } : {}),
    },
  });
}

function resolveTextWrapPretty(node, value = true) {
  return cloneNode(node, {
    props: {
      style: typeof value === 'function'
        ? () => (value() ? { textWrap: 'pretty' } : {})
        : (value ? { textWrap: 'pretty' } : {}),
    },
  });
}

function resolveClamp(node, lines = 1) {
  const count = Number((typeof lines === 'function' ? lines() : lines) ?? 1);
  if (count <= 1) {
    return cloneNode(node, {
      props: {
        style: {
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        },
      },
    });
  }

  return cloneNode(node, {
    props: {
      style: {
        display: '-webkit-box',
        WebkitBoxOrient: 'vertical',
        WebkitLineClamp: String(count),
        overflow: 'hidden',
      },
    },
  });
}

function resolveFontWeight(node, value) {
  return cloneNode(node, {
    props: {
      style: typeof value === 'function'
        ? () => ({ fontWeight: value() })
        : { fontWeight: value },
    },
  });
}

function resolveHeadingLevel(node, value = 1) {
  const level = Math.max(1, Math.min(6, Number((typeof value === 'function' ? value() : value) || 1)));
  return cloneNode(node, {
    nodeType: `h${level}`,
  });
}

function resolveListMarker(node, value) {
  return cloneNode(node, {
    props: {
      style: typeof value === 'function'
        ? () => ({ listStyleType: value() })
        : { listStyleType: value },
    },
  });
}

function resolveListInside(node, value = true) {
  return cloneNode(node, {
    props: {
      style: typeof value === 'function'
        ? () => ({ listStylePosition: value() ? 'inside' : 'outside' })
        : { listStylePosition: value ? 'inside' : 'outside' },
    },
  });
}

function resolveListOutside(node, value = true) {
  return cloneNode(node, {
    props: {
      style: typeof value === 'function'
        ? () => ({ listStylePosition: value() ? 'outside' : 'inside' })
        : { listStylePosition: value ? 'outside' : 'inside' },
    },
  });
}

function resolveListGap(node, value) {
  return cloneNode(node, {
    props: {
      style: typeof value === 'function'
        ? () => ({ display: 'grid', gap: value() })
        : { display: 'grid', gap: value },
    },
  });
}

function resolveListDense(node, value = true) {
  return cloneNode(node, {
    props: {
      style: typeof value === 'function'
        ? () => (value() ? { gap: '.25rem' } : {})
        : (value ? { gap: '.25rem' } : {}),
    },
  });
}

function resolveOrderedListStart(node, value) {
  return cloneNode(node, {
    props: {
      start: value,
    },
  });
}

function resolveOrderedListReversed(node, value = true) {
  return cloneNode(node, {
    props: {
      reversed: value,
    },
  });
}

function resolveListItemValue(node, value) {
  return cloneNode(node, {
    props: {
      value,
    },
  });
}

export function Text(...args) {
  const { props, children } = resolveComponentArgs(args);
  const { styled = false, unstyled = false, ...rest } = props;

  return createNode(
    'span',
    mergeProps(styled && !unstyled ? resolveThemeProps(token('text.base')) : null, rest),
    children,
  );
}

function createTextElement(tagName, defaultClassName = '', modifiers = {}, options = {}) {
  return createPrimitive(tagName, {
    resolveClassName: (_state, node) => !node.meta?.styled ? '' : defaultClassName,
    modifiers: {
      ...(options.level ? { level: resolveHeadingLevel } : null),
      balance: resolveTextWrapBalance,
      pretty: resolveTextWrapPretty,
      clamp: resolveClamp,
      ...modifiers,
    },
  });
}

function createLandmarkElement(tagName, defaultClassName = '', modifiers = {}) {
  return createPrimitive(tagName, {
    resolveClassName: (_state, node) => !node.meta?.styled ? '' : defaultClassName,
    modifiers: {
      ariaLabel: resolveAriaLabel,
      ariaLabelledBy: resolveAriaLabelledBy,
      ariaDescribedBy: resolveAriaDescribedBy,
      ...modifiers,
    },
  });
}

export const Container = createAlias('div', 'feather-container');
export const Box = createAlias('div', 'feather-box');
export const Break = createAlias('br');
export const LineBreak = Break;
export const Divider = createAlias('hr');
export const Group = createAlias('div', 'feather-group');
export const Span = createTextElement('span');
export const Paragraph = createTextElement('p');
export const Strong = createTextElement('strong', '', {
  weight: resolveFontWeight,
});
export const Emphasis = createTextElement('em');
export const Small = createTextElement('small');
export const Code = createTextElement('code');
export const Title = createTextElement('h1', token('text.base'), {}, { level: true });
export const Subtitle = createTextElement('p', token('text.muted'), {}, { level: true });
export const Section = createLandmarkElement('section', 'feather-section', {
  landmark: resolveLandmarkRole,
});
export const Article = createLandmarkElement('article');
export const Aside = createLandmarkElement('aside');
export const Header = createLandmarkElement('header');
export const Footer = createLandmarkElement('footer');
export const Main = createLandmarkElement('main');
export const Nav = createLandmarkElement('nav');
export const List = createPrimitive('ul', {
  modifiers: {
    marker: resolveListMarker,
    inside: resolveListInside,
    outside: resolveListOutside,
    gap: resolveListGap,
    dense: resolveListDense,
  },
});
export const OrderedList = createPrimitive('ol', {
  modifiers: {
    marker: resolveListMarker,
    inside: resolveListInside,
    outside: resolveListOutside,
    gap: resolveListGap,
    dense: resolveListDense,
    start: resolveOrderedListStart,
    reversed: resolveOrderedListReversed,
  },
});
export const ListItem = createPrimitive('li', {
  modifiers: {
    value: resolveListItemValue,
  },
});
export const Surface = createAlias('div', 'feather-surface');
export const FieldNode = createAlias('div', 'feather-field');
export const Label = createAlias('label', 'feather-label');
export const Icon = createAlias('svg');
export const Path = createAlias('path');

export function Form(...args) {
  if (args.length > 0 && isFormObject(args[0])) {
    const [form, ...rest] = args;
    return Form(...rest).form(form);
  }

  const { props, children } = resolveComponentArgs(args);
  const { styled = false, unstyled = false, ...rest } = props;

  return createNode(
    'form',
    mergeProps(styled && !unstyled ? { className: 'feather-form' } : null, rest),
    children,
    {
      kind: 'form',
      prepareProps: resolveFormProps,
    },
  );
}

export function VStack(...args) {
  const { props, children } = resolveComponentArgs(args, {
    style: {
      display: 'flex',
      flexDirection: 'column',
      margin: 0,
    },
  });

  return createNode(
    'div',
    mergeProps({ className: 'feather-vstack' }, props),
    children,
  );
}

export function HStack(...args) {
  const { props, children } = resolveComponentArgs(args, {
    style: {
      display: 'flex',
      flexDirection: 'row',
      margin: 0,
    },
  });

  return createNode(
    'div',
    mergeProps({ className: 'feather-hstack' }, props),
    children,
  );
}

export function ZStack(...args) {
  const { props, children } = resolveComponentArgs(args, {
    style: {
      display: 'grid',
      margin: 0,
    },
  });

  const layeredChildren = children.map((child) => {
    if (!isViewNode(child)) {
      return child;
    }

    return cloneNode(child, {
      props: {
        style: mergeProps(
          child.nodeProps?.style ? { style: child.nodeProps.style } : null,
          { style: { gridArea: '1 / 1' } },
        ).style,
      },
    });
  });

  return createNode(
    'div',
    mergeProps({ className: 'feather-zstack' }, props),
    layeredChildren,
  );
}

export function Spacer(props = {}) {
  return createNode('div', mergeProps(
    { style: { flex: '1 1 auto' }, 'aria-hidden': 'true' },
    props,
  ));
}

export const Button = createPrimitive('button', {
  kind: 'button',
  defaults: {
    type: 'button',
  },
  state: {
    variant: 'primary',
    size: 'md',
    block: false,
    loading: false,
  },
  resolveProps: (state, node) => mergeProps(
    node.meta?.styled ? resolveThemeProps(
      token('button.base'),
      token(`button.variant.${read(state.variant) || 'primary'}`),
      token(`button.size.${read(state.size) || 'md'}`),
      read(state.block) && token('button.block'),
      read(state.loading) && token('button.loading'),
    ) : null,
    read(state.loading) ? {
      disabled: true,
      attrs: {
        'aria-busy': 'true',
      },
      dataset: {
        loading: 'true',
      },
    } : null,
  ),
  modifiers: {
    variant: resolveButtonVariant,
    size: resolveButtonSize,
    block: resolveButtonBlock,
    loading: resolveButtonLoading,
  },
});

export const Input = createPrimitive('input', {
  kind: 'input',
  prepareProps: (props) => resolveFieldBindings(props),
  resolveClassName: (_state, node) => (!node.meta?.styled ? null : token('input.base')),
});

export const Img = createPrimitive('img', {
  kind: 'img',
  modifiers: {
    loading: (node, value) => setNodeProp(node, 'loading', value),
    decoding: (node, value) => setNodeProp(node, 'decoding', value),
  },
});

export const Checkbox = createPrimitive('input', {
  kind: 'checkbox',
  defaults: {
    type: 'checkbox',
  },
  prepareProps: (props) => resolveFieldBindings(props),
  resolveClassName: (_state, node) => !node.meta?.styled ? '' : '',
});

export const Link = createPrimitive('a', {
  kind: 'link',
  resolveClassName: (_state, node) => (!node.meta?.styled ? null : token('link.base')),
  modifiers: {
    to: resolveLinkTo,
  },
});

export function ForEach(items, renderItem) {
  if (typeof items === 'function') {
    return () => {
      const resolvedItems = items();
      if (!Array.isArray(resolvedItems)) return [];
      return resolvedItems.map((item, index) => renderItem(item, index));
    };
  }

  if (isReactive(items)) {
    warnBinding('Feather: Pass reactive ForEach sources as functions. Use ForEach(() => items.get(), renderItem).');
    return [];
  }

  const resolvedItems = items;
  if (!Array.isArray(resolvedItems)) return [];
  return resolvedItems.map((item, index) => renderItem(item, index));
}

export function Show(condition, truthyValue, falsyValue = null) {
  if (typeof condition === 'function') {
    return () => (condition() ? truthyValue : falsyValue);
  }

  if (isReactive(condition)) {
    warnBinding('Feather: Pass reactive Show conditions as functions. Use Show(() => open.get(), shown, hidden).');
    return falsyValue;
  }

  return condition ? truthyValue : falsyValue;
}

export function Alert(...args) {
  const { props, children } = resolveComponentArgs(args);
  const { styled = false, unstyled = false, ...rest } = props;

  return createNode('div', rest, children, {
    kind: 'alert',
    state: {
      variant: 'info',
      styled: styled && !unstyled,
    },
    modifiers: {
      variant: resolveAlertVariant,
    },
    resolveProps: (state) => (!state.styled ? null : resolveThemeProps(
      token('surface.alert'),
      token(`alert.variant.${read(state.variant) || 'info'}`),
    )),
  });
}

