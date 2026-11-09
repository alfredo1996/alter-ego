import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Alter Ego — Personal Finance",
    short_name: "Alter Ego",
    description: "Personal finance management with optional AI assistance",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#111111",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon", sizes: "192x192", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Add Transaction", short_name: "Add", url: "/transactions?new=1" },
      { name: "Dashboard", short_name: "Dashboard", url: "/dashboard" },
    ],
  }
}
