import { useAtom, useAtomValue } from "jotai";
import { Activity } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { devicesAtom, isScanningAtom, selectedDeviceAtom, selectedDeviceIdAtom } from "@/state/heart-rate";

export function DevicePicker() {
  const devices = useAtomValue(devicesAtom);
  const isScanning = useAtomValue(isScanningAtom);
  const selectedDevice = useAtomValue(selectedDeviceAtom);
  const [selectedDeviceId, setSelectedDeviceId] = useAtom(selectedDeviceIdAtom);

  return (
    <>
      <div className="grid gap-2">
        <Label className="text-sm font-bold text-muted-foreground">デバイス</Label>
        <Select value={selectedDeviceId || undefined} onValueChange={setSelectedDeviceId} disabled={devices.length === 0 || isScanning}>
          <SelectTrigger className="h-10 w-full">
            <SelectValue placeholder="デバイス未検出" />
          </SelectTrigger>
          <SelectContent>
            {devices.map((device) => (
              <SelectItem key={device.id} value={device.id}>
                {device.name} ({device.address})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedDevice && (
        <div className="flex flex-col gap-2 text-sm font-bold text-muted-foreground sm:flex-row sm:items-center">
          <Activity className="size-4 text-primary" aria-hidden="true" />
          <span>{selectedDevice.address}</span>
          <span>{selectedDevice.rssi == null ? "RSSI不明" : `${selectedDevice.rssi} dBm`}</span>
        </div>
      )}
    </>
  );
}
