// 分身の部屋の下絵の見本の値（段 6・room の束）。人は 高本 聖斗（画面の字は「高本のAI」）・佐藤 花子・鈴木 一郎、会社 ENGINE BASE
import type { DoneDay, DoneRow } from "@/features/F5/room/done";
import type { GrowthView, NextRow, NowView } from "@/features/F5/room/overview";
import type { CreateValues } from "@/features/F5/room/create-talk";
import type { ConvItem, Entry } from "@/features/F5/room/talk";

export const GROWTH: GrowthView = { assigned: 18, passRate: 72, lastWeek: 61, workTime: "6.2h" };
export const GROWTH_NEW: GrowthView = { assigned: 0, passRate: null, workTime: "0h" };

export const NOW: NowView = {
  ticket: "EG-127",
  title: "発注ナビの応募文を作っています",
  since: "3 分前から",
};
export const NEXT: readonly NextRow[] = [
  { ticket: "EG-121", title: "見積の根拠を確かめる", state: "順番待ち" },
  { ticket: "KR-031", title: "入金の照合を記録する", state: "承認済み", warn: true },
];
export const NEXT_STOPPED: readonly NextRow[] = [
  { ticket: "EG-130", title: "経費の申請を出し直す", state: "止まった", warn: true },
];

const SENT: DoneRow = {
  id: "a1",
  time: "10:42",
  kind: "ran",
  title: "請求書の PDF を先方にメールで送った",
  ticket: "EG-124",
  detail: "承認（11/02 10:30・高本）の後に実行",
  result: "完了",
  tone: "success",
};
const MADE: DoneRow = {
  id: "a2",
  time: "10:20",
  kind: "made",
  title: "請求書を作り、承認待ちに出した",
  ticket: "EG-128",
  detail: "確認項目 3 件のうち 3 件に AI がチェックを付けた",
  result: "承認待ち",
  tone: "warning",
};
const NOTE: DoneRow = {
  id: "a3",
  time: "10:05",
  kind: "made",
  title: "打ち合わせのまとめを書いた",
  ticket: "EG-133",
  result: "そのまま通った",
  tone: "success",
};
const FIXED: DoneRow = {
  id: "a4",
  time: "16:20",
  kind: "made",
  title: "見積の下書きを作った",
  ticket: "EG-131",
  detail: "高本が直した（版 3）",
  result: "直された",
  tone: "warning",
};
const STOPPED: DoneRow = {
  id: "a5",
  time: "14:02",
  kind: "stopped",
  title: "経費の申請が止まった",
  ticket: "EG-130",
  detail: "止まった理由：領収書の日付が読めませんでした",
  result: "止まった",
  tone: "danger",
};
const APPLY: DoneRow = {
  id: "a6",
  time: "11:15",
  kind: "made",
  title: "求人の応募文を 3 本書いた",
  ticket: "EG-127",
  detail: "確認項目 2 件のうち 2 件に AI がチェックを付けた",
  result: "そのまま通った",
  tone: "success",
};
const BACK: DoneRow = {
  id: "a7",
  time: "18:40",
  kind: "ran",
  title: "提案書の骨組みが差し戻された",
  ticket: "EG-098",
  detail: "佐藤：「結論が先に見えない」",
  result: "差し戻し",
  tone: "warning",
};

export const DONE_DAYS: readonly DoneDay[] = [
  { label: "今日 11/2（月）", rows: [SENT, MADE, NOTE] },
  { label: "11/1（日）", rows: [FIXED, STOPPED, APPLY] },
  { label: "10/31（土）", rows: [BACK] },
];
export const DONE_STOPPED: readonly DoneDay[] = [{ label: "11/1（日）", rows: [STOPPED] }];
export const DONE_SUMMARY = { total: 23, passed: 19, fixed: 3, stopped: 1 } as const;

export const CONVS: readonly ConvItem[] = [
  { id: "c1", title: "来月の営業の段取りを考えたい", sub: "今日 09:40", group: "今日" },
  { id: "c2", title: "保守更新 3 社の更新案", sub: "11/01", group: "それ以前" },
  { id: "c3", title: "応募文の書き出しを柔らかく", sub: "10/30", group: "それ以前" },
];

