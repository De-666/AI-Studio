/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        leonardo: {
          bg: "#0a0a0f",
          panel: "#14141c",
          card: "#1c1c26",
          border: "#252535",
          muted: "#8b8ba7",
          primary: "#7c5cff",
          primaryHover: "#6a4de6",
          accent: "#00d9ff"
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace']
      }
    },
  },
  plugins: [],
}
