import { batch, computed, read, signal, store } from './state.js';
import {
  Box,
  Button,
  Checkbox,
  Form,
  Input,
  Label,
  Paragraph,
  Text,
  mergeProps,
  resolveComponentArgs,
} from './core.js';
import { cx } from './theme.js';

function cloneValue(value) {
  if (Array.isArray(value)) {
    return value.map(cloneValue);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]),
    );
  }

  return value;
}

function normalizeErrors(result) {
  if (!result || typeof result !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(result).map(([key, value]) => [key, value || '']),
  );
}

function normalizeAccepts(accepts = []) {
  if (!Array.isArray(accepts)) {
    return [];
  }

  return accepts
    .map((entry) => {
      if (typeof entry === 'string') {
        return {
          name: entry,
          message: 'This field must be accepted',
        };
      }

      if (!entry || typeof entry !== 'object' || !entry.name) {
        return null;
      }

      return {
        name: entry.name,
        message: entry.message || 'This field must be accepted',
      };
    })
    .filter(Boolean);
}

function normalizeTouched(values, names) {
  if (values === true) {
    return Object.fromEntries(names.map((name) => [name, true]));
  }

  if (!values || typeof values !== 'object') {
    return {};
  }

  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, Boolean(value)]),
  );
}

function createStateRegistry() {
  const localState = new Map();
  const localMemo = new Map();

  return {
    state(key, initialValue) {
      if (!localState.has(key)) {
        localState.set(key, signal(initialValue));
      }

      return localState.get(key);
    },
    memo(key, createValue) {
      if (!localMemo.has(key)) {
        localMemo.set(key, createValue());
      }

      return localMemo.get(key);
    },
  };
}

export function createForm({
  initial = {},
  accepts = [],
  validate,
  submit,
} = {}) {
  const initialValues = cloneValue(initial);
  const values = store(initialValues);
  const errors = store({});
  const touched = store({});
  const submitting = signal(false);
  const submitError = signal(null);
  const fieldCache = new Map();
  const registry = createStateRegistry();
  const normalizedAccepts = normalizeAccepts(accepts);

  const fieldNames = Object.keys(initialValues);

  const valid = computed(() => Object.values(errors()).every((value) => !value));
  const invalid = computed(() => !valid());
  const dirty = computed(() => fieldNames.some((name) => values()[name] !== initialValues[name]));

  function patchValue(name, nextValue) {
    values.patch({ [name]: nextValue });
  }

  function touchField(name, nextValue = true) {
    touched.patch({ [name]: Boolean(nextValue) });
  }

  function field(name) {
    if (fieldCache.has(name)) {
      return fieldCache.get(name);
    }

    const fieldRegistry = createStateRegistry();

    const nextField = {
      __featherField: true,
      name,
      form,
      set(nextValue) {
        patchValue(name, nextValue);
        return nextValue;
      },
      touch(nextValue = true) {
        touchField(name, nextValue);
        return nextValue;
      },
      reset() {
        batch(() => {
          patchValue(name, initialValues[name]);
          errors.patch({ [name]: '' });
          touchField(name, false);
        });
      },
      state: fieldRegistry.state,
      memo: fieldRegistry.memo,
      bind(props = {}) {
        return mergeProps(props, { field: nextField });
      },
    };

    // Field accessors stay reactive so form.field(...).value integrates cleanly
    // with the same function-based binding model as the rest of Feather.
    nextField.value = computed(() => values()[name]);
    nextField.error = computed(() => errors()[name] || '');
    nextField.touched = computed(() => Boolean(touched()[name]));
    nextField.invalid = computed(() => Boolean(nextField.error()));

    fieldCache.set(name, nextField);
    return nextField;
  }

  function validateForm() {
    const nextErrors = normalizeErrors(
      typeof validate === 'function' ? validate(values(), form) : {},
    );
    const currentValues = values();

    normalizedAccepts.forEach(({ name, message }) => {
      if (!currentValues[name] && !nextErrors[name]) {
        nextErrors[name] = message;
      }
    });

    errors.set(nextErrors);
    return Object.values(nextErrors).every((value) => !value);
  }

  async function submitForm(event) {
    event?.preventDefault?.();

    if (submitting()) {
      return false;
    }

    touched.set(normalizeTouched(true, fieldNames));
    submitError.set(null);

    if (!validateForm()) {
      return false;
    }

    submitting.set(true);

    try {
      if (typeof submit === 'function') {
        await submit(values(), form, event);
      }

      return true;
    } catch (error) {
      submitError.set(error);
      return false;
    } finally {
      submitting.set(false);
    }
  }

  function reset(nextInitial = initialValues) {
    const resetValues = cloneValue(nextInitial);
    batch(() => {
      values.set(resetValues);
      errors.set({});
      touched.set({});
      submitError.set(null);
    });
  }

  const form = {
    __featherForm: true,
    values,
    errors,
    touched,
    submitting,
    submitError,
    valid,
    invalid,
    dirty,
    accepts: normalizedAccepts,
    field,
    state: registry.state,
    memo: registry.memo,
    validate: validateForm,
    reset,
    submit: submitForm,
    set(nextValues) {
      return values.set(nextValues);
    },
    patch(nextValues) {
      return values.patch(nextValues);
    },
    touch(nextTouched = true) {
      touched.set(normalizeTouched(nextTouched, fieldNames));
      return touched();
    },
  };

  return form;
}

