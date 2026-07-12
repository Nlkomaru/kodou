export type HeartRateDevice = {
  id: string;
  name: string;
  address: string;
  rssi: number | null;
  services: string[];
};

export type HeartRateReading = {
  deviceId: string;
  bpm: number;
  rrIntervalsMs: number[];
  energyExpended: number | null;
  sensorContactDetected: boolean | null;
  batteryPercent: number | null;
};

export type HeartRateStatusEvent = {
  state:
    | "scanning"
    | "connecting"
    | "connected"
    | "reconnecting"
    | "disconnected"
    | "warning"
    | "error";
  message: string;
  deviceId: string | null;
};

// VRChatへ送るOSC引数。RustのOscArgタグ付きenumと対応させる。
export type OscArg =
  | { kind: "Bool"; value: boolean }
  | { kind: "Int"; value: number }
  | { kind: "Float"; value: number };

export type OscMessage = {
  address: string;
  arg: OscArg;
};

export type MetricPoint = {
  timestamp: number;
  value: number;
};

export type TimeDomain = {
  start: number;
  end: number;
};

export type HeartRateStats = {
  avgBpm: number | null;
  maxBpm: number | null;
  minBpm: number | null;
  rmssdMs: number | null;
};
