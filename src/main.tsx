import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter, Route, Routes } from "react-router-dom";
import App from "./App";
import Library from "./routes/library";
import JobDetail from "./routes/job-detail";
import Settings from "./routes/settings";
import { ThemeProvider } from "./components/theme-provider";
import { JobMorphProvider } from "./components/job-morph-provider";
import "./index.css";

// HashRouter, not BrowserRouter: the built app is served from a file:// (or
// tauri://) origin with no server to fall back to a route on refresh/deep
// link — the hash never leaves the client, so it always resolves.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider>
      <JobMorphProvider>
        <HashRouter>
          <Routes>
            <Route element={<App />}>
              <Route index element={<Library />} />
              <Route path="job/:id" element={<JobDetail />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </HashRouter>
      </JobMorphProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
