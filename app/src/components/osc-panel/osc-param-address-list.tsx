import { Fragment } from "react";
import { Radio } from "lucide-react";
import { Card, Divider } from "@fluentui/react-components";
import { activeParamKeys, OSC_PARAM_META, type OscAddressMap, type OscParamKey } from "@/lib/osc";
import { Section } from "@/components/section/section";
import { OscParamAddressRow } from "./osc-param-address-row";

export type OscParamAddressListProps = {
  addresses: OscAddressMap;
  onAdd: (key: OscParamKey, address: string) => void;
  onRemove: (key: OscParamKey, address: string) => void;
};

// 送信可能なOSCパラメータをすべて並べ、それぞれのアドレス設定を一覧させる。
// アドレスが1つも無いパラメータは送信されないため、件数は実際の送信対象数になる。
// 15件を個別のカードにすると枠が増えすぎるので、1つの面に区切り線で並べる。
export function OscParamAddressList({ addresses, onAdd, onRemove }: OscParamAddressListProps) {
  const activeCount = activeParamKeys(addresses).length;

  return (
    <Section icon={Radio} label="送信パラメータ" count={activeCount}>
      <Card appearance="filled" className="min-w-0">
        {OSC_PARAM_META.map((meta, index) => (
          <Fragment key={meta.key}>
            {/* 先頭以外の行の上に区切り線を引く。 */}
            {index > 0 && <Divider />}
            <OscParamAddressRow
              meta={meta}
              addresses={addresses[meta.key] ?? []}
              onAdd={(address) => onAdd(meta.key, address)}
              onRemove={(address) => onRemove(meta.key, address)}
            />
          </Fragment>
        ))}
      </Card>
    </Section>
  );
}
