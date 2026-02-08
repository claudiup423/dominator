/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        dom: {
          base: '#0B0D12',
          surface: '#111522',
          elevated: '#1A1F2E',
          border: '#252B3B',
          'border-subtle': '#1E2433',
          muted: '#6B7280',
          text: '#E5E7EB',
          heading: '#F9FAFB',
          accent: '#00D4FF',
          'accent-glow': 'rgba(0, 212, 255, 0.15)',
          'accent-dim': '#0099BB',
          green: '#22C55E',
          'green-dim': 'rgba(34, 197, 94, 0.15)',
          red: '#EF4444',
          'red-dim': 'rgba(239, 68, 68, 0.15)',
          yellow: '#F59E0B',
          'yellow-dim': 'rgba(245, 158, 11, 0.15)',
          purple: '#A855F7',
          'purple-dim': 'rgba(168, 85, 247, 0.15)',
        },
      },
      fontFamily: {
        sans: ['var(--font-body)', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
      },
      boxShadow: {
        'glow-accent': '0 0 20px rgba(0, 212, 255, 0.15)',
        'glow-green': '0 0 20px rgba(34, 197, 94, 0.15)',
        'glow-red': '0 0 20px rgba(239, 68, 68, 0.15)',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'glass-border': 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
      },
      animation: {
        'fade-in': 'fadeIn 150ms ease-out',
        'slide-up': 'slideUp 200ms ease-out',
        'pulse-slow': 'pulse 3s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};
