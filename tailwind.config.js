import scrollbar from 'tailwind-scrollbar';

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./app.jsx", "./main.jsx"],
  theme: {
    extend: {},
  },
  plugins: [scrollbar],
};
