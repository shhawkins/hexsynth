/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'hex-bg': '#0a0a0f', // Deep dark blue-black
        'hex-panel': 'rgba(20, 20, 30, 0.75)', // Glassier
        'hex-border': 'rgba(100, 120, 150, 0.25)',
        'hex-accent': '#00f2ff', // Bright Cyan
        'hex-secondary': '#ff0055', // Vibrant Pink
        'hex-tertiary': '#ccff00', // Acid Green
        'hex-text': '#ffffff',
        'hex-text-dim': '#94a3b8',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Menlo', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'glow': '0 0 20px rgba(0, 242, 255, 0.3), 0 0 40px rgba(0, 242, 255, 0.1)', // Restored medium glow
        'glow-sm': '0 0 10px rgba(0, 242, 255, 0.2)',
        'glow-pink': '0 0 20px rgba(255, 0, 85, 0.3)',
        'panel': '0 8px 32px rgba(0, 0, 0, 0.5), inset 0 0 0 1px rgba(255, 255, 255, 0.05)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'shimmer': 'shimmer 3s linear infinite',
      },
      keyframes: {
        'fadeIn': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '200% 0' },
          '100%': { backgroundPosition: '-200% 0' },
        }
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
      },
    },
  },
  plugins: [],
}