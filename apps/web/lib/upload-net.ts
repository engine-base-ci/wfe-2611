// 問い合わせの添付（K-953）を上げる口：Kaname の口（uploadInquiryAttachment）が返した 2 つの URL にだけ送る。
//   upload_url＝関門 C4 が大きさと種類を署名した置き場の上げ先・done_url＝Kaname の上げ終わりの受け口（1 回だけの印つき）。
//   外へ出る口（fetch）は関門 C1 の例外 X-010（apps/web/lib）の中に置き、宛先は Kaname が返した URL だけ（net_boundary の allow・G16b）
export interface UploadTarget {
  id: string;
  upload_url: string;
  done_url: string;
}

/** 置き場の署名つきの上げ先へ体をそのまま PUT する（体は Kaname の口を通さない・K-950） */
export function putSignedUpload(t: UploadTarget, file: File): Promise<Response> {
  return fetch(t.upload_url, { method: "PUT", body: file, headers: { "content-type": file.type } });
}

/** Kaname の上げ終わりの受け口へ知らせる */
export function postUploadDone(t: UploadTarget): Promise<Response> {
  return fetch(t.done_url, { method: "POST" });
}
