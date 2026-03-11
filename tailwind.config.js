/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
        sidebar: '#252526',
        header: '#2d2d2d',
        border: '#3e3e3e',
        accent: '#007acc',
        error: '#f44336',
      },
      fontFamily: {
        mono: ['Consolas', '"Courier New"', 'monospace'],
      },
    },
  },
  plugins: [],
}




