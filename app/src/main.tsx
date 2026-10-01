import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, Navigate } from "react-router";
import { RouterProvider } from "react-router/dom";
import { FluentProvider } from "@fluentui/react-components";
import { kodouTheme } from "./lib/theme";
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
    <FluentProvider theme={kodouTheme}>
      <RouterProvider router={router} />
    </FluentProvider>
  </React.StrictMode>,
);
