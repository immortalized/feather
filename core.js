import { beginReactiveCreationPhase, effect, endReactiveCreationPhase, isReactive, read, untrack } from './state.js';
import { getInternalFeatherConfig } from './config.js';
import { cx, token } from './theme.js';

const FRAGMENT = Symbol('feather.fragment');
const FEATHER_RUNTIME_STYLE_ID = 'feather-runtime-styles';
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';
const MAX_BINDING_DEPTH = 1;
const bindingWarnings = new Set();
const NESTED_BINDING_WARNING = 'Feather: Nested bindings are not supported. Use a flat object or wrap values in a function (() => value).';
const ARRAY_BINDING_WARNING = 'Feather: Arrays of bindings are discouraged. Keep the binding flat or wrap the value in a function (() => value).';
const MIXED_BINDING_WARNING = 'Feather: Do not mix getter bindings and reactive values in the same binding. Pick one binding style and keep it consistent.';
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
    return flattenValue(value.get());
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

function createBindingInfo() {
  return {
    hasBinding: false,
    hasGetter: false,
    hasReactive: false,
    hasNested: false,
    hasArray: false,
  };
}

function markBindingType(value, info) {
  if (typeof value === 'function' && value.length === 0) {
    info.hasBinding = true;
    info.hasGetter = true;
    return true;
  }

  if (isReactive(value)) {
    info.hasBinding = true;
    info.hasReactive = true;
    return true;
  }

  return false;
}

function inspectBindingContainerEntries(entries, info) {
  entries.forEach((entry) => {
    if (markBindingType(entry, info)) {
      return;
    }

    if (Array.isArray(entry)) {
      info.hasArray = true;
      info.hasNested = true;
      entry.forEach((nestedEntry) => {
        if (markBindingType(nestedEntry, info)) {
          return;
        }

        if (Array.isArray(nestedEntry) || isPlainObject(nestedEntry)) {
          info.hasNested = true;
        }
      });
      return;
    }

    if (isPlainObject(entry)) {
      info.hasNested = true;
      Object.values(entry).forEach((nestedEntry) => {
        if (markBindingType(nestedEntry, info)) {
          return;
        }

        if (Array.isArray(nestedEntry)) {
          info.hasArray = true;
          info.hasNested = true;
          return;
        }

        if (isPlainObject(nestedEntry)) {
          info.hasNested = true;
        }
      });
    }
  });
}

function inspectBinding(value, info, depth = 0) {
  if (markBindingType(value, info)) {
    return;
  }

  if (Array.isArray(value)) {
    info.hasArray = true;
    if (depth >= MAX_BINDING_DEPTH) {
      info.hasNested = true;
      inspectBindingContainerEntries(value, info);
      return;
    }

    value.forEach((entry) => inspectBinding(entry, info, depth + 1));
    return;
  }

  if (isPlainObject(value)) {
    if (depth >= MAX_BINDING_DEPTH) {
      info.hasNested = true;
      inspectBindingContainerEntries(Object.values(value), info);
      return;
    }

    Object.values(value).forEach((entry) => inspectBinding(entry, info, depth + 1));
  }
}

function getBindingInfo(value, { warn = true } = {}) {
  const info = createBindingInfo();
  inspectBinding(value, info);

  if (warn && info.hasBinding) {
    if (info.hasNested) {
      warnBinding(NESTED_BINDING_WARNING);
    }

    if (info.hasArray) {
      warnBinding(ARRAY_BINDING_WARNING);
    }

    if (info.hasGetter && info.hasReactive) {
      warnBinding(MIXED_BINDING_WARNING);
    }
  }

  return info;
}

function isBindingGetter(value) {
  return getBindingInfo(value, { warn: false }).hasGetter;
}

function isBinding(value) {
  return getBindingInfo(value, { warn: false }).hasBinding;
}

