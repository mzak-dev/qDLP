import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import JobGrid from "./routes/job-grid";
import Settings from "./routes/settings";
import { ThemeProvider } from "./components/theme-provider";
import "./index.css";

// HashRouter, not BrowserRouter: the built app is served from a file:// (or
// tauri://) origin with no server to fall back to a route on refresh/deep
// link — the hash never leaves the client, so it always resolves.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route element={<App />}>
            <Route index element={<JobGrid />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  </React.StrictMode>,
);
