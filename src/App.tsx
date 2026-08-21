// Root layout: a header (title + Settings link) over whatever route is
// active. The walking skeleton's one-screen probe/download form has been
// superseded by routes/library.tsx's New Download dialog — same commands,
// real IA.

import { useEffect } from "react";
import { Link, Outlet } from "react-router-dom";
import { Settings as SettingsIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startJobEventBus } from "@/lib/events";

export default function App() {
  useEffect(() => {
    startJobEventBus();
  }, []);

  return (
    <div className="flex h-screen flex-col">
      <header className="flex shrink-0 items-center justify-between border-b px-6 py-3">
        <Link to="/" className="text-lg font-semibold tracking-tight">
          qDLP
        </Link>
        <Button asChild size="icon" variant="ghost">
          <Link to="/settings" aria-label="Settings">
            <SettingsIcon className="size-4" />
          </Link>
        </Button>
      </header>
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
