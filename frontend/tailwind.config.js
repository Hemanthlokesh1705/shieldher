/** @type {import('tailwindcss').Config} */

// Each color reads a CSS variable and falls back to the Mist Alabaster and Forest Pine palette.
// The interface stays light regardless of OS theme.
// <alpha-value> keeps opacity modifiers available on the palette tokens.
const c = (name, fallback) => `rgb(var(--c-${name}, ${fallback}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: c("canvas", "244 244 237"),
          ivory: c("canvas", "244 244 237"),
          pearl: c("canvas-pearl", "255 254 250"),
          subtle: c("canvas-subtle", "248 248 242"),
          sand: c("canvas-sand", "226 228 218"),
        },
        surface: {
          DEFAULT: c("surface", "255 254 250"),
          pearl: c("surface", "255 254 250"),
          card: c("surface", "255 254 250"),
          subtle: c("surface-subtle", "248 248 242"),
          secondary: c("surface-secondary", "248 248 242"),
          tertiary: c("surface-tertiary", "244 244 237"),
          tint: c("surface-tint", "241 244 234"),
        },
        brand: {
          forest: c("brand-forest", "36 74 56"),
          DEFAULT: c("brand-forest", "36 74 56"),
          rich: c("brand-rich", "79 105 88"),
          hover: c("brand-hover", "26 60 41"),
          border: c("brand-border", "215 220 207"),
        },
        ink: {
          DEFAULT: c("ink", "32 53 42"),
          primary: c("ink", "32 53 42"),
          secondary: c("ink-secondary", "83 102 90"),
          muted: c("ink-muted", "83 102 90"),
          subtle: c("ink-subtle", "83 102 90"),
          border: c("ink-border", "215 220 207"),
          borderStrong: c("ink-border-strong", "79 105 88"),
        },
        action: {
          DEFAULT: c("action-primary", "231 184 92"),
          hover: c("action-hover", "214 164 67"),
          ink: c("action-ink", "43 38 25"),
        },
        status: {
          success: c("status-success", "47 107 78"),
          successBg: c("status-success-bg", "237 244 236"),
          successBorder: c("status-success-border", "207 224 209"),
          warning: c("status-warning", "128 80 10"),
          warningBg: c("status-warning-bg", "251 241 220"),
          warningBorder: c("status-warning-border", "234 215 170"),
          error: c("status-error", "157 58 50"),
          errorBg: c("status-error-bg", "249 235 232"),
          errorBorder: c("status-error-border", "233 201 196"),
          info: c("status-info", "36 74 56"),
          infoBg: c("status-info-bg", "241 244 234"),
          infoBorder: c("status-info-border", "215 220 207"),
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
        subtle: "0 1px 2px rgb(var(--c-shadow, 32 53 42) / 0.03), 0 1px 1px rgb(var(--c-shadow, 32 53 42) / 0.02)",
        card: "0 2px 8px -2px rgb(var(--c-shadow, 32 53 42) / 0.05), 0 1px 3px -1px rgb(var(--c-shadow, 32 53 42) / 0.03)",
        elevated: "0 8px 24px -4px rgb(var(--c-shadow, 32 53 42) / 0.07), 0 4px 10px -2px rgb(var(--c-shadow, 32 53 42) / 0.03)",
        popover: "0 16px 36px -6px rgb(var(--c-shadow, 32 53 42) / 0.1), 0 6px 14px -3px rgb(var(--c-shadow, 32 53 42) / 0.04)",
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