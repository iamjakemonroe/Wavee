/** @type {import('tailwindcss').Config} */
const token = (name) => `rgb(var(--${name}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: token('bg'),
        surface: token('surface'),
        raised: token('raised'),
        line: token('line'),
        ink: token('ink'),
        muted: token('muted'),
        faint: token('faint'),
        teal: token('teal'),
        violet: token('violet'),
        danger: token('danger'),
        warn: token('warn'),
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'ui-sans-serif', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['11px', '15px'],
      },
      borderRadius: {
        '4xl': '28px',
      },
      boxShadow: {
        glow: '0 20px 60px -20px rgb(var(--violet) / 0.55)',
        'glow-teal': '0 18px 50px -18px rgb(var(--teal) / 0.55)',
        lift: '0 24px 60px -24px rgba(0, 0, 0, 0.85)',
      },
      backgroundImage: {
        brand: 'linear-gradient(115deg, rgb(var(--teal)), rgb(var(--violet)))',
      },
      transitionTimingFunction: {
        out: 'cubic-bezier(0.2, 0.7, 0.1, 1)',
      },
      keyframes: {
        eq: {
          '0%, 100%': { transform: 'scaleY(0.35)' },
          '50%': { transform: 'scaleY(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        eq: 'eq 0.9s ease-in-out infinite',
        shimmer: 'shimmer 1.6s infinite',
        rise: 'rise 0.5s cubic-bezier(0.2, 0.7, 0.1, 1) both',
      },
    },
  },
  plugins: [],
};
