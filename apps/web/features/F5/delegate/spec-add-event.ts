// 「確認項目を足す」の合図（K-573）。任せる小窓の「確認項目を足す」が出し、確認項目の欄（K-450）が聞いて足す小窓を開く。
//   名前はこの 1 か所が持つ（聞く側は同じ字を使う・import しない）。detail は { ticketId }（自分のチケットの合図だけで開く）
export const OPEN_SPEC_ADD_EVENT = "kaname:f4:open-spec-add";

export interface OpenSpecAddDetail {
  ticketId: string;
}

/** 確認項目を足す小窓を開く合図を出す */
export const openSpecAdd = (ticketId: string): void => {
  window.dispatchEvent(new CustomEvent<OpenSpecAddDetail>(OPEN_SPEC_ADD_EVENT, { detail: { ticketId } }));
};
