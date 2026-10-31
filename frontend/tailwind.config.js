/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Geist Sans"', 'var(--font-geist-sans)', 'system-ui', '-apple-system', 'BlinkMacSystemFont', "'Segoe UI'", 'sans-serif'],
        mono: ['"Geist Mono"', 'var(--font-geist-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      fontWeight: {
        normal: '400',
        book: '450',
        medium: '500',
        semibold: '600',
        bold: '700',
      },
      letterSpacing: {
        hero: '-0.055em',
        section: '-0.04em',
        subheading: '-0.02em',
        body: '-0.01em',
        nav: '-0.01em',
        button: '-0.01em',
        meta: '0.02em',
      },
      lineHeight: {
        hero: '1.02',
        section: '1.08',
        subheading: '1.3',
        body: '1.65',
      },
      colors: {
        orca: {
          bg: 'var(--color-bg)',
          surface: 'var(--color-surface)',
          'surface-subtle': 'var(--color-surface-subtle)',
          'surface-elevated': 'var(--color-surface-elevated)',
          border: 'var(--color-border)',
          'border-subtle': 'var(--color-border-subtle)',
          text: 'var(--color-text)',
          'text-secondary': 'var(--color-text-secondary)',
          'text-muted': 'var(--color-text-muted)',
          accent: 'var(--color-accent)',
          'accent-hover': 'var(--color-accent-hover)',
          focus: 'var(--color-focus)',
          warning: 'var(--color-warning)',
          danger: 'var(--color-danger)',
          success: 'var(--color-success)',
        },
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
        // Apple-inspired minimalist obsidian and typography tokens
        apple: {
          black: '#000000',
          dark: '#0a0a0c',
          card: '#141417',
          surface: '#1c1c20',
          border: 'rgba(255, 255, 255, 0.08)',
          subtext: '#86868b',
          blue: '#2997ff',
          hover: 'rgba(255, 255, 255, 0.04)',
          light: '#f5f5f7',
          lightCard: '#ffffff',
          lightBorder: 'rgba(0, 0, 0, 0.08)',
          lightSubtext: '#6e6e73',
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
          600: '#1F5B73',
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
