import type { MetadataRoute } from "next"

// Lets members "Add to Home screen" and open the samiti like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "পূর্ব বামন সুন্দর সমমনা সমবায় সমিতি",
    short_name: "সমিতি",
    description: "সমিতির হিসাব — মীরসরাই, চট্টগ্রাম",
    lang: "bn",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#1d3f57",
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
