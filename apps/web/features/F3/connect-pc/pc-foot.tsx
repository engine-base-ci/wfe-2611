// 「PC と使った量」の本文の下：本文の知らせ（K-349 で connect-pc.tsx からそのまま移した）。
//   前の画面への文は、K-367 で前の画面ごと消した（知らせの <p> は本文の箱の最後の子のまま）

export function PcFoot({ note }: { note: string | null }) {
  return note ? (
    <p role="status" className="k-pc-note">
      {note}
    </p>
  ) : null;
}
