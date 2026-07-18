import { atom } from "jotai";

// 自動更新の進行段階。UIはこの1つの値だけを見て表示を切り替える。
// idle: 更新なし / available: 更新を検出しユーザーの確認待ち /
// downloading: ダウンロード中 / ready: 適用完了、再起動待ち / error: 失敗
export type UpdateStage = "idle" | "available" | "downloading" | "ready" | "error";

// 検出した更新の概要。バージョンとリリースノートだけをUIに渡す。
export type UpdateInfo = {
  version: string;
  notes: string;
};

export const updateStageAtom = atom<UpdateStage>("idle");
export const updateInfoAtom = atom<UpdateInfo | null>(null);
export const updateErrorAtom = atom("");

// ダウンロード進捗(0〜1)。総サイズがサーバーから来ない場合はnullのままにして、
// UIでは不定形の「ダウンロード中」表示にフォールバックする。
export const updateProgressAtom = atom<number | null>(null);
