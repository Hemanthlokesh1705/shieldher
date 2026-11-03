/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: "#F7F6F2", // Warm ivory
          ivory: "#F7F6F2",
          pearl: "#FFFFFF",
          subtle: "#F2EFEB",
          sand: "#EAE5DA", // Soft sand
        },
        surface: {
          DEFAULT: "#FFFFFF", // Soft pearl
          pearl: "#FFFFFF",
          card: "#FFFFFF",
          subtle: "#FAF9F5",
          secondary: "#F4F1EC",
          tertiary: "#EAE5DA",
          tint: "#F0F5F3",
        },
        brand: {
          forest: "#145B53", // Deep forest teal
          DEFAULT: "#145B53",
          rich: "#19796D",   // Rich teal
          sage: "#DCEAE3",   // Muted sage
          hover: "#0F4640",
          light: "#EAF3EF",
          border: "#C5DCD2",
        },
        ink: {
          DEFAULT: "#192B29", // Dark ink
          primary: "#192B29",
          slate: "#53615E",   // Slate
          secondary: "#53615E",
          muted: "#89938F",   // Muted grey
          subtle: "#B0B8B5",
          border: "#E2DDD5",
          borderStrong: "#CBC4B9",
        },
        accent: {
          coral: "#C77D70",   // Muted coral
          gold: "#C29A59",    // Warm gold
          bluegrey: "#E6ECEB",// Soft blue-grey
          coralSoft: "#F9ECE9",
          goldSoft: "#F9F4EB",
        },
        status: {
          success: "#1F7A59",
          successBg: "#EDF7F2",
          successBorder: "#C8E8D8",
          warning: "#A4742C",
          warningBg: "#FDF8EE",
          warningBorder: "#EEDDBB",
          error: "#B84A3E",
          errorBg: "#FDF2F0",
          errorBorder: "#F3CAC4",
          info: "#2C6E80",
          infoBg: "#EEF6F8",
          infoBorder: "#CBE4EC",
        },
      },
      fontFamily: {
        sans: [
          '"Plus Jakarta Sans"',
          '"DM Sans"',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        heading: [
          '"Plus Jakarta Sans"',
          'sans-serif',
        ],
        editorial: [
          '"Newsreader"',
          'Georgia',
          'serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'Consolas',
          'monospace',
        ],
      },
      fontSize: {
        'hero': ['3rem', { lineHeight: '1.15', letterSpacing: '-0.03em' }],      // 48px
        'page': ['2.125rem', { lineHeight: '1.2', letterSpacing: '-0.025em' }],  // 34px
        'section': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.02em' }], // 24px
        'card': ['1.125rem', { lineHeight: '1.4', letterSpacing: '-0.01em' }],   // 18px
        'body': ['0.9375rem', { lineHeight: '1.6' }],                           // 15px
        'small': ['0.8125rem', { lineHeight: '1.5' }],                          // 13px
        'label': ['0.6875rem', { lineHeight: '1.4', letterSpacing: '0.06em' }], // 11px
      },
      boxShadow: {
        subtle: "0 1px 2px rgba(25, 43, 41, 0.03), 0 1px 1px rgba(25, 43, 41, 0.02)",
        card: "0 2px 8px -2px rgba(25, 43, 41, 0.05), 0 1px 3px -1px rgba(25, 43, 41, 0.03)",
        elevated: "0 8px 24px -4px rgba(25, 43, 41, 0.07), 0 4px 10px -2px rgba(25, 43, 41, 0.03)",
        popover: "0 16px 36px -6px rgba(25, 43, 41, 0.1), 0 6px 14px -3px rgba(25, 43, 41, 0.04)",
      },
      borderRadius: {
        sm: "0.4375rem",  // 7px
        DEFAULT: "0.625rem", // 10px
        card: "0.875rem",    // 14px
        panel: "1.125rem",   // 18px
      },
    },
  },
  plugins: [],
};
