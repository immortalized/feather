function defineConstants(values) {
  return Object.freeze(values);
}

export const Width = defineConstants({
  Auto: 'auto',
  Full: 'full',
  Screen: 'screen',
  Fit: 'fit',
  Min: 'min',
  Max: 'max',
  Small: 'sm',
  Medium: 'md',
  Large: 'lg',
  ExtraLarge: 'xl',
  TwoExtraLarge: '2xl',
  ThreeExtraLarge: '3xl',
  FourExtraLarge: '4xl',
  FiveExtraLarge: '5xl',
  SixExtraLarge: '6xl',
  SevenExtraLarge: '7xl',
});

export const Height = defineConstants({
  Auto: 'auto',
  Full: 'full',
  Screen: 'screen',
  Fit: 'fit',
  Min: 'min',
  Max: 'max',
  Small: 'sm',
  Medium: 'md',
  Large: 'lg',
  ExtraLarge: 'xl',
});

export const Justify = defineConstants({
  Start: 'start',
  Center: 'center',
  End: 'end',
  Between: 'between',
  Around: 'around',
  Evenly: 'evenly',
});

export const Align = defineConstants({
  Start: 'start',
  Center: 'center',
  End: 'end',
  Stretch: 'stretch',
  Baseline: 'baseline',
});

export const Rounded = defineConstants({
  None: 'none',
  Small: 'sm',
  Medium: 'md',
  Large: 'lg',
  ExtraLarge: 'xl',
  TwoExtraLarge: '2xl',
  Full: 'full',
});

export const Shadow = defineConstants({
  None: 'none',
  Small: 'sm',
  Medium: 'md',
  Large: 'lg',
  ExtraLarge: 'xl',
  TwoExtraLarge: '2xl',
});

export const Font = defineConstants({
  Thin: 'thin',
  Light: 'light',
  Normal: 'normal',
  Medium: 'medium',
  Semibold: 'semibold',
  Bold: 'bold',
});

export const TextSize = defineConstants({
  ExtraSmall: 'xs',
  Small: 'sm',
  Base: 'base',
  Large: 'lg',
  ExtraLarge: 'xl',
  TwoExtraLarge: '2xl',
  ThreeExtraLarge: '3xl',
  FourExtraLarge: '4xl',
});

export const Leading = defineConstants({
  None: 'none',
  Tight: 'tight',
  Snug: 'snug',
  Normal: 'normal',
  Relaxed: 'relaxed',
  Loose: 'loose',
});

export const Tracking = defineConstants({
  Tighter: 'tighter',
  Tight: 'tight',
  Normal: 'normal',
  Wide: 'wide',
  Wider: 'wider',
  Widest: 'widest',
});

export const Display = defineConstants({
  Block: 'block',
  Inline: 'inline-flex',
  Flex: 'flex',
  Grid: 'grid',
  Hidden: 'hidden',
});

export const Animation = defineConstants({
  None: 'none',
  Enter: 'enter',
  Fade: 'fade',
  Rise: 'rise',
  Pulse: 'pulse',
  Ping: 'ping',
  Spin: 'spin',
  Bounce: 'bounce',
});

export const Background = defineConstants({
  App: 'app',
  Surface: 'surface',
  Muted: 'muted',
  Accent: 'accent',
  Inverse: 'inverse',
});

export const TextColor = defineConstants({
  Base: 'base',
  Muted: 'muted',
  Accent: 'accent',
  Inverse: 'inverse',
  Danger: 'danger',
  Success: 'success',
});

export const BorderColor = defineConstants({
  Base: 'base',
  Muted: 'muted',
  Accent: 'accent',
  Danger: 'danger',
  Success: 'success',
});

export const Variant = defineConstants({
  Primary: 'primary',
  Secondary: 'secondary',
  Outline: 'outline',
  Ghost: 'ghost',
  Error: 'error',
  Success: 'success',
  Info: 'info',
});

export const Tone = defineConstants({
  Default: 'default',
  Muted: 'muted',
  Accent: 'accent',
  Danger: 'danger',
  Success: 'success',
});

export const Size = defineConstants({
  Small: 'sm',
  Medium: 'md',
  Large: 'lg',
});
