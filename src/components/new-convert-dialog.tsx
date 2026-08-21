import { useState } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createConvert } from "@/lib/api";
import { CONVERT_FORMATS, type ConvertFormat } from "@/lib/types";

export function NewConvertDialog({ onCreated }: { onCreated: (jobId: string, sourcePath: string) => void }) {
  const [open, setOpen] = useState(false);
  const [source, setSource] = useState("");
  const [format, setFormat] = useState<ConvertFormat>("mp4");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickFile() {
    const picked = await openFileDialog({
      multiple: false,
      filters: [{ name: "Video/Audio", extensions: ["mp4", "mkv", "webm", "mov", "avi", "m4a", "mp3", "opus", "flac", "wav"] }],
    });
    if (typeof picked === "string") setSource(picked);
  }

  async function submit() {
    if (!source.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const jobId = await createConvert(source, format);
      onCreated(jobId, source);
      setOpen(false);
      setSource("");
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">New Convert</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New Convert</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="cv-source">Source file</Label>
            <div className="flex gap-2">
              <Input id="cv-source" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Choose a file" />
              <Button type="button" variant="outline" onClick={() => void pickFile()}>
                Browse
              </Button>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Target format</Label>
            <Select value={format} onValueChange={(v) => setFormat(v as ConvertFormat)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONVERT_FORMATS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>
        <DialogFooter>
          <Button onClick={() => void submit()} disabled={busy || !source.trim()}>
            {busy ? "Starting…" : "Convert"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
