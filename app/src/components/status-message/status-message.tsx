import { useAtomValue } from "jotai";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { errorAtom, statusAtom } from "@/state/heart-rate";

export function StatusMessage() {
  const status = useAtomValue(statusAtom);
  const error = useAtomValue(errorAtom);

  return (
    <>
      <Alert>
        <AlertDescription className="font-bold text-muted-foreground">{status.message}</AlertDescription>
      </Alert>
      {error && (
        <Alert variant="destructive">
          <AlertDescription className="font-bold">{error}</AlertDescription>
        </Alert>
      )}
    </>
  );
}
