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
        // Cybersecurity Brand Tokens
        orange: {
          DEFAULT: "#FF6A24",
          light: "#FF8A42",
          dark: "#E05514",
          glow: "rgba(255, 106, 36, 0.18)",
        },
        amber: {
          DEFAULT: "#F5B544",
          light: "#FCD34D",
          dark: "#D97706",
        },
        // Smoked Glass Surfaces
        glass: {
          base: "rgba(13, 16, 21, 0.85)",
          smoked: "rgba(24, 28, 36, 0.72)",
          elevated: "rgba(32, 36, 46, 0.76)",
          border: "rgba(255, 255, 255, 0.09)",
          borderStrong: "rgba(255, 255, 255, 0.16)",
          borderOrange: "rgba(255, 106, 36, 0.35)",
        },
      },
      borderRadius: {
        none: "0",
        sm: "2px",
        DEFAULT: "4px",
        md: "6px",
        lg: "8px",
        xl: "12px",
        "2xl": "16px",
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
          "'JetBrains Mono'",
          "'IBM Plex Mono'",
          "'Geist Mono'",
          "'Fira Code'",
          "Menlo",
          "monospace",
        ],
      },
      boxShadow: {
        "orange-glow": "0 0 24px -4px rgba(255, 106, 36, 0.35)",
        "orange-sm": "0 0 12px -2px rgba(255, 106, 36, 0.25)",
        "glass-panel": "0 8px 32px 0 rgba(0, 0, 0, 0.37)",
      },
    },
  },
  plugins: [
    require("tailwindcss-animate"),
  ],
}