function unwrapBinding(value, depth = 0) {
  if (typeof value === 'function' && value.length === 0) {
    return unwrapBinding(value(), depth);
  }

  if (isReactive(value)) {
    return unwrapBinding(value.get(), depth);
  }

  if (Array.isArray(value)) {
    if (depth >= MAX_BINDING_DEPTH) {
      if (isBinding(value)) {
        warnBinding(NESTED_BINDING_WARNING);
      }
      return value;
    }

    return value.map((entry) => unwrapBinding(entry, depth + 1));
  }

  if (isPlainObject(value)) {
    if (depth >= MAX_BINDING_DEPTH) {
      if (isBinding(value)) {
        warnBinding(NESTED_BINDING_WARNING);
      }
      return value;
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [key, unwrapBinding(entryValue, depth + 1)]),
    );
  }

  return value;
}

function createBindingGetter(value, legacyMessage = null) {
  const bindingInfo = getBindingInfo(value);
  if (!bindingInfo.hasBinding) {
    return null;
  }

  if (legacyMessage && bindingInfo.hasReactive && !bindingInfo.hasGetter && !bindingInfo.hasNested) {
    warnBinding(legacyMessage);
  }

  return () => unwrapBinding(value);
}

function resolveBindingValue(value, legacyMessage = null) {
  const bindingGetter = createBindingGetter(value, legacyMessage);
  return bindingGetter ? bindingGetter() : value;
}

function mapBinding(value, mapper, legacyMessage = null) {
  const bindingGetter = createBindingGetter(value, legacyMessage);
  return bindingGetter
    ? () => mapper(bindingGetter())
    : mapper(resolveBindingValue(value));
}

function mapJoinedBinding(parts, mapper) {
  if (parts.some((entry) => isBinding(entry))) {
    return () => mapper(parts.map((entry) => resolveBindingValue(entry)));
  }

  return mapper(parts.map((entry) => resolveBindingValue(entry)));
}

