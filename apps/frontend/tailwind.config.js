/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      },
      colors: {
        wavee: {
          bg: "#0B0B0F",
          "bg-light": "#12121A",
          primary: "#00D1A0",
          "primary-dim": "#00B88D",
          secondary: "#7C5CFF",
          "secondary-dim": "#6A4DE0",
          text: "#FFFFFF",
          muted: "#71717A",
          surface: "#161620",
          "surface-light": "#1E1E2A",
          border: "#2A2A36",
          danger: "#EF4444",
          warning: "#F59E0B",
        },
      },
      boxShadow: {
        glow: "0 0 30px rgba(124, 92, 255, 0.2)",
        "glow-lg": "0 0 60px rgba(124, 92, 255, 0.3)",
        neon: "0 0 20px rgba(0, 209, 160, 0.2)",
        "neon-lg": "0 0 26px rgba(0, 209, 160, 0.22)",
      },
      backgroundImage: {
        "wavee-gradient":
          "radial-gradient(ellipse at top right, rgba(124,92,255,0.12), transparent 50%)",
      },
      animation: {
        "pulse-glow": "pulse-glow 2s ease-in-out infinite",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "0.4" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
