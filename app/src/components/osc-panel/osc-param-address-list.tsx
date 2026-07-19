import { Radio } from "lucide-react";
import { activeParamKeys, OSC_PARAM_META, type OscAddressMap, type OscParamKey } from "@/lib/osc";
import { OscParamAddressCard } from "./osc-param-address-card";
import { SectionHeading } from "./section-heading";

export type OscParamAddressListProps = {
  addresses: OscAddressMap;
  onAdd: (key: OscParamKey, address: string) => void;
  onRemove: (key: OscParamKey, address: string) => void;
};

// 送信可能なOSCパラメータをすべて並べ、それぞれのアドレス設定を一覧させる。
// アドレスが1つも無いパラメータは送信されないため、件数は実際の送信対象数になる。
export function OscParamAddressList({ addresses, onAdd, onRemove }: OscParamAddressListProps) {
  const activeCount = activeParamKeys(addresses).length;

  return (
    <section className="grid gap-2.5">
      <SectionHeading icon={Radio} label="送信パラメータ" count={activeCount} />
      <div className="grid gap-2 sm:grid-cols-2">
        {OSC_PARAM_META.map((meta) => (
          <OscParamAddressCard
            key={meta.key}
            meta={meta}
            addresses={addresses[meta.key] ?? []}
            onAdd={(address) => onAdd(meta.key, address)}
            onRemove={(address) => onRemove(meta.key, address)}
          />
        ))}
      </div>
    </section>
  );
}