export function FormScope(...args) {
  if (args.length > 0 && args[0]?.__featherForm === true) {
    const [form, ...rest] = args;
    return Form(...rest).form(form);
  }

  return Form(...args);
}

export function Field(...args) {
  const { props, children } = resolveComponentArgs(args);
  const { unstyled = false, ...rest } = props;

  return Box(...children)
    .props(rest)
    .with((node) => (!unstyled ? node.className('feather-field') : node));
}

export function FieldLabel(...args) {
  const { props, children } = resolveComponentArgs(args);
  const { unstyled = false, ...rest } = props;

  return Label(...children)
    .props(rest)
    .with((node) => (!unstyled ? node.className('feather-field-label') : node));
}

export function FieldControl(...args) {
  const { props, children } = resolveComponentArgs(args);
  const { unstyled = false, ...rest } = props;

  return Box(...children)
    .props(rest)
    .with((node) => (!unstyled ? node.className('feather-field-control') : node));
}

export function FieldError(field, fallback = null) {
  const resolvedField = read(field);
  const fallbackIsObject = fallback && typeof fallback === 'object' && !Array.isArray(fallback);
  const className = fallbackIsObject ? fallback.className : null;
  const fallbackContent = fallbackIsObject ? fallback.content : fallback;
  const alwaysRender = Boolean(fallbackIsObject && fallback.alwaysRender);

  if (!resolvedField?.__featherField) {
    return Paragraph(field, fallbackContent)
      .className(cx('feather-field-error', className));
  }

  return Paragraph()
    .text(() => resolvedField.error() || fallbackContent || '')
    .showWhen(alwaysRender ? true : () => Boolean(resolvedField.error()))
    .className(cx('feather-field-error', className));
}

export function FieldHint(...args) {
  const { props, children } = resolveComponentArgs(args, {
    className: 'feather-field-hint',
  });

  return Text(...children).props(props);
}

export function CheckboxField({
  field,
  label,
  hint = null,
  className,
  unstyled = false,
  checkboxUnstyled = false,
  labelUnstyled = false,
  checkboxClassName,
  labelClassName,
  errorClassName,
  alwaysRenderError = false,
} = {}) {
  return Box(
    Label(
      Checkbox()
        .field(field)
        .className(checkboxClassName)
        .prop('unstyled', checkboxUnstyled),
      label,
    )
      .className(cx(labelClassName))
      .prop('unstyled', labelUnstyled),
    hint ? FieldHint(hint) : null,
    FieldError(field, { className: errorClassName, alwaysRender: alwaysRenderError }),
  ).className(cx(!unstyled && 'feather-checkbox-field', className));
}

export function TextField({
  field,
  model,
  label,
  id,
  type = 'text',
  placeholder = '',
  hint = null,
  className,
  labelClassName,
  controlClassName,
  inputClassName,
  inputStyle,
  errorClassName,
  alwaysRenderError = false,
  unstyled = false,
  labelUnstyled = false,
  controlUnstyled = false,
  inputUnstyled = false,
  autocomplete,
  beforeInput = null,
  afterInput = null,
  line = null,
  inputProps = {},
} = {}) {
  const resolvedId = id || field?.name;
  const modelValue = typeof model === 'function'
    ? model
    : (typeof model?.get === 'function' ? () => model.get() : undefined);
  const modelInput = typeof model === 'function'
    ? (event) => model(event.target.value)
    : (typeof model?.set === 'function' ? (event) => model.set(event.target.value) : null);

  return Field(
    label ? FieldLabel(label)
      .attr('for', resolvedId)
      .className(labelClassName)
      .prop('unstyled', labelUnstyled) : null,
    FieldControl(
      beforeInput,
      Input(inputProps)
        .field(field)
        .value(modelValue)
        .onInput(modelInput)
        .id(resolvedId)
        .type(type)
        .placeholder(placeholder)
        .autocomplete(autocomplete)
        .className(inputClassName)
        .style(inputStyle)
        .prop('unstyled', inputUnstyled),
      afterInput,
      line,
    )
      .className(controlClassName)
      .prop('unstyled', controlUnstyled),
    hint ? FieldHint(hint) : null,
    field ? FieldError(field, { className: errorClassName, alwaysRender: alwaysRenderError }) : null,
  )
    .className(className)
    .prop('unstyled', unstyled);
}

export function SubmitButton(...args) {
  let form = null;
  let contentArgs = args;

  if (args.length > 0 && args[0]?.__featherForm === true) {
    [form, ...contentArgs] = args;
  } else if (args.length > 0 && args[0] && typeof args[0] === 'object' && args[0].form?.__featherForm === true) {
    form = args[0].form;
    const [first, ...rest] = args;
    const { form: _form, ...nextProps } = first;
    contentArgs = [nextProps, ...rest];
  }

  const nextButton = Button(...contentArgs).submit();

  if (!form) {
    return nextButton;
  }

  return nextButton
    .loading(form.submitting)
    .disabled(form.submitting);
}

export function InputField(props = {}) {
  const {
    label,
    model,
    type = 'text',
    placeholder = '',
    description = null,
    ...rest
  } = props;

  return TextField({
    ...rest,
    label,
    model,
    type,
    placeholder,
    hint: description,
  });
}
