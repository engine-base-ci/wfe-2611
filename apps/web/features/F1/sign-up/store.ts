// 登録の画面と待つ画面のあいだで持つもの（K-51・D-128.142）。どちらもこのタブの中だけ（sessionStorage）に置く。
//   ・申し込み：登録の答えで受け取った申し込みの印・メール・送れたか。待つ画面はこの印で状態を引き、送り直す（メールでは引かない）。
//     再読み込み・戻る・進むでも同じ申し込みを引く（二重に申し込まない）
//   ・書きかけ：送っている途中で再読み込みしても、メール・名前・会社名は消えない。パスワードは残さない
export interface SignupTicket {
  token: string;
  email: string;
  sent: boolean;
  mailError: string | null;
}
export interface SignupDraft {
  email: string;
  name: string;
  company: string;
}
const TICKET = "kaname.signup";
const DRAFT = "kaname.signup.draft";

const read = <T>(key: string): T | null => {
  try {
    const v = window.sessionStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
};
const write = (key: string, v: unknown): void => {
  try {
    if (v === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* 保存できない（private mode 等）。画面の中の値で続ける */
  }
};

export const readTicket = (): SignupTicket | null => {
  const t = read<SignupTicket>(TICKET);
  return t && typeof t.token === "string" && typeof t.email === "string" ? t : null;
};
export const saveTicket = (t: SignupTicket | null): void => write(TICKET, t);
export const readDraft = (): SignupDraft | null => read<SignupDraft>(DRAFT);
export const saveDraft = (d: SignupDraft | null): void => write(DRAFT, d);
