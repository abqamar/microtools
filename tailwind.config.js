/** @type {import('tailwindcss').Config} */

// Navy-tinted neutrals. Replaces Tailwind's zinc so every existing `zinc-*` class picks up the new palette.
const navy = {
  50: '#F6F8FC', 100: '#EDF1F8', 200: '#DCE3F0', 300: '#C1CADF', 400: '#8A96B4', 500: '#62708F',
  600: '#475373', 700: '#2B3555', 800: '#1B2440', 900: '#111A2E', 950: '#0A0F1E'
};
// Electric blue accent. Replaces indigo for the same reason; violet is used alongside it in gradients.
const brand = {
  50: '#EEF4FF', 100: '#DBE7FF', 200: '#BCD3FF', 300: '#8FB4FD', 400: '#6390FA', 500: '#4277F6',
  600: '#2F5FEA', 700: '#274CC9', 800: '#2541A0', 900: '#243B7E', 950: '#1A254D'
};

module.exports = {
  // Every file that contains Tailwind class names, including class strings built in JS.
  content: ['./*.html', './tools/*.html', './flutter/*.html', './src/**/*.{html,js,mjs}', './scripts/**/*.mjs'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: { zinc: navy, indigo: brand },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Inter', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'JetBrains Mono', 'Menlo', 'Consolas', 'monospace']
      },
      keyframes: {
        'fade-up': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': { from: { opacity: '0', transform: 'scale(.97) translateY(-4px)' }, to: { opacity: '1', transform: 'none' } },
        pop: { '0%': { transform: 'scale(1)' }, '40%': { transform: 'scale(1.08)' }, '100%': { transform: 'scale(1)' } },
        drift: { '0%,100%': { transform: 'translate3d(0,0,0)' }, '50%': { transform: 'translate3d(2%,3%,0)' } }
      },
      animation: {
        'fade-up': 'fade-up .45s cubic-bezier(.2,.7,.2,1) both',
        'fade-in': 'fade-in .3s ease-out both',
        'scale-in': 'scale-in .18s cubic-bezier(.2,.7,.2,1) both',
        pop: 'pop .35s ease-out',
        drift: 'drift 24s ease-in-out infinite'
      }
    }
  },
  plugins: [require('@tailwindcss/typography')]
};
