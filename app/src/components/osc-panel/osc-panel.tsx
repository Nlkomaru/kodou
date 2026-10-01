import { useCallback, useEffect, useRef } from "react";
import { useAtom, useAtomValue } from "jotai";
import { invoke } from "@tauri-apps/api/core";
import { Card, CardHeader, Divider, Text } from "@fluentui/react-components";
import type { AppConfig, OscParamKey, OscSettings } from "@/lib/osc";
import { oscAddressesAtom, oscConfigAtom, oscEnabledAtom, oscSettingsAtom, oscTargetsAtom } from "@/state/osc";
import { OscEnableToggle } from "./osc-enable-toggle";
import { OscFloatModeSelect } from "./osc-float-mode-select";
import { OscNumericSettings } from "./osc-numeric-settings";
import { OscParamAddressList } from "./osc-param-address-list";
import { OscTargetList } from "./osc-target-list";

// config.conf への保存ヘルパー。invoke で Rust の save_config を呼ぶ。
async function saveConfigToBackend(config: AppConfig) {
  try {
    await invoke("save_config", { config });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to save config:", e);
  }
}

// OSC設定UIのコンテナ。表示は各サブコンポーネントに任せ、
// ここでは atom の読み書きと backend への保存だけを担う。
// 送信ON/OFFは localStorage へ永続化し、再起動後も状態を維持する。
export function OscPanel() {
  const [enabled, setEnabled] = useAtom(oscEnabledAtom);
  const [config, setConfig] = useAtom(oscConfigAtom);
  const settings = useAtomValue(oscSettingsAtom);
  const targets = useAtomValue(oscTargetsAtom);
  const addresses = useAtomValue(oscAddressesAtom);

  // 500ms デバウンスで backend へ保存
  const saveTimerRef = useRef<number>(0);
  const saveDebounced = useCallback((nextConfig: AppConfig) => {
    clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => saveConfigToBackend(nextConfig), 500);
  }, []);

  // アンマウント時にデバウンスタイマーをクリア
  useEffect(() => {
    return () => clearTimeout(saveTimerRef.current);
  }, []);

  // atom を更新しつつ backend へ保存するヘルパー
  const updateConfig = useCallback(
    (nextConfig: AppConfig) => {
      setConfig(nextConfig);
      saveDebounced(nextConfig);
    },
    [setConfig, saveDebounced],
  );

  // osc セクションの一部だけを差し替える共通処理。
  const patchOsc = useCallback(
    (patch: Partial<OscSettings>) => {
      updateConfig({ ...config, osc: { ...config.osc, ...patch } });
    },
    [config, updateConfig],
  );

  // 数値設定は入力文字列で届くため、ここで数値化して不正値を弾く。
  const handleSettingChange = (key: keyof OscSettings, raw: string) => {
    const value = Number(raw);
    if (isNaN(value)) return;
    patchOsc({ [key]: value } as Partial<OscSettings>);
  };

  // パラメータごとのアドレス表を差し替える共通処理。
  const patchAddresses = (key: OscParamKey, next: string[]) => {
    updateConfig({ ...config, compatibility: { ...config.compatibility, [key]: next } });
  };

  return (
    <Card appearance="outline" size="large">
      <CardHeader
        header={
          <Text size={400} weight="semibold">
            OSC送信
          </Text>
        }
        description={<Text size={200}>VRChatのAvatar Parameter OSCへ心拍データを送ります</Text>}
        action={<OscEnableToggle checked={enabled} onCheckedChange={setEnabled} />}
      />
      <div className="flex flex-col gap-4">
        <OscTargetList
          targets={targets}
          onAdd={(target) => patchOsc({ targets: [...targets, target] })}
          onRemove={(target) => patchOsc({ targets: targets.filter((t) => t !== target) })}
        />

        <Divider />

        <OscNumericSettings settings={settings} onChange={handleSettingChange} />

        <Divider />

        <OscFloatModeSelect
          value={settings.hrFloatMode}
          onChange={(mode) => patchOsc({ hrFloatMode: mode })}
        />

        <Divider />

        <OscParamAddressList
          addresses={addresses}
          onAdd={(key, address) => patchAddresses(key, [...(addresses[key] ?? []), address])}
          onRemove={(key, address) =>
            patchAddresses(key, (addresses[key] ?? []).filter((a) => a !== address))
          }
        />
      </div>
    </Card>
  );
}
