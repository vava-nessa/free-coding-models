import { defineConfig } from "vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// TanStack Router (SPA) — no SSR layer, plain static build
// Vercel serves dist/ as a static SPA with index.html fallback
export default defineConfig({
	resolve: { tsconfigPaths: true },
	plugins: [
		TanStackRouterVite({ routesDirectory: "./src/routes", generatedRouteTree: "./src/routeTree.gen.ts" }),
		tailwindcss(),
		viteReact(),
	],
});
