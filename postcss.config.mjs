// Tailwind 4 writes modern CSS (cascade layers, `@media (width >= 40rem)`) that older phone
// browsers ignore completely — the page then looks blank or broken (Chrome < 99/104, Samsung
// Internet < 18, iOS < 15.4). The two plugins after Tailwind rewrite those into plain CSS that
// every browser understands, with the same result on new browsers.
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
    "@csstools/postcss-cascade-layers": {},
    "postcss-media-minmax": {},
  },
};

export default config;
