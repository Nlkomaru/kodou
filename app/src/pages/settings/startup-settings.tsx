import { Field, Switch } from "@fluentui/react-components";
import { useAtomValue, useSetAtom } from "jotai";
import { startupSettingsAtom, updateStartupSettingsAtom } from "@/state/startup";

// 起動時の接続設定。2つのスイッチは独立した設定だが、
// 「前回の停止状態を引き継ぐ」は自動接続が無効なとき意味を持たないため無効化する
// （無効化しても選択値は保持し、自動接続を戻したときにそのまま使えるようにする）。
export function StartupSettings() {
  const settings = useAtomValue(startupSettingsAtom);
  const updateSettings = useSetAtom(updateStartupSettingsAtom);

  return (
    <div className="flex flex-col gap-4">
      <Field
        label="起動時に自動接続する"
        hint="前回接続したデバイスが保存されている場合のみ、起動時に自動で接続します。接続は「接続」ボタンからいつでも手動で行えます。"
      >
        <Switch
          checked={settings.autoConnect}
          onChange={(_event, data) => updateSettings({ autoConnect: data.checked })}
        />
      </Field>
      <Field
        label="前回の停止状態を引き継ぐ"
        hint="終了時に計測を停止していた場合は自動接続しません。Bluetoothの一時的な切断は停止として扱わず、次回起動時に再接続します。"
      >
        <Switch
          disabled={!settings.autoConnect}
          checked={settings.restoreStoppedState}
          onChange={(_event, data) => updateSettings({ restoreStoppedState: data.checked })}
        />
      </Field>
    </div>
  );
}
