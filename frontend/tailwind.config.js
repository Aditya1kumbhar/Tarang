/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        ocean: {
          950: '#060c18',
          900: '#0a1324',
          850: '#0e1a33',
          800: '#132344',
          700: '#1b3260',
          600: '#274b8f',
        },
        cyan: {
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
        },
        // Drafted Nautical Sea-Chart Theme Tokens (Anti-glare sunlight & projector legible)
        paper: {
          50: '#FBF7ED',
          100: '#F5EEDD',
          200: '#EFE6CF',
          300: '#DFD3B6',
        },
        ink: {
          900: '#12212D',
          800: '#1B2F3E',
          700: '#263B4D',
          500: '#42596D',
          400: '#5A6F81',
        },
        chart: {
          500: '#2A7391',
          600: '#205B73',
        },
        signal: {
          600: '#C7442E',
        },
        risk: {
          low: '#1D7A50',
          moderate: '#A17000',
          high: '#BF4E12',
          extreme: '#AF2318',
        },
      },
      animation: {
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'ping-slow': 'ping 2s cubic-bezier(0, 0, 0.2, 1) infinite',
      },
    },
  },
  plugins: [],
}
