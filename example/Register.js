import '../../css/pages/Register.css';
import { register } from '../auth.js';
import { ensureGlobalStarfield } from '../global-starfield.js';
import {
  Box,
  Button,
  Checkbox,
  Form,
  Icon,
  Input,
  Label,
  Link,
  Paragraph,
  SubmitButton,
  Subtitle,
  Title,
  VStack,
  computed,
  createForm,
  page,
  signal,
  setupGroup,
  setupState,
} from '../feather/index.js';

const PASSWORD_PLACEHOLDER = '\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7\u00B7';

const EYE_OPEN = `
  <path stroke-linecap="round" stroke-linejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178Z" />
  <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
`;

const EYE_CLOSED = `
  <path stroke-linecap="round" stroke-linejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" />
`;

const STRENGTH_GRADIENTS = [
  'linear-gradient(90deg, #2a0000 0%, #8B0000 25%, #C0392B 50%, #8B0000 75%, #2a0000 100%)',
  'linear-gradient(90deg, #1a0000 0%, #6B0000 20%, #C0392B 45%, #920000 70%, #1a0000 100%)',
  'linear-gradient(90deg, #3d0000 0%, #C0392B 25%, #E67E22 50%, #C0392B 75%, #3d0000 100%)',
  'linear-gradient(90deg, #4a2000 0%, #E67E22 25%, #D4AC0D 50%, #E67E22 75%, #4a2000 100%)',
  'linear-gradient(90deg, #1a3a10 0%, #52BE80 25%, #D4AC0D 50%, #52BE80 75%, #1a3a10 100%)',
  'linear-gradient(90deg, #021a08 0%, #1E8449 20%, #52BE80 45%, #27AE60 70%, #021a08 100%)',
];

const STRENGTH_GLOWS = [
  'none',
  '0 0 6px rgba(139,0,0,0.5), 0 0 16px rgba(139,0,0,0.2)',
  '0 0 8px rgba(192,57,43,0.65), 0 0 20px rgba(230,126,34,0.2)',
  '0 0 8px rgba(212,172,13,0.7), 0 0 20px rgba(212,172,13,0.25)',
  '0 0 10px rgba(82,190,128,0.7), 0 0 24px rgba(82,190,128,0.3)',
  '0 0 12px rgba(39,174,96,0.85), 0 0 30px rgba(39,174,96,0.45)',
];

function getStrength(password) {
  let score = 0;
  if (password.length >= 6) score += 1;
  if (password.length >= 10) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

function createParticles(count = 18) {
  return Array.from({ length: count }, () => {
    const size = Math.random() * 2.2 + 0.4;
    const delay = Math.random() * 20;
    const duration = 18 + Math.random() * 22;
    const drift = (Math.random() - 0.5) * 90;
    const isRed = Math.random() < 0.28;
    const isGold = !isRed && Math.random() < 0.15;
    const background = isRed
      ? 'rgba(192,57,43,0.55)'
      : isGold
        ? 'rgba(212,175,55,0.4)'
        : 'rgba(255,230,210,0.28)';

    return {
      width: `${size}px`,
      height: `${size}px`,
      left: `${Math.random() * 100}%`,
      bottom: '-12px',
      background,
      animationDuration: `${duration}s`,
      animationDelay: `${delay}s`,
      '--drift': `${drift}px`,
    };
  });
}

function validateRegister(values) {
  const errors = {
    username: '',
    email: '',
    password: '',
    confirm: '',
    tos: '',
  };

  const username = values.username.trim();
  const email = values.email.trim();
  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!username) {
    errors.username = 'Username is required';
  }

  if (!email) {
    errors.email = 'Email is required';
  } else if (!emailPattern.test(email)) {
    errors.email = 'Invalid email address';
  }

  if (!values.password) {
    errors.password = 'Password is required';
  } else if (values.password.length < 8) {
    errors.password = 'Minimum 8 characters';
  }

  if (!values.confirm) {
    errors.confirm = 'Please confirm your password';
  } else if (values.confirm !== values.password) {
    errors.confirm = 'Passwords do not match';
  }

  if (!values.tos) {
    errors.tos = '';
  }

  return errors;
}

async function submitRegister(values, submitState, ctx) {
  submitState.success.set(false);

  await register(
    values.username.trim(),
    values.email.trim(),
    values.password,
  );

  submitState.success.set(true);
  ctx.timeout(() => window.router.navigate('/login'), 900, 'lifetime');
}

function FieldError({ field, style = null }) {
  return Paragraph()
    .className('bw-error')
    .text(() => field.error.get())
    .when(style, (node) => node.style(style));
}

function PasswordToggle({ revealed, iconMarkup, label }) {
  return Button(
    Icon()
      .attrs({
        xmlns: 'http://www.w3.org/2000/svg',
        fill: 'none',
        viewBox: '0 0 24 24',
        stroke: 'currentColor',
        'stroke-width': '1.5',
      })
      .html(iconMarkup),
  )
    .type('button')
    .className('bw-pw-toggle')
    .ariaLabel(label)
    .onClick(() => revealed.update((value) => !value));
}

