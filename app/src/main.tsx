import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, Navigate } from "react-router";
import { RouterProvider } from "react-router/dom";
import { ThemeProvider } from "./components/theme-provider/theme-provider";
import App from "./App";
import "./index.css";

const router = createHashRouter([
  {
    path: "/",
    element: <Navigate to="/top" replace />,
  },
  {
    path: "/top",
    element: <App />,
  },
]);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  </React.StrictMode>,
);
