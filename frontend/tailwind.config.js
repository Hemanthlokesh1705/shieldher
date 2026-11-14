/** @type {import('tailwindcss').Config} */

// Each color reads a CSS variable (space-separated RGB channels) and falls back
// to the warm light palette. The interface stays light regardless of OS theme.
// <alpha-value> keeps opacity utilities such as bg-brand-sage/40 working.
const c = (name, fallback) => `rgb(var(--c-${name}, ${fallback}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: c("canvas", "250 249 246"),
          ivory: c("canvas", "250 249 246"),
          pearl: c("canvas-pearl", "255 255 255"),
          subtle: c("canvas-subtle", "248 250 252"),
          sand: c("canvas-sand", "241 241 236"),
        },
        surface: {
          DEFAULT: c("surface", "255 255 255"),
          pearl: c("surface", "255 255 255"),
          card: c("surface", "255 255 255"),
          subtle: c("surface-subtle", "248 250 252"),
          secondary: c("surface-secondary", "248 250 252"),
          tertiary: c("surface-tertiary", "241 241 236"),
          tint: c("surface-tint", "232 240 235"),
        },
        brand: {
          forest: c("brand-forest", "46 111 94"),
          DEFAULT: c("brand-forest", "46 111 94"),
          rich: c("brand-rich", "59 122 107"),
          sage: c("brand-sage", "232 240 235"),
          hover: c("brand-hover", "36 91 77"),
          light: c("brand-light", "232 240 235"),
          border: c("brand-border", "198 217 206"),
        },
        ink: {
          DEFAULT: c("ink", "30 41 59"),
          primary: c("ink", "30 41 59"),
          slate: c("ink-secondary", "71 85 105"),
          secondary: c("ink-secondary", "71 85 105"),
          muted: c("ink-muted", "100 116 139"),
          subtle: c("ink-subtle", "100 116 139"),
          border: c("ink-border", "226 232 240"),
          borderStrong: c("ink-border-strong", "203 213 225"),
        },
        accent: {
          coral: c("accent-coral", "199 125 112"),
          gold: c("accent-gold", "194 154 89"),
          bluegrey: c("accent-bluegrey", "230 236 235"),
          coralSoft: c("accent-coral-soft", "249 236 233"),
          goldSoft: c("accent-gold-soft", "249 244 235"),
        },
        status: {
          success: c("status-success", "31 122 89"),
          successBg: c("status-success-bg", "237 247 242"),
          successBorder: c("status-success-border", "200 232 216"),
          warning: c("status-warning", "164 116 44"),
          warningBg: c("status-warning-bg", "253 248 238"),
          warningBorder: c("status-warning-border", "238 221 187"),
          error: c("status-error", "184 74 62"),
          errorBg: c("status-error-bg", "253 242 240"),
          errorBorder: c("status-error-border", "243 202 196"),
          info: c("status-info", "44 110 128"),
          infoBg: c("status-info-bg", "238 246 248"),
          infoBorder: c("status-info-border", "203 228 236"),
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
        subtle: "0 1px 2px rgb(var(--c-shadow, 25 43 41) / 0.03), 0 1px 1px rgb(var(--c-shadow, 25 43 41) / 0.02)",
        card: "0 2px 8px -2px rgb(var(--c-shadow, 25 43 41) / 0.05), 0 1px 3px -1px rgb(var(--c-shadow, 25 43 41) / 0.03)",
        elevated: "0 8px 24px -4px rgb(var(--c-shadow, 25 43 41) / 0.07), 0 4px 10px -2px rgb(var(--c-shadow, 25 43 41) / 0.03)",
        popover: "0 16px 36px -6px rgb(var(--c-shadow, 25 43 41) / 0.1), 0 6px 14px -3px rgb(var(--c-shadow, 25 43 41) / 0.04)",
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