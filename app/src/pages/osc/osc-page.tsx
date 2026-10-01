import { OscPanel } from "@/components/osc-panel/osc-panel";

// OSC の設定は行数が多いため、設定画面と同じ行長に揃えて読みやすくする。
export function OscPage() {
  return (
    <div className="max-w-3xl">
      <OscPanel />
    </div>
  );
}
