/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: {
        "2xl": "1440px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Security Status Tokens
        allow: {
          DEFAULT: "hsl(var(--status-allow))",
          foreground: "hsl(var(--status-allow-foreground))",
          border: "hsl(var(--status-allow-border))",
        },
        deny: {
          DEFAULT: "hsl(var(--status-deny))",
          foreground: "hsl(var(--status-deny-foreground))",
          border: "hsl(var(--status-deny-border))",
        },
        warning: {
          DEFAULT: "hsl(var(--status-warning))",
          foreground: "hsl(var(--status-warning-foreground))",
          border: "hsl(var(--status-warning-border))",
        },
        blocked: {
          DEFAULT: "hsl(var(--status-blocked))",
          foreground: "hsl(var(--status-blocked-foreground))",
          border: "hsl(var(--status-blocked-border))",
        },
      },
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "4px",
        md: "6px",
        lg: "8px",
        xl: "10px",
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "'Segoe UI'",
          "Roboto",
          "sans-serif",
        ],
        mono: [
          "'IBM Plex Mono'",
          "'JetBrains Mono'",
          "'Geist Mono'",
          "'Fira Code'",
          "Menlo",
          "monospace",
        ],
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
  ],
}