function BloodwaveLabel(text, fieldId) {
  return Label(text)
    .className('bw-label')
    .attr('for', fieldId);
}

const bloodwaveInput = (node) => node.className('bw-input');

const bloodwavePasswordInput = (node) => node
  .with(bloodwaveInput)
  .placeholder(PASSWORD_PLACEHOLDER)
  .autocomplete('new-password')
  .paddingRight('clamp(40px, 9vw, 52px)');

const bloodwaveField = ({
  label,
  fieldId,
  error,
  className = 'bw-field',
  margin = null,
}) => (node) => VStack(
  BloodwaveLabel(label, fieldId),
  node,
  FieldError({ field: error }),
)
  .className(className)
  .when(margin, (nextNode) => nextNode.margin(margin));

const bloodwaveFieldWrap = (node) => node.className('bw-input-wrap');
const bloodwaveFieldLine = (node) => node.className('bw-input-line');
const bloodwaveParticles = (style) => Box().className('bw-particle').style(style);

function PasswordStrengthLine({ active, pulse, gradient, glow }) {
  return Box()
    .id('pwStrengthLine')
    .className('bw-input-line')
    .className({
      'bw-pw-active': () => active.get(),
      'bw-pw-pulse': () => pulse.get(),
    })
    .style({
      '--pw-gradient': () => gradient.get(),
      boxShadow: () => glow.get(),
    });
}

function TermsField(field) {
  return Box(
    Label(
      Checkbox()
        .field(field)
        .id('rxTosAccept')
        .className('bw-checkbox'),
      Box(
        'I accept the ',
        Link('Terms of Service & Cookie Policy')
          .href('/tos')
          .routerLink()
          .className('bw-forgot'),
      ).className('bw-checkbox-label'),
    ).className('bw-checkbox-wrapper'),
    FieldError({ field }),
  ).className('bw-field bw-field--tos');
}

function Divider() {
  return Box(
    Box().className('bw-divider-line'),
    Box('or').className('bw-divider-text'),
    Box().className('bw-divider-line'),
  ).className('bw-divider');
}

function FooterLink() {
  return Box(
    Paragraph(
      'Already a member? ',
      Link('Sign In')
        .href('/login')
        .routerLink()
        .className('bw-forgot'),
    ),
  ).className('bw-footer-link');
}

function createPasswordVisibilityState(field) {
  const revealed = field.state('revealed', false);

  return {
    revealed,
    icon: computed(() => (revealed.get() ? EYE_CLOSED : EYE_OPEN)),
    inputType: computed(() => (revealed.get() ? 'text' : 'password')),
  };
}

function createPasswordStrengthState(passwordField, ctx) {
  const pulse = passwordField.state('strengthPulse', false);
  const lastScore = passwordField.state('strengthLast', -1);
  const strength = computed(() => {
    const value = passwordField.value.get() || '';
    return value.length ? getStrength(value) : 0;
  });
  let cancelPulse = null;

  ctx.cleanup(() => {
    cancelPulse?.();
  }, 'lifetime');

  ctx.watch(passwordField.value, (nextValue = '') => {
    const nextScore = nextValue.length ? getStrength(nextValue) : 0;
    if (nextScore === lastScore.get()) {
      return;
    }

    lastScore.set(nextScore);

    cancelPulse?.();

    pulse.set(true);
    cancelPulse = ctx.timeout(() => {
      pulse.set(false);
      cancelPulse = null;
    }, 260, 'lifetime');
  }, {
    immediate: false,
    scope: 'lifetime',
  });

  return {
    active: computed(() => strength.get() > 0),
    pulse,
    gradient: computed(() => STRENGTH_GRADIENTS[strength.get()]),
    glow: computed(() => STRENGTH_GLOWS[strength.get()]),
  };
}