const ME_Q: Entry = {
  kind: "msg",
  msg: {
    id: "m1",
    who: "me",
    time: "09:40",
    body: "12 月は既存のお客さんの保守更新と、新規を 3 件取りたい。何から手を付ける？",
  },
};
const AI_A: Entry = {
  kind: "msg",
  msg: {
    id: "m2",
    who: "ai",
    time: "09:41",
    body: "今月の数字から見ると、保守更新は 3 社が 12 月に期限です。新規は発注ナビの応募の採用率が 18% なので、3 件取るには 17 件ほど応募が要ります。順番の案です。",
  },
};
const ME_Q2: Entry = {
  kind: "msg",
  msg: { id: "m3", who: "me", time: "09:44", body: "保守更新の更新案は、セイコー様から先に出したい" },
};
const DAY: Entry = { kind: "day", label: "今日 11/2（月）" };

export const TALK_LIST: readonly Entry[] = [DAY, ME_Q, AI_A];
export const TALK_WORKING: readonly Entry[] = [
  ...TALK_LIST,
  ME_Q2,
  { kind: "work", text: "考えています…（EG-124 の見積を確かめています）" },
];
export const TALK_WRITING: readonly Entry[] = [
  ...TALK_LIST,
  ME_Q2,
  {
    kind: "stream",
    text: "セイコー様は 12/15 が期限なので先に出すのがよさそうです。更新案には、今期の稼働時間と、来期に増やしたい保守の範囲を",
  },
];
export const TALK_STOPPED: readonly Entry[] = [
  ...TALK_LIST,
  ME_Q2,
  { kind: "sys", text: "高本が AI を止めました。ここまでの返事は残っています" },
];
export const TALK_PERMISSION: readonly Entry[] = [
  ...TALK_LIST,
  ME_Q2,
  { kind: "sys", text: "高本のAI が許可を求めましたが、自動で断りました（許可に答える画面はまだ使えません）" },
  {
    kind: "msg",
    msg: {
      id: "m4",
      who: "ai",
      time: "09:45",
      body: "先方の請求書システムは開けなかったので、手元の見積の情報だけで更新案を作ります。",
    },
  },
];

const PANEL_ASK: Entry = {
  kind: "msg",
  msg: {
    id: "p1",
    who: "me",
    time: "10:41",
    body: "鈴木さんの書き込みのとおり、10/19 の追加対応は無償だったので外して作り直して",
  },
};
// 右のパネルの会話も、本番（talk-words.ts の日の区切り）と同じく最初に日の区切りを置く（PM の決め 2026-11-28：下絵を本番の形に）
export const PANEL_TALK: readonly Entry[] = [
  DAY,
  PANEL_ASK,
  {
    kind: "msg",
    msg: {
      id: "p2",
      who: "ai",
      time: "10:41",
      body: "10/19 分（30,000 円）を外すと、合計は 1,716,000 円から 1,683,000 円になります。成果物を作り直してよければ、続けて任せてください。",
    },
  },
];
export const PANEL_PROGRESS: readonly Entry[] = [
  DAY,
  { kind: "msg", msg: { id: "p3", who: "me", time: "10:45", body: "いまどこまで進んだ？" } },
  {
    kind: "msg",
    msg: {
      id: "p4",
      who: "ai",
      time: "10:45",
      body: "請求書の PDF を作り終えたところです。これから金額を見積と突き合わせます。",
    },
  },
];
export const PANEL_WORKING: readonly Entry[] = [
  DAY,
  PANEL_ASK,
  { kind: "work", text: "考えています…（EG-097 の単価を確かめています）" },
];

// ---- 作る画面の右の会話（create-talk-）
export const STARTERS = [
  "セイコー様に 12 月分の作業報告書を送るチケットを作りたい",
  "来週の定例の議事録をまとめるチケットを作りたい",
  "経費の申請を出し直すチケットを作りたい",
] as const;

export const FILLED: CreateValues = {
  title: "セイコー様へ 12 月分の作業報告書を送る",
  body: "11 月分と同じ形で、12 月分の作業報告書を作ります。\nできたら PDF にして、セイコー商事の山田様にメールで送ってください。年内（12/26 まで）に送ります。",
  checks: ["作業時間の合計が稼働記録と同じ", "宛名が山田様になっている", "12/26 までに送っている"],
  marks: { title: "ai", body: "ai", checks: "ai" },
};
export const FILLED_SOME: CreateValues = {
  ...FILLED,
  body: "",
  marks: { title: "ai", checks: "ai" },
};
export const EDITED: CreateValues = {
  ...FILLED,
  title: "セイコー様へ 12 月分の作業報告書を 12/26 までに送る",
  body: "11 月分と同じ形で、12 月分の作業報告書を作ります。\nできたら PDF にして、セイコー商事の山田様と鈴木さんにメールで送ってください。12/26 までに送ります。",
  marks: { title: "edited", body: "edited", checks: "ai" },
};
export const SELF_TYPED: CreateValues = {
  title: "来週の定例の議事録をまとめる",
  body: "",
  checks: [],
};

