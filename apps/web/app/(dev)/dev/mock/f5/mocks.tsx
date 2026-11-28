"use client";
// 段 6（F5 AI に任せて、確かめて、終える）の下絵のモック（部品先行・枝 c/段6）。状態は束ごとのファイル（states/）が持ち、ここは集めるだけ。
//   core＝止める・取り下げる・確認の表・自分で直す・差し戻し・試し打ち・承認待ち・完了・作る／room＝分身の部屋（ようす・やったこと・話す）とチケットの中で話す
import type { Theme } from "@/lib/theme";
import { CORE } from "./states/core";
import { ROOM } from "./states/room";
import type { MockEntry } from "./types";

const GROUPS = [CORE, ROOM] as const;

// 状態の並び（canvas_field_gate が読む・ticket はその状態を本物にする画面の葉）。描くのは states/ の view。1 状態 1 行（K730-UI-003 が `{ id: "` の行を数える）
// prettier-ignore
export const MOCKS: readonly MockEntry[] = [
  { id: "stop-running-band", screen: "tickets", ps: "PS2", label: "任せる帯：作っているとき［止める］が押せる", ticket: "K-734" },
  { id: "stop-running-confirm", screen: "tickets", ps: "PS2", label: "AI を止める確かめの小窓", ticket: "K-734" },
  { id: "stop-running-busy", screen: "tickets", ps: "PS2", label: "止めています（小窓の主ボタンが処理中）", ticket: "K-734" },
  { id: "stop-approval-band", screen: "tickets", ps: "PS2", label: "承認の帯：［止める］が押せる", ticket: "K-734" },
  { id: "stop-approval-confirm", screen: "tickets", ps: "PS2", label: "承認待ちの成果物を使わずに止める確かめの小窓", ticket: "K-734" },
  { id: "stop-stopped-band", screen: "tickets", ps: "PS2", label: "止めた後の帯（AI に任せ直せる）", ticket: "K-734" },
  { id: "stop-approval-stopped", screen: "tickets", ps: "PS2", label: "承認待ちを止めた後（成果物は残り作業中に戻る）", ticket: "K-734" },
  { id: "stop-ignored-result", screen: "tickets", ps: "PS2", label: "止めた後に届いた結果を使わなかった 1 行", ticket: "K-734" },
  { id: "stop-conflict", screen: "tickets", ps: "PS2", label: "止める口が断った：もう止まっていた（409）", ticket: "K-734" },
  { id: "stop-denied", screen: "tickets", ps: "PS2", label: "止める権限が無い人に断られた（止められるのは担当者だけ）", ticket: "K-734" },
  { id: "stop-approval-denied", screen: "tickets", ps: "PS2", label: "承認待ちを止める権限が無い人に断られた（止められるのは承認する人だけ）", ticket: "K-734" },
  { id: "withdraw-band", screen: "tickets", ps: "PS2", label: "実行待ちの帯：［承認を取り下げる］が押せる", ticket: "K-735" },
  { id: "withdraw-confirm", screen: "tickets", ps: "PS2", label: "承認を取り下げる確かめの小窓", ticket: "K-735" },
  { id: "withdraw-done", screen: "tickets", ps: "PS2", label: "取り下げた後（承認待ちに戻る・やり取りに 1 行）", ticket: "K-735" },
  { id: "withdraw-late", screen: "tickets", ps: "PS2", label: "間に合わなかった：実行が始まっていた（409）", ticket: "K-735" },
  { id: "checks-table", screen: "tickets", ps: "PS2", label: "承認の帯の下の確認の表（4 ／ 5 済み・だれがはやり取りの行に）", ticket: "K-740" },
  { id: "checks-failed", screen: "tickets", ps: "PS2", label: "止まった帯の確認の表（1 ／ 3 済み・AI が確かめた物だけチェック）", ticket: "K-740" },
  { id: "checks-queue-column", screen: "approvals", ps: "PS2", label: "承認待ちの列「確認」の新しい形（4 ／ 5 済み）", ticket: "K-740" },
  { id: "checks-approve-modal", screen: "tickets", ps: "PS2", label: "承認の確かめ：チェックの無い確認項目が 2 件（聞くこと 4）", ticket: "K-740" },
  { id: "checks-none", screen: "tickets", ps: "PS2", label: "確認項目を使わない（検査なしと理由）", ticket: "K-740" },
  { id: "selfedit-band", screen: "tickets", ps: "PS2", label: "承認の帯：［自分で直す］が押せる", ticket: "K-743" },
  { id: "selfedit-editing", screen: "tickets", ps: "PS2", label: "成果物を直す面", ticket: "K-743" },
  { id: "selfedit-saving", screen: "tickets", ps: "PS2", label: "保存しています", ticket: "K-743" },
  { id: "selfedit-saved", screen: "tickets", ps: "PS2", label: "保存できた（版 3・成果物は高本が直しました）", ticket: "K-743" },
  { id: "selfedit-conflict", screen: "tickets", ps: "PS2", label: "先にほかの人が直していた（409）", ticket: "K-743" },
  { id: "return-modal", screen: "tickets", ps: "PS2", label: "差し戻す小窓：次は AI が直す（聞くこと 7）", ticket: "K-745" },
  { id: "return-modal-self", screen: "tickets", ps: "PS2", label: "差し戻す小窓：次は自分で直すを選んだ", ticket: "K-745" },
  { id: "return-error", screen: "tickets", ps: "PS2", label: "差し戻す小窓：理由が空で押した", ticket: "K-745" },
  { id: "return-self-band", screen: "tickets", ps: "PS2", label: "自分で直すを選んで差し戻した後の帯", ticket: "K-745" },
  { id: "dry-card", screen: "tickets", ps: "PS2", label: "成果物のカード：［試し打ち（自分宛）］が押せる", ticket: "K-747" },
  { id: "dry-confirm", screen: "tickets", ps: "PS2", label: "試し打ちの確かめ（あなた宛て・本来の宛先には送らない）", ticket: "K-747" },
  { id: "dry-running", screen: "tickets", ps: "PS2", label: "試し打ち中", ticket: "K-747" },
  { id: "dry-done", screen: "tickets", ps: "PS2", label: "試し打ちが届いた", ticket: "K-747" },
  { id: "dry-stopped", screen: "tickets", ps: "PS2", label: "試し打ちが止まった（宛先を差し替えられない操作）", ticket: "K-747" },
  { id: "queue-filter-all", screen: "approvals", ps: "PS2", label: "札：すべて・AI の成果物・渡された（上位の承認・判断を仰がれたは押せない形）", ticket: "K-749" },
  { id: "queue-filter-sort", screen: "approvals", ps: "PS2", label: "並べ替えの箱を開いた（新しく承認待ちになった順が先）", ticket: "K-749" },
  { id: "queue-filter-picked", screen: "approvals", ps: "PS2", label: "「渡された」の札を押した（道に残る）", ticket: "K-749" },
  { id: "queue-filter-empty", screen: "approvals", ps: "PS2", label: "絞った札で 0 件", ticket: "K-749" },
  { id: "history-list", screen: "approvals", ps: "PS2", label: "決めた履歴の板（札・期間・行・［取り消す］）", ticket: "K-751" },
  { id: "history-empty", screen: "approvals", ps: "PS2", label: "決めた履歴：この期間に決めたものが無い", ticket: "K-751" },
  { id: "history-undo-confirm", screen: "approvals", ps: "PS2", label: "［取り消す］の確かめ（承認の取り下げ）", ticket: "K-751" },
  { id: "history-undo-late", screen: "approvals", ps: "PS2", label: "取り消せなかった：実行が始まっていた（409）", ticket: "K-751" },
  { id: "focus-card", screen: "approvals", ps: "PS2", label: "続けて裁く：1 件ずつ全画面（キー J/K/A/R/E/S）", ticket: "K-752" },
  { id: "focus-confirm", screen: "approvals", ps: "PS2", label: "続けて裁く：承認の確かめの小窓を通る", ticket: "K-752" },
  { id: "focus-done", screen: "approvals", ps: "PS2", label: "続けて裁く：終わりの面（承認・差し戻し・飛ばした数）", ticket: "K-752" },
  { id: "bulk-select", screen: "approvals", ps: "PS2", label: "まとめて承認：行の四角で 2 件を選んだ（上に「2 件を選んでいます」）", ticket: "K-769" },
  { id: "bulk-confirm-all", screen: "approvals", ps: "PS2", label: "まとめて承認（全部）の確かめ：件数・取り消せない物・チェックの無い確認項目", ticket: "K-769" },
  { id: "bulk-confirm-selected", screen: "approvals", ps: "PS2", label: "選んだものを承認の確かめ（2 件・取り消せない物 2 件）", ticket: "K-769" },
  { id: "bulk-running", screen: "approvals", ps: "PS2", label: "まとめて承認しています（小窓の主ボタンが処理中）", ticket: "K-769" },
  { id: "bulk-done", screen: "approvals", ps: "PS2", label: "まとめて承認した後（2 件を承認・残りの一覧）", ticket: "K-769" },
  { id: "bulk-partial", screen: "approvals", ps: "PS2", label: "一部は先に決まっていて承認できなかった（件数と行）", ticket: "K-769" },
  { id: "bulk-mobile", screen: "approvals", ps: "PS2", label: "スマホ：カードの四角で選び、下に貼り付く帯と下から出る確かめの小窓", ticket: "K-769" },
  { id: "room-overview", screen: "ai-room", ps: "PS2", label: "部屋のようす：いま・このあと・あなたを待っている・育ち具合の数 3 つ（タブは ようす・話す・やったこと＋ナレッジへ）", ticket: "K-755" },
  { id: "room-idle", screen: "ai-room", ps: "PS2", label: "部屋のようす：いまは何もしていない（待っている物も無い）", ticket: "K-755" },
  { id: "room-stopped", screen: "ai-room", ps: "PS2", label: "部屋のようす：止まった 1 件があなたを待っている", ticket: "K-755" },
  { id: "room-pc-none", screen: "ai-room", ps: "PS0", label: "PC がまだ：PC をつなぐ案内・何もしていない（話すだけはできる）", ticket: "K-755" },
  { id: "room-pc-closed", screen: "ai-room", ps: "PS3", label: "PC が閉じている：お休み中・開けば続きを始める", ticket: "K-755" },
  { id: "room-loading", screen: "ai-room", ps: "PS2", label: "部屋を読み込んでいる", ticket: "K-755" },
  { id: "room-failed", screen: "ai-room", ps: "PS2", label: "部屋が読めなかった", ticket: "K-755" },
  { id: "room-mobile", screen: "ai-room", ps: "PS2", label: "部屋のようす：スマホでは 1 列に積み、下に「高本のAI と話す」の入口が貼り付く", ticket: "K-755" },
  { id: "done-list", screen: "ai-room", ps: "PS2", label: "やったこと：札・期間・日ごとの行・行からチケットへ", ticket: "K-756" },
  { id: "done-filter-stopped", screen: "ai-room", ps: "PS2", label: "やったこと：「止まった」の札で絞った", ticket: "K-756" },
  { id: "done-empty", screen: "ai-room", ps: "PS2", label: "やったこと：まだ何もしていない（空）", ticket: "K-756" },
  { id: "done-empty-filter", screen: "ai-room", ps: "PS2", label: "やったこと：札で絞ったら 0 件", ticket: "K-756" },
  { id: "done-loading", screen: "ai-room", ps: "PS2", label: "やったこと：読み込んでいる", ticket: "K-756" },
  { id: "done-failed", screen: "ai-room", ps: "PS2", label: "やったこと：読めなかった", ticket: "K-756" },
  { id: "talk-convs", screen: "ai-room", ps: "PS2", label: "話す：会話を選ぶ（スマホでは会話の一覧だけの画面・「＋ 新しく話す」）", ticket: "K-762" },
  { id: "talk-chat-mobile", screen: "ai-room", ps: "PS2", label: "話す：会話の中（吹き出し・書く欄・添付と許可は押せない形。スマホでは「‹」で一覧へ戻る別の画面）", ticket: "K-762" },
  { id: "talk-new", screen: "ai-room", ps: "PS2", label: "話す：＋新しく話す を押した（まだ何も話していない）", ticket: "K-762" },
  { id: "talk-sending", screen: "ai-room", ps: "PS2", label: "話す：言葉を送っている（送るが処理中）", ticket: "K-762" },
  { id: "talk-working", screen: "ai-room", ps: "PS2", label: "話す：AI が作業中（作業中の 1 行と止める）", ticket: "K-762" },
  { id: "talk-stopped", screen: "ai-room", ps: "PS2", label: "話す：止めた後（止まった理由＝あなたが止めた）", ticket: "K-762" },
  { id: "talk-stopped-pc", screen: "ai-room", ps: "PS3", label: "話す：PC が閉じて止まった（理由と、開けば続けられること）", ticket: "K-762" },
  { id: "talk-permission", screen: "ai-room", ps: "PS2", label: "話す：AI が許可を求め、自動で断った 1 行", ticket: "K-762" },
  { id: "talk-pc-none", screen: "ai-room", ps: "PS0", label: "話す：PC がまだ（PC をつなぐ案内・書く欄は書けない）", ticket: "K-762" },
  { id: "tk-talk-panel", screen: "tickets", ps: "PS2", label: "チケットの右のパネル：「高本のAI」タブの会話", ticket: "K-764" },
  { id: "tk-talk-empty", screen: "tickets", ps: "PS2", label: "チケットの右のパネル：まだ話していない", ticket: "K-764" },
  { id: "tk-talk-working", screen: "tickets", ps: "PS2", label: "チケットの右のパネル：AI が作業中（止める）", ticket: "K-764" },
  { id: "tk-talk-band-running", screen: "tickets", ps: "PS2", label: "帯の［AI と話す］を押した：作っている途中の相談", ticket: "K-764" },
  { id: "talk-writing", screen: "ai-room", ps: "PS2", label: "話す：書きながら返事をしている途中（止める）", ticket: "K-762" },
  { id: "tk-talk-from-create", screen: "tickets", ps: "PS2", label: "作った後：作る時の会話がチケットの右のパネルに続き、［AI に任せる］が出る", ticket: "K-767" },
  { id: "create-talk-empty", screen: "tickets", ps: "PS2", label: "作る画面：左に欄・右に会話（何を作りたいか話しかける案内と例 3 つ）", ticket: "K-767" },
  { id: "create-talk-thinking", screen: "tickets", ps: "PS2", label: "作る画面：AI が考えている（作業中の 1 行・止める）", ticket: "K-767" },
  { id: "create-talk-writing", screen: "tickets", ps: "PS2", label: "作る画面：書きながら返事をしている途中（止める）", ticket: "K-767" },
  { id: "create-talk-proposal", screen: "tickets", ps: "PS2", label: "作る画面：AI の案のカード（全部使う・選んで使う）", ticket: "K-777" },
  { id: "create-talk-select", screen: "tickets", ps: "PS2", label: "作る画面：選んで使う（欄ごとにチェック）", ticket: "K-777" },
  { id: "create-talk-applied-all", screen: "tickets", ps: "PS2", label: "作る画面：全部使った（欄に入り、入った欄に「AI の案」の印）", ticket: "K-777" },
  { id: "create-talk-applied-some", screen: "tickets", ps: "PS2", label: "作る画面：選んで使った（本文は使っていない）", ticket: "K-777" },
  { id: "create-talk-edited", screen: "tickets", ps: "PS2", label: "作る画面：人が欄を直した後に話した（直した欄を AI に渡した印・AI がそれを踏まえて答える）", ticket: "K-767" },
  { id: "create-talk-error", screen: "tickets", ps: "PS2", label: "作る画面：AI が答えを返せなかった（欄の中身は消えない）", ticket: "K-767" },
  { id: "create-talk-nopc", screen: "tickets", ps: "PS0", label: "作る画面：PC がまだ（会話は押せない形・自分で書く欄はそのまま使える）", ticket: "K-767" },
  { id: "create-talk-mobile", screen: "tickets", ps: "PS2", label: "作る画面（スマホ）：頭の［AI と話して作る］で会話が全画面で出る", ticket: "K-767" },
  { id: "create-talk-mobile-form", screen: "tickets", ps: "PS2", label: "作る画面（スマホ）：欄の画面（頭に［AI と話して作る］）", ticket: "K-767" },
  { id: "tk-talk-pc-none", screen: "tickets", ps: "PS0", label: "チケットの右のパネル：PC がまだ（話せない案内）", ticket: "K-764" },
];

export function MockView({ id, theme }: { id: string; theme: Theme }) {
  const entry = MOCKS.find((m) => m.id === id);
  if (!entry) return <p>この状態はまだありません</p>;
  for (const g of GROUPS) {
    const node = g.view(id, theme);
    if (node !== null) return <div data-ps={entry.ps}>{node}</div>;
  }
  return <p>この状態はまだありません</p>;
}
