import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, Navigate } from "react-router";
import { RouterProvider } from "react-router/dom";
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
    <RouterProvider router={router} />
  </React.StrictMode>,
);
