/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        "soft-beige": "#F2EDE8",
        "warm-sand": "#E7D8C9",
        "sage-green": "#C7D2C0",
        "dark-sage": "#5A6E6C",
        mocha: "#A1806F",
        charcoal: "#3E3E3E",
        "charcoal-gray": "#3E3E3E", // Alias for backward compatibility
        "off-white": "#FAF9F7",
      },
    },
  },
  plugins: [],
};