const CT_ME: Entry = {
  kind: "msg",
  msg: {
    id: "cm1",
    who: "me",
    time: "10:40",
    body: "セイコー様に 12 月分の作業報告書を年内に送りたい。形は 11 月と同じ",
  },
};
const ITEMS_NEW = [
  { key: "title", label: "題名", preview: "セイコー様へ 12 月分の作業報告書を送る" },
  { key: "body", label: "本文", preview: "11 月分と同じ形で 12 月分の作業報告書を作り、PDF で山田様にメールで送る" },
  { key: "checks", label: "確認項目（3 件）", preview: "作業時間の合計が稼働記録と同じ ほか 2 件" },
] as const;
const PROPOSAL = { mode: "open", items: ITEMS_NEW } as const;

export const CT_PROPOSAL: readonly Entry[] = [
  CT_ME,
  {
    kind: "msg",
    msg: {
      id: "cm2",
      who: "ai",
      time: "10:40",
      body: "11 月分のチケットを見て案を作りました。欄に入れる物を選んでください。期限は 12/26（金）にしています。",
    },
  },
  { kind: "proposal", proposal: PROPOSAL },
];
export const CT_SELECT: readonly Entry[] = [
  ...CT_PROPOSAL.slice(0, 2),
  {
    kind: "proposal",
    proposal: {
      mode: "select",
      items: [
        { ...ITEMS_NEW[0], checked: true },
        { ...ITEMS_NEW[1], checked: false },
        { ...ITEMS_NEW[2], checked: true },
      ],
    },
  },
];
export const CT_APPLIED_ALL: readonly Entry[] = [
  ...CT_PROPOSAL.slice(0, 2),
  { kind: "proposal", proposal: { mode: "all", items: ITEMS_NEW.map((i) => ({ ...i, result: "in" as const })) } },
  {
    kind: "msg",
    msg: {
      id: "cm3",
      who: "ai",
      time: "10:41",
      body: "左の欄に入れました。足りない物はありますか？ 例えば、山田様のほかに送る人がいれば足します。",
    },
  },
];
export const CT_APPLIED_SOME: readonly Entry[] = [
  ...CT_PROPOSAL.slice(0, 2),
  {
    kind: "proposal",
    proposal: {
      mode: "some",
      items: [
        { ...ITEMS_NEW[0], result: "in" },
        { ...ITEMS_NEW[1], result: "skipped" },
        { ...ITEMS_NEW[2], result: "in" },
      ],
    },
  },
  {
    kind: "msg",
    msg: {
      id: "cm3",
      who: "ai",
      time: "10:41",
      body: "題名と確認項目だけ入れました。本文はあなたが書いた形で進めますか？ 必要なら、本文の案をもう一度出します。",
    },
  },
];
export const CT_EDITED: readonly Entry[] = [
  ...CT_APPLIED_ALL,
  {
    kind: "msg",
    msg: {
      id: "cm4",
      who: "me",
      time: "10:43",
      passed: "題名・本文（直した）を AI に渡しました",
      body: "鈴木さんにも送るので、確認項目にも入れて",
    },
  },
  {
    kind: "msg",
    msg: {
      id: "cm5",
      who: "ai",
      time: "10:43",
      body: "直した題名の「12/26 までに」と、本文の「鈴木さん」を踏まえました。確認項目に「鈴木さんにも送っている」を足す案です。",
    },
  },
];
export const CT_THINKING: readonly Entry[] = [
  CT_ME,
  { kind: "work", text: "考えています…（EG-098 11 月分を見ています）" },
];
export const CT_WRITING: readonly Entry[] = [
  CT_ME,
  {
    kind: "stream",
    text: "11 月分のチケットを見ました。同じ形なら、題名は「セイコー様へ 12 月分の作業報告書を送る」、本文には",
  },
];
/** 送れなかった言葉は書く欄だけに残す（会話の行に出さない・K-767 の決め） */
export const CT_ERROR: readonly Entry[] = [];

// ---- チケットの右のパネルに続いた、作る時の会話（tk-talk-from-create）
export const FROM_CREATE: readonly Entry[] = [
  ...CT_APPLIED_ALL.slice(0, 3),
  { kind: "sys", text: "このチケットを作りました（EG-129）。作る時の会話はここに続きます" },
  {
    kind: "msg",
    msg: {
      id: "fc1",
      who: "ai",
      time: "10:45",
      body: "作る時に話した内容は、このまま使えます。任せられる準備ができています。",
    },
  },
];
