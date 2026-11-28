// 請求書の PDF の中身（K-1013・D-156.31・D-156.59：普通の請求書と同じ項目）。純粋な関数だけ：DB にも置き場（関門 C4）にも触らない。
//   invoicePdfLines  … 上から並べる字の行（試験 K1013-UN-001〜003・005 の形が正）
//   renderInvoicePdf … A4 縦 1 枚に上の行を並べた PDF の中身（pdf-lib 1.17.1 ＋ @pdf-lib/fontkit 1.1.1・D-156.42）
//   字の書体は同梱の Noto Sans JP の静的な TrueType（assets/NotoSansJP-Regular.ttf・SIL OFL・assets/OFL.txt）を使う字だけ埋め込む。
//   書体のファイルは同梱物を読むだけ（例外 X-018：利用者由来のパスを受け取らない・書かない）。.otf（CFF）は subset で字が化けるので使わない
import { readFile } from "node:fs/promises";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";

export interface InvoicePdfInput {
  invoiceId: string;
  /** 請求の月（YYYY-MM） */
  month: string;
  /** 出した日・期限（YYYY-MM-DD・日本の暦） */
  issuedOn: string;
  dueOn: string;
  workspaceName: string;
  /** 請求先（tenants.billing_contact・K-958）。会社名が空ならワークスペースの名前 */
  contact: { company: string; attn: string; email: string };
  planName: string;
  /** 税別の値段・消費税・日割り（税込）・合計（税込）。どれも円 */
  amount: number;
  tax: number;
  prorated: number;
  total: number;
  /** 振込先の行（設定の値・D-125.24）。空なら「お振込先は別にお知らせします」 */
  payeeLines: readonly string[];
  /** インボイスの登録番号（設定の値）。空なら行なし */
  invoiceNo: string;
  /** 出す側（会社名・住所・連絡先・備考）。会社名のほかは空なら行なし */
  issuer: { name: string; address: string; contact: string; note: string };
}

const yen = (n: number): string => `¥${Math.trunc(n).toLocaleString("en-US")}`;
const day = (iso: string): string => iso.slice(0, 10).replaceAll("-", "/");
const monthLabel = (ym: string): string => {
  const [y, m] = ym.split("-");
  return `${y} 年 ${Number(m)} 月分`;
};
const filled = (s: string | undefined): s is string => typeof s === "string" && s.trim() !== "";

/** 上から並べる字の行 */
export function invoicePdfLines(i: InvoicePdfInput): string[] {
  const company = filled(i.contact.company) ? i.contact.company : i.workspaceName;
  const payee = i.payeeLines.filter(filled);
  return [
    "請求書",
    `${company} 御中`,
    ...(filled(i.contact.attn) ? [`${i.contact.attn} 様`] : []),
    monthLabel(i.month),
    `発行日 ${day(i.issuedOn)}`,
    `お支払い期限 ${day(i.dueOn)}`,
    `${i.planName}（月額） ${yen(i.amount)}`,
    `消費税（10%） ${yen(i.tax)}`,
    ...(i.prorated !== 0 ? [`プランを上げた日割り ${yen(i.prorated)}`] : []),
    `合計（税込） ${yen(i.total)}`,
    ...(payee.length ? ["お振込先", ...payee] : ["お振込先は別にお知らせします"]),
    i.issuer.name,
    ...(filled(i.issuer.address) ? [i.issuer.address] : []),
    ...(filled(i.invoiceNo) ? [`登録番号 ${i.invoiceNo}`] : []),
    ...(filled(i.issuer.contact) ? [`連絡先 ${i.issuer.contact}`] : []),
    ...(filled(i.issuer.note) ? [`備考 ${i.issuer.note}`] : []),
  ];
}

/**
 * glyf の 1 字ごとの塊を 4 バイトにそろえた書体の中身を作る（形は変えない・並べ直すだけ）。
 *   配布元の Noto Sans JP（静的な TrueType）は塊の長さが奇数の字を持つ。@pdf-lib/fontkit 1.1.1 の subset は
 *   小さい書体で loca を短い形（位置 ÷ 2）で書くので、奇数の長さがあると後ろの字の位置がずれて字が欠ける（2026-11-26 に確かめた）。
 *   同梱のファイルは配布元のまま置き、埋め込む前にメモリの中でだけそろえる
 */
