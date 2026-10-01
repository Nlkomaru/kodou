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
        // 接続情報は値の読み上げに徹し、見た目の主張は見出しに譲る。
        <div className="flex flex-col gap-1 text-xs text-secondary-foreground sm:flex-row sm:items-center sm:gap-3">
          <span className="flex items-center gap-1.5">
            <Activity className="size-3.5" aria-hidden="true" />
            {selectedDevice.address}
          </span>
          <span>{selectedDevice.rssi == null ? "RSSI不明" : `${selectedDevice.rssi} dBm`}</span>
        </div>
      )}
    </>
  );
}
