import { useAtom, useAtomValue } from "jotai";
import { Activity } from "lucide-react";
import { Dropdown, Field, Option } from "@fluentui/react-components";
import { devicesAtom, isScanningAtom, selectedDeviceAtom, selectedDeviceIdAtom } from "@/state/heart-rate";

export function DevicePicker() {
  const devices = useAtomValue(devicesAtom);
  const isScanning = useAtomValue(isScanningAtom);
  const selectedDevice = useAtomValue(selectedDeviceAtom);
  const [selectedDeviceId, setSelectedDeviceId] = useAtom(selectedDeviceIdAtom);

  // 表示文字列は配列の今のデバイスから作り直す。再スキャンで一覧が入れ替わっても
  // Dropdown 内部のキャッシュが古い名前を出し続けないよう、value を常に制御する。
  const selectedText = selectedDevice
    ? `${selectedDevice.name} (${selectedDevice.address})`
    : "";

  return (
    <>
      <Field label="デバイス">
        <Dropdown
          size="large"
          className="w-full"
          value={selectedText}
          selectedOptions={selectedDeviceId ? [selectedDeviceId] : []}
          onOptionSelect={(_, data) => setSelectedDeviceId(data.optionValue ?? "")}
          placeholder="デバイス未検出"
          disabled={devices.length === 0 || isScanning}
        >
          {devices.map((device) => {
            const label = `${device.name} (${device.address})`;
            return (
              <Option key={device.id} value={device.id} text={label}>
                {label}
              </Option>
            );
          })}
        </Dropdown>
      </Field>

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
