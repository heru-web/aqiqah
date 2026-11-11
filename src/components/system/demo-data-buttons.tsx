"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangleIcon, SparklesIcon } from "lucide-react";
import { seedDemoAction, clearDemoAction, type DemoResult } from "@/server/actions/demo";

const CONFIRM_PHRASE = "HAPUS DEMO";

export function DemoDataButtons() {
  const router = useRouter();
  const [pending, setPending] = useState<"seed" | "clear" | null>(null);
  const [askClear, setAskClear] = useState(false);
  const [phrase, setPhrase] = useState("");

  async function run(kind: "seed" | "clear") {
    setPending(kind);
    const res: DemoResult = kind === "seed" ? await seedDemoAction() : await clearDemoAction();
    setPending(null);
    if (res?.error) {
      toast.error(res.error);
      return;
    }
    toast.success(res?.message ?? "Selesai");
    if (kind === "clear") {
      setAskClear(false);
      setPhrase("");
    }
    router.refresh();
    if (kind === "seed") router.push("/karyawan");
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" variant="secondary" disabled={pending !== null} onClick={() => void run("seed")}>
        <SparklesIcon className="h-4 w-4" />
        {pending === "seed" ? "Membuat…" : "Isi Data Demo"}
      </Button>
      <Button
        size="sm"
        variant="destructive"
        disabled={pending !== null}
        onClick={() => setAskClear(true)}
      >
        <AlertTriangleIcon className="h-4 w-4" />
        {pending === "clear" ? "Menghapus…" : "Hapus Semua Demo"}
      </Button>

      <Dialog open={askClear} onOpenChange={(open) => { setAskClear(open); if (!open) setPhrase(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-full bg-danger-soft text-danger-soft-foreground">
                <AlertTriangleIcon className="h-4 w-4" />
              </span>
              Hapus semua data demo?
            </DialogTitle>
            <DialogDescription>
              Semua data bertanda demo di seluruh modul akan dihapus permanen. Data asli tidak tersentuh.
              Ketik <strong>{CONFIRM_PHRASE}</strong> untuk melanjutkan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="demo-confirm">Konfirmasi</Label>
            <Input
              id="demo-confirm"
              value={phrase}
              onChange={(event) => setPhrase(event.target.value)}
              placeholder={CONFIRM_PHRASE}
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAskClear(false)} disabled={pending !== null}>
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={phrase.trim().toUpperCase() !== CONFIRM_PHRASE || pending !== null}
              onClick={() => void run("clear")}
            >
              {pending === "clear" ? "Menghapus…" : "Hapus permanen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
