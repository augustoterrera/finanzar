import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    background_color: "#0f1923",
    categories: ["finance", "productivity"],
    description:
      "Finanzas personales, familiares y de pequeños negocios en una app mobile first.",
    display: "standalone",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        purpose: "maskable",
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
    id: "/",
    lang: "es-AR",
    name: "Finanzar",
    orientation: "portrait",
    scope: "/",
    short_name: "Finanzar",
    start_url: "/dashboard",
    theme_color: "#378ADD",
  };
}