function padGlyphs(src: Uint8Array): Uint8Array {
  const v = new DataView(src.buffer, src.byteOffset, src.byteLength);
  const n = v.getUint16(4);
  const dir = Array.from({ length: n }, (_, k) => {
    const p = 12 + 16 * k;
    return { tag: String.fromCharCode(...src.subarray(p, p + 4)), off: v.getUint32(p + 8), len: v.getUint32(p + 12) };
  });
  const tab = (t: string) => dir.find((d) => d.tag === t);
  const head = tab("head");
  const loca = tab("loca");
  const glyf = tab("glyf");
  const maxp = tab("maxp");
  if (!head || !loca || !glyf || !maxp) return src;
  const glyphs = v.getUint16(maxp.off + 4);
  const long = v.getInt16(head.off + 50) === 1;
  const at = (k: number) => (long ? v.getUint32(loca.off + 4 * k) : v.getUint16(loca.off + 2 * k) * 2);
  const pad4 = (x: number) => (x + 3) & ~3;
  const offs: number[] = [0];
  const parts: Uint8Array[] = [];
  for (let k = 0; k < glyphs; k++) {
    const piece = src.subarray(glyf.off + at(k), glyf.off + at(k + 1));
    const out = new Uint8Array(pad4(piece.byteLength));
    out.set(piece);
    parts.push(out);
    offs.push(offs[k]! + out.byteLength);
  }
  const newGlyf = new Uint8Array(offs[glyphs]!);
  parts.forEach((p, k) => newGlyf.set(p, offs[k]!));
  const newLoca = new Uint8Array(4 * (glyphs + 1));
  const lv = new DataView(newLoca.buffer);
  offs.forEach((o, k) => lv.setUint32(4 * k, o));
  const newHead = src.slice(head.off, head.off + head.len);
  new DataView(newHead.buffer).setInt16(50, 1);
  new DataView(newHead.buffer).setUint32(8, 0); // checkSumAdjustment（fontkit は見ない・subset が作り直す）
  const body = (t: { tag: string; off: number; len: number }): Uint8Array =>
    t.tag === "glyf"
      ? newGlyf
      : t.tag === "loca"
        ? newLoca
        : t.tag === "head"
          ? newHead
          : src.subarray(t.off, t.off + t.len);
  const bodies = dir.map(body);
  let pos = 12 + 16 * n;
  const places = bodies.map((b) => {
    const p = pos;
    pos += pad4(b.byteLength);
    return p;
  });
  const out = new Uint8Array(pos);
  const ov = new DataView(out.buffer);
  out.set(src.subarray(0, 12));
  dir.forEach((d, k) => {
    const b = bodies[k]!;
    const p = 12 + 16 * k;
    out.set(src.subarray(p, p + 4), p);
    let sum = 0;
    const padded = new Uint8Array(pad4(b.byteLength));
    padded.set(b);
    const pv = new DataView(padded.buffer);
    for (let q = 0; q < padded.byteLength; q += 4) sum = (sum + pv.getUint32(q)) >>> 0;
    ov.setUint32(p + 4, sum);
    ov.setUint32(p + 8, places[k]!);
    ov.setUint32(p + 12, b.byteLength);
    out.set(b, places[k]!);
  });
  return out;
}

/** 同梱の書体の場所：このパッケージの assets（手元・Docker）か、まとめた 1 本の横の assets（Vercel・apps/api/build-vercel.mjs が写す） */
const FONT_URLS = [
  new URL("../assets/NotoSansJP-Regular.ttf", import.meta.url),
  new URL("./assets/NotoSansJP-Regular.ttf", import.meta.url),
];
const readFirst = async (): Promise<Uint8Array> => {
  let last: unknown;
  for (const u of FONT_URLS) {
    try {
      return new Uint8Array(await readFile(u));
    } catch (e) {
      last = e;
    }
  }
  throw last;
};
let fontBytes: Promise<Uint8Array> | null = null;
/** 同梱の書体（1 回だけ読む）。読めなければ次の呼び出しで読み直す */
const loadFont = (): Promise<Uint8Array> => {
  fontBytes ??= readFirst().then(padGlyphs, (e: unknown) => {
    fontBytes = null;
    throw e;
  });
  return fontBytes;
};

/** A4 縦（pt） */
const PAGE = { width: 595.28, height: 841.89 } as const;
const MARGIN = 56;
const SIZE = { title: 18, body: 11 } as const;

/** 幅に収まらない行を字の単位で折る */
function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const out: string[] = [];
  let cur = "";
  for (const ch of text) {
    if (cur && font.widthOfTextAtSize(cur + ch, size) > max) {
      out.push(cur);
      cur = ch;
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

/** A4 縦 1 枚に invoicePdfLines の行を上から並べる（題 18・ほか 11・飾りなし） */
export async function renderInvoicePdf(i: InvoicePdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`請求書 ${monthLabel(i.month)}`);
  const font = await doc.embedFont(await loadFont(), { subset: true });
  const page = doc.addPage([PAGE.width, PAGE.height]);
  const max = PAGE.width - MARGIN * 2;
  let y = PAGE.height - MARGIN;
  invoicePdfLines(i).forEach((line, n) => {
    const size = n === 0 ? SIZE.title : SIZE.body;
    for (const part of wrap(line, font, size, max)) {
      y -= size * 1.6;
      page.drawText(part, { x: MARGIN, y, size, font, color: rgb(0, 0, 0) });
    }
    if (n === 0) y -= SIZE.body;
  });
  return doc.save({ useObjectStreams: false });
}
