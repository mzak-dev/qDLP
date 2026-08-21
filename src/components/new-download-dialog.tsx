import { useEffect, useRef, useState } from "react";
import { open as openFolderDialog } from "@tauri-apps/plugin-dialog";
import { downloadDir } from "@tauri-apps/api/path";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { createDownload, probeUrl } from "@/lib/api";
import { probeIsPlaylist, probeItemCount, type Probe } from "@/lib/types";

export function NewDownloadDialog({ onCreated }: { onCreated: (jobId: string, url: string, title: string) => void }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [dir, setDir] = useState("");
  const [probe, setProbe] = useState<Probe | null>(null);
  const [probing, setProbing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open && !dir) void downloadDir().then(setDir).catch(() => {});
  }, [open, dir]);

  // 500ms debounce mirrors rustyDLP's own probe-while-typing behaviour.
  useEffect(() => {
    setProbe(null);
    if (!url.trim()) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setProbing(true);
      probeUrl(url)
        .then(setProbe)
        .catch(() => setProbe(null))
        .finally(() => setProbing(false));
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [url]);

  async function pickFolder() {
    const picked = await openFolderDialog({ directory: true, defaultPath: dir || undefined });
    if (typeof picked === "string") setDir(picked);
  }

  async function submit() {
    if (!url.trim() || !dir.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const jobId = await createDownload(url, dir);
      onCreated(jobId, url, probe?.title ?? url);
      setOpen(false);
      setUrl("");
      setProbe(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>New Download</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Download</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="dl-url">URL</Label>
            <Input id="dl-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Video or playlist URL" autoFocus />
            {probing && <p className="text-muted-foreground text-xs">Checking…</p>}
            {probe?.title && (
              <p className="text-muted-foreground truncate text-xs">
                {probeIsPlaylist(probe) ? `Playlist · ${probeItemCount(probe)} videos` : probe.title}
              </p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="dl-dir">Download folder</Label>
            <div className="flex gap-2">
              <Input id="dl-dir" value={dir} onChange={(e) => setDir(e.target.value)} placeholder="Choose a folder" />
              <Button type="button" variant="outline" onClick={() => void pickFolder()}>
                Browse
              </Button>
            </div>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={() => void submit()} disabled={busy || !url.trim() || !dir.trim()}>
            {busy ? "Starting…" : "Download"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