const Register = page({
  name: 'Register',

  setup(ctx) {
    ensureGlobalStarfield();

    const particles = createParticles();

    const form = createForm({
      initial: {
        username: '',
        email: '',
        password: '',
        confirm: '',
        tos: false,
      },
      accepts: [
        {
          name: 'tos',
          message: 'You must accept the Terms of Service & Cookie Policy',
        },
      ],
      validate: validateRegister,
      submit: (values) => submitRegister(values, submitState, ctx),
    });

    const usernameField = form.field('username');
    const emailField = form.field('email');
    const passwordField = form.field('password');
    const confirmField = form.field('confirm');
    const tosField = form.field('tos');

    const submitState = {
      success: signal(false),
    };

    const submit = {
      ...submitState,
      label: computed(() => {
        if (submitState.success.get()) return '\u2726  Account Created  \u2726';
        if (form.submitting.get()) return '\u2726  Creating\u2026  \u2726';
        return 'Create Account';
      }),
      error: computed(() => form.submitError.get()?.message || ''),
    };

    const password = {
      visibility: createPasswordVisibilityState(passwordField),
      strength: createPasswordStrengthState(passwordField, ctx),
    };

    const confirm = {
      visibility: createPasswordVisibilityState(confirmField),
    };

    return setupState(
      {
        form,
        particles,
      },
      setupGroup('fields', {
        username: usernameField,
        email: emailField,
        password: passwordField,
        confirm: confirmField,
        tos: tosField,
      }),
      setupGroup('password', password),
      setupGroup('confirmState', confirm),
      setupGroup('submit', submit),
    );
  },

  render(ctx) {
    const {
      username: usernameField,
      email: emailField,
      password: passwordField,
      confirm: confirmField,
      tos: tosField,
    } = ctx.fields;

    return Box(
      Box().className('bw-glow-center'),
      ...ctx.particles.map(bloodwaveParticles),
      Box(
        Box(
          Box().className('bw-corner bw-corner--tl'),
          Box().className('bw-corner bw-corner--tr'),
          Box().className('bw-corner bw-corner--bl'),
          Box().className('bw-corner bw-corner--br'),
          Box(
            Box(
              Box().className('bw-ornament-line'),
              Box().className('bw-ornament-diamond'),
              Box().className('bw-ornament-line'),
            ).className('bw-ornament'),
            Title('Bloodwave').className('bw-title'),
            Subtitle('Join\u00A0\u00A0The\u00A0\u00A0Covenant').className('bw-subtitle'),
          ).className('bw-header'),
          Form(
            VStack(
              Box(
                Input()
                  .with(bloodwaveInput)
                  .id('rxName')
                  .field(usernameField)
                  .placeholder('your_username')
                  .autocomplete('username'),
                Box().with(bloodwaveFieldLine),
              )
                .with(bloodwaveFieldWrap)
                .with(bloodwaveField({
                  label: 'Username',
                  fieldId: 'rxName',
                  error: usernameField,
                })),
              Box(
                Input()
                  .with(bloodwaveInput)
                  .id('rxEmail')
                  .field(emailField)
                  .type('email')
                  .placeholder('your@email.com')
                  .autocomplete('email'),
                Box().with(bloodwaveFieldLine),
              )
                .with(bloodwaveFieldWrap)
                .with(bloodwaveField({
                  label: 'Email Address',
                  fieldId: 'rxEmail',
                  error: emailField,
                })),
              Box(
                Input()
                  .with(bloodwavePasswordInput)
                  .id('rxPassword')
                  .field(passwordField)
                  .type(() => ctx.password.visibility.inputType.get())
                  .ariaInvalid(() => passwordField.invalid.get())
                  .onEscape(() => ctx.password.visibility.revealed.set(false)),
                PasswordToggle({
                  revealed: ctx.password.visibility.revealed,
                  iconMarkup: () => ctx.password.visibility.icon.get(),
                  label: 'Toggle password visibility',
                }),
                PasswordStrengthLine(ctx.password.strength),
              )
                .with(bloodwaveFieldWrap)
                .with(bloodwaveField({
                  label: 'Password',
                  fieldId: 'rxPassword',
                  error: passwordField,
                })),
              Box(
                Input()
                  .with(bloodwavePasswordInput)
                  .id('rxConfirm')
                  .field(confirmField)
                  .type(() => ctx.confirmState.visibility.inputType.get())
                  .ariaInvalid(() => confirmField.invalid.get())
                  .onEscape(() => ctx.confirmState.visibility.revealed.set(false)),
                PasswordToggle({
                  revealed: ctx.confirmState.visibility.revealed,
                  iconMarkup: () => ctx.confirmState.visibility.icon.get(),
                  label: 'Toggle confirm password visibility',
                }),
                Box().with(bloodwaveFieldLine),
              )
                .with(bloodwaveFieldWrap)
                .with(bloodwaveField({
                  label: 'Confirm Password',
                  fieldId: 'rxConfirm',
                  error: confirmField,
                  className: 'bw-field bw-field--confirm',
                  margin: { bottom: 'clamp(10px, 2vw, 14px)' },
                })),
              TermsField(tosField),
              Paragraph()
                .className('bw-error')
                .text(() => ctx.submit.error.get())
                .showWhen(() => ctx.submit.error.get())
                .textAlign('center')
                .margin({ top: '0', bottom: '14px' }),
              SubmitButton(
                ctx.form,
                Box().className('bw-btn-shimmer'),
                Box().className('bw-btn-text').text(() => ctx.submit.label.get()),
              )
                .className('bw-btn')
                .className({ success: () => ctx.submit.success.get() })
                .id('rxBtn'),
              Divider(),
              FooterLink(),
            ),
          )
            .form(ctx.form)
            .className('bw-form')
            .id('rxForm'),
        ).className('bw-card-inner'),
      ).className('bw-card'),
    ).className('bw-root');
  },
});

export default Register;
