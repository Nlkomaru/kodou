import { useAtomValue } from "jotai";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { connectionStatusVariantAtom, errorAtom, statusAtom } from "@/state/heart-rate";

export function StatusMessage() {
  const status = useAtomValue(statusAtom);
  const variant = useAtomValue(connectionStatusVariantAtom);
  const error = useAtomValue(errorAtom);
  return (
    <>
      <Alert variant={variant}>
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
