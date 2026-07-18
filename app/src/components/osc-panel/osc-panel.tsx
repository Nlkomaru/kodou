import { useCallback, useEffect, useRef, useState } from "react";
import { useAtom, useAtomValue } from "jotai";
import { Info, type LucideIcon, Plus, Radio, Send, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { OSC_PARAM_META, type AppConfig, type OscParamKey, type OscSettings } from "@/lib/osc";
import { activeOscParamsAtom, oscAddressesAtom, oscConfigAtom, oscEnabledAtom, oscTargetsAtom } from "@/state/osc";


// config.conf への保存ヘルパー。invoke で Rust の save_config を呼ぶ。
async function saveConfigToBackend(config: AppConfig) {
  try {
    await invoke("save_config", { config });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("Failed to save config:", e);
  }
}

// OSC設定UI。設定内容はこのパネルから直接編集し、backend の config.conf へ即時保存する。
// 送信ON/OFFは localStorage へ永続化し、再起動後も状態を維持する。
export function OscPanel() {
  const [enabled, setEnabled] = useAtom(oscEnabledAtom);
  const [config, setConfig] = useAtom(oscConfigAtom);
  const targets = useAtomValue(oscTargetsAtom);
  const addresses = useAtomValue(oscAddressesAtom);
  const activeParams = useAtomValue(activeOscParamsAtom);

  // 送信先追加用のローカル入力
  const [newTarget, setNewTarget] = useState("");
  const [targetError, setTargetError] = useState("");

  // アドレス追加用のローカル入力（パラメータキー → 入力文字列）
  const [newAddresses, setNewAddresses] = useState<Partial<Record<OscParamKey, string>>>({});

  // 500ms デバウンスで backend へ保存
  const saveTimerRef = useRef<number>(0);
  const saveDebounced = useCallback(
    (nextConfig: AppConfig) => {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = window.setTimeout(() => saveConfigToBackend(nextConfig), 500);
    },
    [],
  );

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

  // 送信先追加（バリデーション付き）
  const handleAddTarget = () => {
    const trimmed = newTarget.trim();
    if (!trimmed) return;
    const parts = trimmed.split(":");
    if (parts.length !== 2 || isNaN(Number(parts[1])) || parts[1] === "") {
      setTargetError("IP:ポート形式で入力してください（例: 127.0.0.1:9000）");
      return;
    }
    if (config.osc.targets.includes(trimmed)) {
      setTargetError("この送信先は既に追加されています");
      return;
    }
    setTargetError("");
    updateConfig({
      ...config,
      osc: { ...config.osc, targets: [...config.osc.targets, trimmed] },
    });
    setNewTarget("");
  };

  // 送信先削除
  const handleRemoveTarget = (target: string) => {
    updateConfig({
      ...config,
      osc: { ...config.osc, targets: config.osc.targets.filter((t) => t !== target) },
    });
  };

  // 数値設定更新（入力文字列 → Number → 保存）
  const handleSettingChange = (key: keyof OscSettings, raw: string) => {
    const value = Number(raw);
    if (isNaN(value)) return;
    updateConfig({ ...config, osc: { ...config.osc, [key]: value } });
  };

  // hrFloatMode 変更
  const handleFloatModeChange = (value: string) => {
    if (value !== "signed" && value !== "unsigned") return;
    updateConfig({ ...config, osc: { ...config.osc, hrFloatMode: value } });
  };

  // アドレス追加
  const handleAddAddress = (paramKey: OscParamKey) => {
    const input = (newAddresses[paramKey] ?? "").trim();
    if (!input) return;
    const current = addresses[paramKey] ?? [];
    if (current.includes(input)) return;
    updateConfig({
      ...config,
      compatibility: { ...config.compatibility, [paramKey]: [...current, input] },
    });
    setNewAddresses((prev) => ({ ...prev, [paramKey]: "" }));
  };

  // アドレス削除
  const handleRemoveAddress = (paramKey: OscParamKey, address: string) => {
    const current = addresses[paramKey] ?? [];
    updateConfig({
      ...config,
      compatibility: { ...config.compatibility, [paramKey]: current.filter((a) => a !== address) },
    });
  };

  // アドレス入力更新
  const handleAddressInputChange = (paramKey: OscParamKey, value: string) => {
    setNewAddresses((prev) => ({ ...prev, [paramKey]: value }));
  };

  return (
    <Card className="shadow-none">
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base">OSC送信</CardTitle>
            <CardDescription className="mt-1">VRChatのAvatar Parameter OSCへ心拍データを送ります</CardDescription>
          </div>
          <Label
            className={
              "flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-bold transition-colors " +
              (enabled
                ? "border-primary/30 bg-primary/10 text-foreground"
                : "border-border bg-muted/40 text-muted-foreground")
            }
          >
            <Switch checked={enabled} onCheckedChange={(value) => setEnabled(value === true)} />
            送信を有効化
          </Label>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {/* 送信先 */}
        <section className="grid gap-2">
          <SectionHeading icon={Send} label="送信先" count={targets.length} />
          {targets.length > 0 ? (
            <div className="flex flex-col gap-1.5">
              {targets.map((target) => (
                <div key={target} className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="font-mono text-xs">
                    {target}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => handleRemoveTarget(target)}
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    aria-label={`${target} を削除`}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">送信先が設定されていません</p>
          )}
          <div className="flex gap-1.5">
            <Input
              value={newTarget}
              onChange={(e) => { setNewTarget(e.target.value); setTargetError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") handleAddTarget(); }}
              placeholder="127.0.0.1:9000"
              className="h-8 text-xs"
            />
            <button
              type="button"
              onClick={handleAddTarget}
              className="inline-flex shrink-0 items-center gap-1 rounded-md bg-primary px-3.5 py-1 text-xs font-bold text-primary-foreground hover:bg-primary/90"
            >
              <Plus className="size-3" />
              追加
            </button>
          </div>
          {targetError && (
            <p className="text-xs text-destructive">{targetError}</p>
          )}
        </section>

        <Separator />

        {/* 数値設定 */}
        <section className="grid gap-2">
          <SectionHeading icon={Info} label="数値設定" />
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Label className="shrink-0 text-xs text-muted-foreground">BPM 最小値</Label>
              <Input
                type="number"
                value={config.osc.bpmMin}
                onChange={(e) => handleSettingChange("bpmMin", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="shrink-0 text-xs text-muted-foreground">BPM 最大値</Label>
              <Input
                type="number"
                value={config.osc.bpmMax}
                onChange={(e) => handleSettingChange("bpmMax", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="shrink-0 text-xs text-muted-foreground">平均窓 (ms)</Label>
              <Input
                type="number"
                value={config.osc.averageWindowMs}
                onChange={(e) => handleSettingChange("averageWindowMs", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="shrink-0 text-xs text-muted-foreground">拍パルス幅 (ms)</Label>
              <Input
                type="number"
                value={config.osc.beatPulseMs}
                onChange={(e) => handleSettingChange("beatPulseMs", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="shrink-0 text-xs text-muted-foreground">RR Twitch しきい値 (ms)</Label>
              <Input
                type="number"
                value={config.osc.rrTwitchThresholdMs}
                onChange={(e) => handleSettingChange("rrTwitchThresholdMs", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="shrink-0 text-xs text-muted-foreground">自動停止 (秒)</Label>
              <Input
                type="number"
                min={0}
                value={config.osc.disconnectTimeoutSecs}
                onChange={(e) => handleSettingChange("disconnectTimeoutSecs", e.target.value)}
                className="h-8 text-xs"
              />
            </div>
          </div>
          {/* 0 が「無効」を意味することは値だけでは伝わらないため、補足を添える。 */}
          <p className="text-xs text-muted-foreground">
            自動停止: BLE切断からこの秒数だけ再接続できないとモニタリングを停止します。0 で無効（無限に再接続）。
          </p>
        </section>

        <Separator />

        {/* hrFloatMode */}
        <section className="grid gap-2">
          <SectionHeading icon={Radio} label="HRFloat モード" />
          <Select value={config.osc.hrFloatMode} onValueChange={handleFloatModeChange}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="signed">signed (-1.0〜1.0)</SelectItem>
              <SelectItem value="unsigned">unsigned (0.0〜1.0)</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <Separator />

        {/* アドレス設定 */}
        <section className="grid gap-2.5">
          <SectionHeading icon={Radio} label="送信パラメータ" count={activeParams.length} />
          <div className="grid gap-2 sm:grid-cols-2">
            {OSC_PARAM_META.map((meta) => {
              const paramAddresses = addresses[meta.key] ?? [];
              return (
                <div
                  key={meta.key}
                  className="flex flex-col gap-2 rounded-lg bg-muted/30 px-5 py-4 ring-1 ring-border/70"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-bold">{meta.label}</span>
                    {paramAddresses.length > 0 && (
                      <Badge variant="secondary" className="h-4 px-1 text-[10px]">{paramAddresses.length}件</Badge>
                    )}
                  </div>
                  {paramAddresses.length > 0 ? (
                    <div className="flex flex-col gap-1">
                      {paramAddresses.map((addr) => (
                        <div key={addr} className="flex items-center gap-1">
                          <code className="min-w-0 break-all text-[11px] leading-relaxed text-muted-foreground">
                            {addr}
                          </code>
                          <button
                            type="button"
                            onClick={() => handleRemoveAddress(meta.key, addr)}
                            className="inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            aria-label={`${addr} を削除`}
                          >
                            <X className="size-2.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">アドレス未設定</p>
                  )}
                  <div className="flex gap-1">
                    <Input
                      value={newAddresses[meta.key] ?? ""}
                      onChange={(e) => handleAddressInputChange(meta.key, e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAddAddress(meta.key); }}
                      placeholder="/avatar/parameters/..."
                      className="h-7 text-[11px]"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddAddress(meta.key)}
                      className="inline-flex shrink-0 items-center justify-center rounded-md bg-primary px-3 text-[11px] font-bold text-primary-foreground hover:bg-primary/90"
                    >
                      <Plus className="size-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </CardContent>
    </Card>
  );
}

// 各セクションの見出し。アイコン＋ラベルで統一し、必要なら件数バッジを添える。
function SectionHeading({ icon: Icon, label, count }: { icon: LucideIcon; label: string; count?: number }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
      <Icon className="size-3.5" aria-hidden="true" />
      {label}
      {count !== undefined && (
        <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-semibold">
          {count}件
        </Badge>
      )}
    </div>
  );
}
