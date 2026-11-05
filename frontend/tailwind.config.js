/** @type {import('tailwindcss').Config} */

// Each color reads a CSS variable (space-separated RGB channels) and falls back
// to the original light value. `.theme-dark` in src/theme.css overrides the
// variables, so the same classes (bg-canvas, text-ink...) switch palettes.
// <alpha-value> keeps opacity utilities such as bg-brand-sage/40 working.
const c = (name, fallback) => `rgb(var(--c-${name}, ${fallback}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: c("canvas", "247 246 242"),
          ivory: c("canvas", "247 246 242"),
          pearl: c("canvas-pearl", "255 255 255"),
          subtle: c("canvas-subtle", "242 239 235"),
          sand: c("canvas-sand", "234 229 218"),
        },
        surface: {
          DEFAULT: c("surface", "255 255 255"),
          pearl: c("surface", "255 255 255"),
          card: c("surface", "255 255 255"),
          subtle: c("surface-subtle", "250 249 245"),
          secondary: c("surface-secondary", "244 241 236"),
          tertiary: c("surface-tertiary", "234 229 218"),
          tint: c("surface-tint", "240 245 243"),
        },
        brand: {
          forest: c("brand-forest", "20 91 83"),
          DEFAULT: c("brand-forest", "20 91 83"),
          rich: c("brand-rich", "25 121 109"),
          sage: c("brand-sage", "220 234 227"),
          hover: c("brand-hover", "15 70 64"),
          light: c("brand-light", "234 243 239"),
          border: c("brand-border", "197 220 210"),
        },
        ink: {
          DEFAULT: c("ink", "25 43 41"),
          primary: c("ink", "25 43 41"),
          slate: c("ink-secondary", "83 97 94"),
          secondary: c("ink-secondary", "83 97 94"),
          muted: c("ink-muted", "137 147 143"),
          subtle: c("ink-subtle", "176 184 181"),
          border: c("ink-border", "226 221 213"),
          borderStrong: c("ink-border-strong", "203 196 185"),
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
        sans: ['"Plus Jakarta Sans"', '"DM Sans"', "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        heading: ['"Plus Jakarta Sans"', "sans-serif"],
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
        card: "0.875rem",
        panel: "1.125rem",
      },
    },
  },
  plugins: [],
};