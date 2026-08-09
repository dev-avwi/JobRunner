/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        // Exact match to web app's dark theme (from client/src/index.css)
        background: "#141820", // hsl(220 15% 8%)
        foreground: "#f0f3f5", // hsl(210 20% 95%)
        
        card: {
          DEFAULT: "#1c2129", // hsl(220 15% 11%)
          foreground: "#f0f3f5",
        },
        
        primary: {
          DEFAULT: "#E8862E", // Orange accent (trade color)
          foreground: "#ffffff",
        },
        
        secondary: {
          DEFAULT: "#282d38", // hsl(220 15% 16%)
          foreground: "#f0f3f5",
        },
        
        muted: {
          DEFAULT: "#21262f", // hsl(220 15% 13%)
          foreground: "#9ca3af", // hsl(220 10% 65%)
        },
        
        accent: {
          DEFAULT: "#2a303c", // hsl(220 13% 18%)
          foreground: "#f0f3f5",
        },
        
        destructive: {
          DEFAULT: "#ef4444", // hsl(5 85% 55%)
          foreground: "#ffffff",
        },
        
        success: {
          DEFAULT: "#22c55e", // hsl(145 65% 45%)
          foreground: "#ffffff",
        },
        
        warning: {
          DEFAULT: "#f59e0b", // hsl(35 90% 55%)
          foreground: "#0a0a0a",
        },
        
        info: {
          DEFAULT: "#3b82f6", // hsl(210 80% 52%)
          foreground: "#ffffff",
        },
        
        border: "#262b36", // hsl(220 13% 15%)
        input: "#3d4555", // hsl(220 13% 35%)
        ring: "#f0f3f5",
        
        // Trade theme color (matches primary)
        trade: "#E8862E",
        
        // Sidebar colors (for any side navigation)
        sidebar: {
          DEFAULT: "#181c24", // hsl(220 15% 9%)
          foreground: "#f0f3f5",
          border: "#282d38",
          primary: "#f0f3f5",
          "primary-foreground": "#141820",
          accent: "#232836",
          "accent-foreground": "#f0f3f5",
        },
      },
      fontFamily: {
        sans: ["Inter", "System"],
      },
      borderRadius: {
        lg: "8px", // Match web's --radius: 0.5rem
        xl: "12px",
        "2xl": "16px",
      },
    },
  },
  plugins: [],
};
