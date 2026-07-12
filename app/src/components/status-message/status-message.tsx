import { useAtomValue } from "jotai";
import { errorAtom, statusAtom } from "@/state/heart-rate";

export function StatusMessage() {
  const status = useAtomValue(statusAtom);
  const error = useAtomValue(errorAtom);

  return (
    <>
      <div className="rounded-xl bg-muted/40 px-4 py-3 text-sm font-bold text-muted-foreground">{status.message}</div>
      {error && <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-bold text-destructive">{error}</div>}
    </>
  );
}
