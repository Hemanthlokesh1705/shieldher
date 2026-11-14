/** @type {import('tailwindcss').Config} */

// Each color reads a CSS variable and falls back to the cream-and-teal palette.
// The interface stays light regardless of OS theme.
// <alpha-value> keeps opacity modifiers available on the palette tokens.
const c = (name, fallback) => `rgb(var(--c-${name}, ${fallback}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: c("canvas", "241 238 232"),
          ivory: c("canvas", "241 238 232"),
          pearl: c("canvas-pearl", "255 255 255"),
          subtle: c("canvas-subtle", "250 248 245"),
          sand: c("canvas-sand", "221 215 204"),
        },
        surface: {
          DEFAULT: c("surface", "255 255 255"),
          pearl: c("surface", "255 255 255"),
          card: c("surface", "255 255 255"),
          subtle: c("surface-subtle", "250 248 245"),
          secondary: c("surface-secondary", "250 248 245"),
          tertiary: c("surface-tertiary", "241 238 232"),
          tint: c("surface-tint", "250 248 245"),
        },
        brand: {
          forest: c("brand-forest", "14 79 74"),
          DEFAULT: c("brand-forest", "14 79 74"),
          rich: c("brand-rich", "66 99 96"),
          hover: c("brand-hover", "10 60 56"),
          border: c("brand-border", "221 215 204"),
        },
        ink: {
          DEFAULT: c("ink", "14 79 74"),
          primary: c("ink", "14 79 74"),
          secondary: c("ink-secondary", "66 99 96"),
          muted: c("ink-muted", "66 99 96"),
          subtle: c("ink-subtle", "66 99 96"),
          border: c("ink-border", "221 215 204"),
          borderStrong: c("ink-border-strong", "66 99 96"),
        },
        action: {
          DEFAULT: c("action-primary", "255 111 94"),
          hover: c("action-hover", "244 95 80"),
          ink: c("action-ink", "9 47 45"),
        },
        status: {
          success: c("status-success", "14 79 74"),
          successBg: c("status-success-bg", "250 248 245"),
          successBorder: c("status-success-border", "221 215 204"),
          warning: c("status-warning", "66 99 96"),
          warningBg: c("status-warning-bg", "250 248 245"),
          warningBorder: c("status-warning-border", "221 215 204"),
          error: c("status-error", "14 79 74"),
          errorBg: c("status-error-bg", "250 248 245"),
          errorBorder: c("status-error-border", "221 215 204"),
          info: c("status-info", "14 79 74"),
          infoBg: c("status-info-bg", "250 248 245"),
          infoBorder: c("status-info-border", "221 215 204"),
        },
      },
      fontFamily: {
        sans: ['"Inter"', '"Segoe UI"', "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        heading: ['"Inter"', '"Segoe UI"', "sans-serif"],
        editorial: ['"Newsreader"', "Georgia", "serif"],
        mono: ['"JetBrains Mono"', "Consolas", "monospace"],
      },
      fontSize: {
        hero: ["3rem", { lineHeight: "1.15", letterSpacing: "-0.03em" }],
        page: ["2.125rem", { lineHeight: "1.2", letterSpacing: "-0.025em" }],
        section: ["1.5rem", { lineHeight: "1.3", letterSpacing: "-0.02em" }],
        card: ["1.125rem", { lineHeight: "1.4", letterSpacing: "-0.01em" }],
        body: ["0.9375rem", { lineHeight: "1.6" }],
        small: ["0.8125rem", { lineHeight: "1.5" }],
        label: ["0.6875rem", { lineHeight: "1.4", letterSpacing: "0.06em" }],
      },
      boxShadow: {
        subtle: "0 1px 2px rgb(var(--c-shadow, 14 79 74) / 0.03), 0 1px 1px rgb(var(--c-shadow, 14 79 74) / 0.02)",
        card: "0 2px 8px -2px rgb(var(--c-shadow, 14 79 74) / 0.05), 0 1px 3px -1px rgb(var(--c-shadow, 14 79 74) / 0.03)",
        elevated: "0 8px 24px -4px rgb(var(--c-shadow, 14 79 74) / 0.07), 0 4px 10px -2px rgb(var(--c-shadow, 14 79 74) / 0.03)",
        popover: "0 16px 36px -6px rgb(var(--c-shadow, 14 79 74) / 0.1), 0 6px 14px -3px rgb(var(--c-shadow, 14 79 74) / 0.04)",
      },
      borderRadius: {
        sm: "0.4375rem",
        DEFAULT: "0.625rem",
        card: "0.75rem",
        panel: "0.875rem",
      },
    },
  },
  plugins: [],
};