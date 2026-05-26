import { RouterProvider } from "@tanstack/react-router";
import { createRoot } from "react-dom/client";
import { getRouter } from "./router";
import "./styles.css";

const router = getRouter();

// biome-ignore lint/style/noNonNullAssertion: #root always exists in index.html
createRoot(document.getElementById("root")!).render(
	<RouterProvider router={router} />,
);