function resolveModelBindings(props = {}) {
  const { model, field, onInput, onChange, type, checked, value, ...rest } = props;
  const binding = field || model;

  if (!binding) {
    return props;
  }

  const currentType = resolveBindingValue(type);
  const nextType = type === undefined ? currentType : type;
  const isCheckboxLike = currentType === 'checkbox' || currentType === 'radio';
  const modelBinding = isReactive(model) ? () => model.get() : model;
  const invalidAttrs = field?.invalid
    ? { 'aria-invalid': () => field.invalid.get() }
    : null;

  if (isCheckboxLike) {
    return mergeProps(rest, {
      type: nextType,
      checked: field ? () => field.value.get() : (modelBinding || checked),
      onChange: composeHandlers((event) => {
        if (binding?.set) {
          binding.set(Boolean(event.target.checked));
        }

        if (field?.touch) {
          field.touch();
        }
      }, onChange),
      attrs: invalidAttrs,
    });
  }

  return mergeProps(rest, {
    type: nextType,
    value: field ? () => field.value.get() : (modelBinding || value),
    onInput: composeHandlers((event) => {
      if (binding?.set) {
        binding.set(event.target.value);
      }

      if (field?.touch) {
        field.touch();
      }
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

function resolveSemanticClass(group, value, fallbackPrefix) {
  return mapBinding(value, (resolvedValue) => {
    const semanticClass = token(`${group}.${resolvedValue}`);

    if (semanticClass) {
      return semanticClass;
    }

    if (!fallbackPrefix || resolvedValue === null || resolvedValue === undefined || resolvedValue === false) {
      return '';
    }

    return `${fallbackPrefix}-${resolvedValue}`;
  });
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
  return mapBinding(value, (resolvedValue) => {
    const semanticAnimation = token(`animation.${resolvedValue}`);

    if (semanticAnimation) {
      return semanticAnimation;
    }

    if (String(resolvedValue).startsWith('animate-')) {
      return String(resolvedValue);
    }

    return `animate-${resolvedValue}`;
  });
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
    const styles = {};
    assignDirectionalStyles(property, key, value, styles);
    return styles;
  }

  if (args.some(isBinding)) {
    return { [property]: mapJoinedBinding(args, (values) => values.join(' ')) };
  }

  return { [property]: args.map((value) => resolveBindingValue(value)).join(' ') };
}

function resolveShadowValue(args) {
  if (args.length === 0) {
    return null;
  }

  if (args.length === 1) {
    const [value] = args;

    if (isPlainStyleObject(value)) {
      const {
        inset = false,
        x = 0,
        y = 0,
        blur = 0,
        spread = 0,
        color = 'currentColor',
      } = value;

      if ([inset, x, y, blur, spread, color].some(isBinding)) {
        return mapJoinedBinding(
          [inset, x, y, blur, spread, color],
          ([nextInset, nextX, nextY, nextBlur, nextSpread, nextColor]) => `${nextInset ? 'inset ' : ''}${nextX} ${nextY} ${nextBlur} ${nextSpread} ${nextColor}`.trim(),
        );
      }

      return `${resolveBindingValue(inset) ? 'inset ' : ''}${resolveBindingValue(x)} ${resolveBindingValue(y)} ${resolveBindingValue(blur)} ${resolveBindingValue(spread)} ${resolveBindingValue(color)}`.trim();
    }

    return resolveBindingValue(value);
  }

  if (args.some(isBinding)) {
    return mapJoinedBinding(args, (values) => values.join(' '));
  }

  return args.map((value) => resolveBindingValue(value)).join(' ');
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
      dataset: {
        [key]: value,
      },
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
  addModifierMethod(node, 'when', (condition, applyWhenTrue) => (resolveBindingValue(condition)
    ? (typeof applyWhenTrue === 'function' ? applyWhenTrue(node) : node)
    : node));
  addModifierMethod(node, 'if', (condition, truthyValue, falsyValue = null) => {
    if (resolveBindingValue(condition)) {
      return typeof truthyValue === 'function' ? truthyValue(node) : truthyValue || node;
    }

    return typeof falsyValue === 'function' ? falsyValue(node) : (falsyValue || node);
  });
  addModifierMethod(node, 'as', (value) => withModifiers({
    ...cloneNode(node),
    nodeType: resolveBindingValue(value) || node.nodeType,
  }));
  addModifierMethod(node, 'aria', (key, value = true) => addAttributes(node, {
    [`aria-${String(key).replace(/^aria-/, '')}`]: value,
  }));
  addModifierMethod(node, 'ariaInvalid', (value = true) => node.aria('invalid', value));
  addModifierMethod(node, 'ariaLabel', (value) => node.aria('label', value));
  addModifierMethod(node, 'ariaLabelledBy', (value) => node.aria('labelledby', value));
  addModifierMethod(node, 'ariaDescribedBy', (value) => node.aria('describedby', value));
  addModifierMethod(node, 'ariaHidden', (value = true) => node.aria('hidden', value));
  addModifierMethod(node, 'className', (value) => addClass(node, value));
  addModifierMethod(node, 'class', (value) => addClass(node, value));
  addModifierMethod(node, 'toggleClass', (name, condition = true) => addClass(node, {
    [name]: condition,
  }));
  addModifierMethod(node, 'tw', (...values) => addClass(node, values.filter(Boolean).join(' ')));
  addModifierMethod(node, 'style', (value) => addStyles(node, value));
  addModifierMethod(node, 'padding', (...args) => addStyleEntries(node, resolveBoxModelStyles('padding', args)));
  addModifierMethod(node, 'paddingRight', (value) => addStyleEntries(node, { paddingRight: value }));
  addModifierMethod(node, 'paddingLeft', (value) => addStyleEntries(node, { paddingLeft: value }));
  addModifierMethod(node, 'paddingTop', (value) => addStyleEntries(node, { paddingTop: value }));
  addModifierMethod(node, 'paddingBottom', (value) => addStyleEntries(node, { paddingBottom: value }));
  addModifierMethod(node, 'margin', (...args) => addStyleEntries(node, resolveBoxModelStyles('margin', args)));
  addModifierMethod(node, 'gap', (value) => addStyleEntries(node, { gap: value }));
  addModifierMethod(node, 'rowGap', (value) => addStyleEntries(node, { rowGap: value }));
  addModifierMethod(node, 'columnGap', (value) => addStyleEntries(node, { columnGap: value }));
  addModifierMethod(node, 'textAlign', (value) => addStyleEntries(node, { textAlign: value }));
  addModifierMethod(node, 'justifyContent', (value) => addStyleEntries(node, { justifyContent: value }));
  addModifierMethod(node, 'alignItems', (value) => addStyleEntries(node, { alignItems: value }));
  addModifierMethod(node, 'alignSelf', (value) => addStyleEntries(node, { alignSelf: value }));
  addModifierMethod(node, 'placeItems', (value) => addStyleEntries(node, { placeItems: value }));
  addModifierMethod(node, 'display', (value) => addStyleEntries(node, { display: value }));
  addModifierMethod(node, 'position', (value) => addStyleEntries(node, { position: value }));
  addModifierMethod(node, 'top', (value) => addStyleEntries(node, { top: value }));
  addModifierMethod(node, 'right', (value) => addStyleEntries(node, { right: value }));
  addModifierMethod(node, 'bottom', (value) => addStyleEntries(node, { bottom: value }));
  addModifierMethod(node, 'left', (value) => addStyleEntries(node, { left: value }));
  addModifierMethod(node, 'inset', (value) => addStyleEntries(node, { inset: value }));
  addModifierMethod(node, 'overflow', (value) => addStyleEntries(node, { overflow: value }));
  addModifierMethod(node, 'overflowX', (value) => addStyleEntries(node, { overflowX: value }));
  addModifierMethod(node, 'overflowY', (value) => addStyleEntries(node, { overflowY: value }));
  addModifierMethod(node, 'opacity', (value) => addStyleEntries(node, { opacity: value }));
  addModifierMethod(node, 'fontSize', (value) => addStyleEntries(node, { fontSize: value }));
  addModifierMethod(node, 'fontWeight', (value) => addStyleEntries(node, { fontWeight: value }));
  addModifierMethod(node, 'lineHeight', (value) => addStyleEntries(node, { lineHeight: value }));
  addModifierMethod(node, 'letterSpacing', (value) => addStyleEntries(node, { letterSpacing: value }));
  addModifierMethod(node, 'color', (value) => addStyleEntries(node, { color: value }));
  addModifierMethod(node, 'backgroundColor', (value) => addStyleEntries(node, { backgroundColor: value }));
  addModifierMethod(node, 'borderRadius', (...args) => addStyleEntries(node, resolveBoxModelStyles('borderRadius', args)));
  addModifierMethod(node, 'borderColor', (value) => addStyleEntries(node, { borderColor: value }));
  addModifierMethod(node, 'borderWidth', (value) => addStyleEntries(node, { borderWidth: value }));
  addModifierMethod(node, 'boxShadow', (...args) => addStyleEntries(node, { boxShadow: resolveShadowValue(args) }));
  addModifierMethod(node, 'shadow', (...args) => addStyleEntries(node, { boxShadow: resolveShadowValue(args) }));
  addModifierMethod(node, 'transform', (value) => addStyleEntries(node, { transform: value }));
  addModifierMethod(node, 'transition', (value) => addStyleEntries(node, { transition: value }));
  addModifierMethod(node, 'pointerEvents', (value) => addStyleEntries(node, { pointerEvents: value }));
  addModifierMethod(node, 'cursor', (value) => addStyleEntries(node, { cursor: value }));
  addModifierMethod(node, 'id', (value) => setNodeProp(node, 'id', value));
  addModifierMethod(node, 'name', (value) => setNodeProp(node, 'name', value));
  addModifierMethod(node, 'type', (value) => setNodeProp(node, 'type', value));
  addModifierMethod(node, 'value', (value) => setNodeProp(node, 'value', value));
  addModifierMethod(node, 'checked', (value = true) => setNodeProp(node, 'checked', value));
  addModifierMethod(node, 'placeholder', (value) => setNodeProp(node, 'placeholder', value));
  addModifierMethod(node, 'autocomplete', (value) => setNodeProp(node, 'autocomplete', value));
  addModifierMethod(node, 'field', (value) => setNodeProp(node, 'field', value));
  addModifierMethod(node, 'model', (value) => setNodeProp(node, 'model', value));
  addModifierMethod(node, 'form', (value) => setNodeProp(node, 'form', value));
  addModifierMethod(node, 'href', (value) => setNodeProp(node, 'href', value));
  addModifierMethod(node, 'src', (value) => setNodeProp(node, 'src', value));
  addModifierMethod(node, 'alt', (value) => setNodeProp(node, 'alt', value));
  addModifierMethod(node, 'text', (value) => setNodeProp(node, 'text', value));
  addModifierMethod(node, 'html', (value) => setNodeProp(node, 'html', value));
  addModifierMethod(node, 'ref', (value) => setNodeProp(node, 'ref', value));
  addModifierMethod(node, 'routerLink', (value = true) => setNodeProp(node, 'routerLink', value));
  addModifierMethod(node, 'attr', (key, value) => addAttributes(node, { [key]: value }));
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

  addModifierMethod(node, 'width', (value) => addStyleEntries(node, { width: value }));
  addModifierMethod(node, 'height', (value) => addStyleEntries(node, { height: value }));
  addModifierMethod(node, 'minWidth', (value) => addStyleEntries(node, { minWidth: value }));
  addModifierMethod(node, 'minHeight', (value) => addStyleEntries(node, { minHeight: value }));
  addModifierMethod(node, 'maxWidth', (value) => addStyleEntries(node, { maxWidth: value }));
  addModifierMethod(node, 'maxHeight', (value) => addStyleEntries(node, { maxHeight: value }));
  addModifierMethod(node, 'widthClass', (value) => addClass(node, mapBinding(value, (nextValue) => resolveTailwindSize('w', nextValue))));
  addModifierMethod(node, 'heightClass', (value) => addClass(node, mapBinding(value, (nextValue) => resolveTailwindSize('h', nextValue))));
  addModifierMethod(node, 'minWidthClass', (value) => addClass(node, mapBinding(value, (nextValue) => resolveTailwindSize('min-w', nextValue))));
  addModifierMethod(node, 'minHeightClass', (value) => addClass(node, mapBinding(value, (nextValue) => resolveTailwindSize('min-h', nextValue))));
  addModifierMethod(node, 'maxWidthClass', (value) => addClass(node, mapBinding(value, (nextValue) => resolveTailwindSize('max-w', nextValue))));
  addModifierMethod(node, 'maxHeightClass', (value) => addClass(node, mapBinding(value, (nextValue) => resolveTailwindSize('max-h', nextValue))));
  addModifierMethod(node, 'rounded', (value = 'md') => addClass(node, mapBinding(value, (nextValue) => (nextValue === 'none' ? 'rounded-none' : `rounded-${nextValue}`))));
  addModifierMethod(node, 'background', (value) => addClass(node, resolveSemanticClass('background', value, 'bg')));
  addModifierMethod(node, 'textColor', (value) => addClass(node, resolveSemanticClass('text', value, 'text')));
  addModifierMethod(node, 'border', (value = true) => addClass(node, mapBinding(value, (nextValue) => (nextValue === true ? 'border' : `border-${nextValue}`))));
  addModifierMethod(node, 'borderColorClass', (value) => addClass(node, resolveSemanticClass('border', value, 'border')));
  addModifierMethod(node, 'opacityClass', (value) => addClass(node, mapBinding(value, (nextValue) => `opacity-${nextValue}`)));
  addModifierMethod(node, 'displayClass', (value) => addClass(node, mapBinding(value, (nextValue) => String(nextValue))));
  addModifierMethod(node, 'font', (value) => addClass(node, mapBinding(value, (nextValue) => `font-${nextValue}`)));
  addModifierMethod(node, 'textSize', (value) => addClass(node, mapBinding(value, (nextValue) => `text-${nextValue}`)));
  addModifierMethod(node, 'leading', (value) => addClass(node, mapBinding(value, (nextValue) => `leading-${nextValue}`)));
  addModifierMethod(node, 'tracking', (value) => addClass(node, mapBinding(value, (nextValue) => `tracking-${nextValue}`)));
  addModifierMethod(node, 'justify', (value) => addClass(node, mapBinding(value, (nextValue) => resolveJustifyClass(nextValue))));
  addModifierMethod(node, 'align', (value) => addClass(node, mapBinding(value, (nextValue) => resolveAlignClass(nextValue))));
  addModifierMethod(node, 'items', (value) => addClass(node, mapBinding(value, (nextValue) => `items-${nextValue}`)));
  addModifierMethod(node, 'self', (value) => addClass(node, mapBinding(value, (nextValue) => `self-${nextValue}`)));
  addModifierMethod(node, 'grow', (value = true) => addClass(node, mapBinding(value, (nextValue) => (nextValue === true ? 'grow' : `grow-${nextValue}`))));
  addModifierMethod(node, 'shrink', (value = true) => addClass(node, mapBinding(value, (nextValue) => (nextValue === true ? 'shrink' : `shrink-${nextValue}`))));
  addModifierMethod(node, 'transitionClass', (value = 'colors') => addClass(node, mapBinding(value, (nextValue) => `transition-${nextValue === 'colors' ? 'colors' : nextValue}`)));
  addModifierMethod(node, 'duration', (value) => addClass(node, mapBinding(value, (nextValue) => `duration-${nextValue}`)));
  addModifierMethod(node, 'ease', (value = 'out') => addClass(node, mapBinding(value, (nextValue) => (String(nextValue).startsWith('ease-') ? String(nextValue) : `ease-${nextValue}`))));
  addModifierMethod(node, 'animate', (value = 'pulse') => addClass(node, resolveAnimateClass(value)));
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
  const style = {};
  const attrs = {};
  const dataset = {};
  const classNames = [];
  let hasReactiveClassName = false;

  sources
    .filter(Boolean)
    .forEach((source) => {
      Object.entries(source).forEach(([key, value]) => {
        if (value === undefined) return;

        if (key === 'class' || key === 'className') {
          classNames.push(value);
          if (isBinding(value)) {
            hasReactiveClassName = true;
          }
          return;
        }

        if (key === 'style' && isPlainObject(value)) {
          Object.assign(style, value);
          return;
        }

        if (key === 'attrs' && isPlainObject(value)) {
          Object.assign(attrs, value);
          return;
        }

        if (key === 'dataset' && isPlainObject(value)) {
          Object.assign(dataset, value);
          return;
        }

        nextProps[key] = value;
      });
    });

  if (classNames.length > 0) {
    if (hasReactiveClassName) {
      nextProps.className = mapJoinedBinding(classNames, (values) => cx(values));
    } else {
      const mergedClassName = cx(classNames);
      if (mergedClassName) {
        nextProps.className = mergedClassName;
      }
    }
  }

  if (Object.keys(style).length > 0) {
    nextProps.style = style;
  }

  if (Object.keys(attrs).length > 0) {
    nextProps.attrs = attrs;
  }

  if (Object.keys(dataset).length > 0) {
    nextProps.dataset = dataset;
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
  const bindingGetter = createBindingGetter(binding, DIRECT_REACTIVE_CHILD_WARNING);
  return createReactiveRegion(() => (bindingGetter ? bindingGetter() : binding), context);
}

function applyStyles(element, styles) {
  if (!styles || typeof styles !== 'object') return;

  Object.entries(styles).forEach(([property, value]) => {
    const nextValue = read(value);
    if (nextValue === null || nextValue === undefined) return;
    if (property.startsWith('--') || property.includes('-')) {
      element.style.setProperty(property, String(nextValue));
      return;
    }

    element.style[property] = String(nextValue);
  });
}

function applyClassName(element, value) {
  const classNames = cx(value);
  element.setAttribute('class', classNames);
}

function applyResolvedProp(element, key, nextValue, context) {
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
    return;
  }

  if (key === 'style') {
    applyStyles(element, nextValue);
    return;
  }

  if (key === 'dataset' && typeof nextValue === 'object') {
    Object.entries(nextValue).forEach(([entryKey, entryValue]) => {
      if (entryValue !== null && entryValue !== undefined) {
        element.dataset[entryKey] = String(entryValue);
      }
    });
    return;
  }

  if (key === 'routerLink') {
    if (nextValue) {
      element.setAttribute('data-link', '');
    }
    return;
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
    return;
  }

  if (key === 'html') {
    element.innerHTML = String(nextValue);
    return;
  }

  if (key === 'text') {
    element.textContent = String(nextValue);
    return;
  }

  if (key === 'ref' && typeof nextValue === 'function') {
    nextValue(element, context);
    return;
  }

  if (key.startsWith('on') && typeof nextValue === 'function') {
    const eventName = key.slice(2).toLowerCase();
    element.addEventListener(eventName, nextValue);

    if (context?.cleanup) {
      context.cleanup(() => element.removeEventListener(eventName, nextValue));
    }

    return;
  }

  if (key === 'value') {
    element.value = String(nextValue);
    return;
  }

  if (key in element && typeof nextValue !== 'object') {
    try {
      element[key] = nextValue;
      return;
    } catch {
      // Fall through to setAttribute.
    }
  }

  if (nextValue === true) {
    element.setAttribute(key, '');
    return;
  }

  element.setAttribute(key, String(nextValue));
}

function createReactivePropBinding(key, value) {
  const legacyMessage = `Feather: Pass reactive values to ${key} as functions. Use ${key}(() => value.get()) instead of passing the reactive value directly.`;
  const bindingGetter = (key.startsWith('on') || key === 'ref')
    ? null
    : createBindingGetter(value, legacyMessage);

  if (!bindingGetter) {
    return null;
  }

  return {
    key,
    get: bindingGetter,
  };
}

function applyReactivePropBinding(element, binding, context) {
  applyResolvedProp(element, binding.key, binding.get(), context);
}

function applyElementProps(element, props, context) {
  // Bindings on the same node share one effect so prop-heavy elements scale better
  // without changing the granularity of the actual prop updates.
  const reactiveBindings = [];

  Object.entries(props).forEach(([key, value]) => {
    const binding = createReactivePropBinding(key, value);
    if (binding) {
      reactiveBindings.push(binding);
      return;
    }

    applyResolvedProp(element, key, value, context);
  });

  if (reactiveBindings.length === 0) {
    return;
  }

  const stop = effect(() => {
    reactiveBindings.forEach((binding) => {
      applyReactivePropBinding(element, binding, context);
    });
  });

  context?.cleanup(stop);
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
  applyElementProps(element, resolvedNode.nodeProps, childContext);

  if (isBinding(node.meta?.state)) {
    let previousRuntimeProps = resolvedNode.nodeProps;
    const stop = effect(() => {
      const runtimeNode = resolveRuntimeNode(node);
      const nextRuntimeProps = runtimeNode.nodeProps;
      const keys = new Set([
        ...Object.keys(previousRuntimeProps || {}),
        ...Object.keys(nextRuntimeProps || {}),
      ]);

      keys.forEach((key) => {
        applyResolvedProp(
          element,
          key,
          resolveBindingValue(Object.prototype.hasOwnProperty.call(nextRuntimeProps, key) ? nextRuntimeProps[key] : undefined),
          childContext,
        );
      });

      previousRuntimeProps = nextRuntimeProps;
    });

    childContext?.cleanup(stop);
  }

  if (!resolvedNode.nodeProps.html && !resolvedNode.nodeProps.text) {
    resolvedNode.children.forEach((child) => appendChild(element, child, childContext));
  }

  return element;
}

function resolveRuntimeNode(node) {
  // Runtime state also flows through the binding pipeline so modifiers, props,
  // and control-flow helpers share the same mental model.
  const runtimeState = resolveBindingValue(node.meta?.state || {});
  const preparedProps = typeof node.meta?.prepareProps === 'function'
    ? node.meta.prepareProps(node.nodeProps, node.children)
    : node.nodeProps;
  const resolvedClassName = typeof node.meta?.resolveClassName === 'function'
    ? node.meta.resolveClassName(runtimeState, node)
    : '';
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
    return createReactiveChildNode(value, context);
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

    return createNode(
      tagName,
      mergeProps(nextProps, styled && !unstyled && baseClassName ? { className: baseClassName } : null),
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

    return createNode(
      tagName,
      mergeProps(styled && !unstyled && defaultClassName ? { className: defaultClassName } : null, rest),
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
      attrs: {
        'aria-label': value,
      },
    },
  });
}

function resolveAriaLabelledBy(node, value) {
  return cloneNode(node, {
    props: {
      attrs: {
        'aria-labelledby': value,
      },
    },
  });
}

function resolveAriaDescribedBy(node, value) {
  return cloneNode(node, {
    props: {
      attrs: {
        'aria-describedby': value,
      },
    },
  });
}

function resolveLandmarkRole(node, value = 'region') {
  return cloneNode(node, {
    props: {
      attrs: {
        role: value === true ? 'region' : value,
      },
    },
  });
}

function resolveTextWrapBalance(node, value = true) {
  return cloneNode(node, {
    props: {
      style: value ? { textWrap: 'balance' } : {},
    },
  });
}

function resolveTextWrapPretty(node, value = true) {
  return cloneNode(node, {
    props: {
      style: value ? { textWrap: 'pretty' } : {},
    },
  });
}

function resolveClamp(node, lines = 1) {
  const count = Number(read(lines) ?? 1);
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
      style: {
        fontWeight: value,
      },
    },
  });
}

