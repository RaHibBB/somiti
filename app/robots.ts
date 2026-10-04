import type { MetadataRoute } from "next"

// The accounts are open to anyone with the link, but they shouldn't show up in search engines.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } }
}
