const FEATHER_CONFIG = {
  // Strict mode turns binding guidance into errors.
  strictBindings: true,
  // Dev mode enables warnings and guidance.
  dev: true,
};

export function configureFeather(overrides = {}) {
  if (!overrides || typeof overrides !== 'object') {
    return { ...FEATHER_CONFIG };
  }

  if (Object.prototype.hasOwnProperty.call(overrides, 'strictBindings')) {
    FEATHER_CONFIG.strictBindings = Boolean(overrides.strictBindings);
  }

  if (Object.prototype.hasOwnProperty.call(overrides, 'dev')) {
    FEATHER_CONFIG.dev = Boolean(overrides.dev);
  }

  return { ...FEATHER_CONFIG };
}

export function getFeatherConfig() {
  return { ...FEATHER_CONFIG };
}

export function getInternalFeatherConfig() {
  return FEATHER_CONFIG;
}