function resolveHeadingLevel(node, value = 1) {
  const level = Math.max(1, Math.min(6, Number(read(value) || 1)));
  return cloneNode(node, {
    nodeType: `h${level}`,
  });
}

function resolveListMarker(node, value) {
  return cloneNode(node, {
    props: {
      style: {
        listStyleType: value,
      },
    },
  });
}

function resolveListInside(node, value = true) {
  return cloneNode(node, {
    props: {
      style: {
        listStylePosition: value ? 'inside' : 'outside',
      },
    },
  });
}

function resolveListOutside(node, value = true) {
  return cloneNode(node, {
    props: {
      style: {
        listStylePosition: value ? 'outside' : 'inside',
      },
    },
  });
}

function resolveListGap(node, value) {
  return cloneNode(node, {
    props: {
      style: {
        display: 'grid',
        gap: value,
      },
    },
  });
}

function resolveListDense(node, value = true) {
  return cloneNode(node, {
    props: {
      style: value ? { gap: '.25rem' } : {},
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
    mergeProps(styled && !unstyled ? { className: token('text.base') } : null, rest),
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

  return createNode('div', props, children);
}

export function HStack(...args) {
  const { props, children } = resolveComponentArgs(args, {
    style: {
      display: 'flex',
      flexDirection: 'row',
      margin: 0,
    },
  });

  return createNode('div', props, children);
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

  return createNode('div', props, layeredChildren);
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
  resolveClassName: (state, node) => !node.meta?.styled ? '' : cx(
    token('button.base'),
    token(`button.variant.${read(state.variant) || 'primary'}`),
    token(`button.size.${read(state.size) || 'md'}`),
    read(state.block) && token('button.block'),
    read(state.loading) && token('button.loading'),
  ),
  resolveProps: (state) => (read(state.loading) ? {
    disabled: true,
    attrs: {
      'aria-busy': 'true',
    },
    dataset: {
      loading: 'true',
    },
  } : null),
  modifiers: {
    variant: resolveButtonVariant,
    size: resolveButtonSize,
    block: resolveButtonBlock,
    loading: resolveButtonLoading,
  },
});

export const Input = createPrimitive('input', {
  kind: 'input',
  prepareProps: (props) => resolveModelBindings(props),
  resolveClassName: (_state, node) => !node.meta?.styled ? '' : token('input.base'),
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
  prepareProps: (props) => resolveModelBindings(props),
  resolveClassName: (_state, node) => !node.meta?.styled ? '' : '',
});

export const Link = createPrimitive('a', {
  kind: 'link',
  resolveClassName: (_state, node) => !node.meta?.styled ? '' : token('link.base'),
  modifiers: {
    to: resolveLinkTo,
  },
});

export function ForEach(items, renderItem) {
  const itemsGetter = createBindingGetter(
    items,
    'Feather: Pass reactive ForEach sources as functions. Use ForEach(() => items.get(), renderItem).',
  );

  if (itemsGetter) {
    return () => {
      const resolvedItems = read(itemsGetter());
      if (!Array.isArray(resolvedItems)) return [];
      return resolvedItems.map((item, index) => renderItem(item, index));
    };
  }

  const resolvedItems = read(items);
  if (!Array.isArray(resolvedItems)) return [];
  return resolvedItems.map((item, index) => renderItem(item, index));
}

export function Show(condition, truthyValue, falsyValue = null) {
  const conditionGetter = createBindingGetter(
    condition,
    'Feather: Pass reactive Show conditions as functions. Use Show(() => open.get(), shown, hidden).',
  );

  if (conditionGetter) {
    return () => (read(conditionGetter()) ? truthyValue : falsyValue);
  }

  return read(condition) ? truthyValue : falsyValue;
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
    resolveClassName: (state) => !state.styled ? '' : cx(
      token('surface.alert'),
      token(`alert.variant.${read(state.variant) || 'info'}`),
    ),
  });
}

