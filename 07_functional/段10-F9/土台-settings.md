# 土台：チケットの設定（種別・状態・項目のマスタ）の口と答えの形（段 10・K-704〜K-706・K-717 が決め、K-707〜K-709・K-720・K-715 が読む）

> 2026-11-22 切る段（段 10 v2）。正本：切り方 0.13・下絵 v2（`apps/web/features/F9/settings/views.tsx`・`ws-mocks.tsx` の set-kinds・set-stages・set-fields）・段 5 の K-560・K-561・K-563・K-564・K-578。
> 食い違ったら、代表の決め（`段10-すり合わせ-2026-11-21.md`）→ 切り方 → この文書の順で上が勝つ。

## 1. 何を作るか（1 枚で）

会社の管理者が、チケットの「種別」「状態」「項目」を、画面で足す・直す・並べる・消す。読む口は段 5 までにほぼ在るので、**書く口 12 本と、項目のマスタを読む口 1 本だけ（項目は K-706 と K-717 の 2 本に分けた）**を足す。

| 葉 | 書く口 | 読む口（前からの物の直し・足し） |
|---|---|---|
| K-704 種別 | `createTicketKind`・`updateTicketKind`・`deleteTicketKind`・`reorderTicketKinds` | `listTicketKinds` に `color_key` を 1 つ足す（段 5 K-560 の答えの上に） |
| K-705 状態 | `createTicketStage`・`updateTicketStage`・`deleteTicketStage`・`reorderTicketStages` | `listTicketStages` の答えを決める（今は表の行をそのまま返す。画面はまだ使っていない） |
| K-706 項目（読む・足す） | `createTicketField` | `listTicketFieldMaster`（新設・管理者だけ。段 5 の `listTicketFields` は鍵 7 の約束なので変えない） |
| K-717 項目（直す・並べる・消す。K-706 の分け・K-706 に依存） | `updateTicketField`・`deleteTicketField`・`reorderTicketFields` | — |
| K-720 項目（足す・消す。画面） | — （口は持たない。`createTicketField`〔K-706〕・`deleteTicketField`〔K-717〕を呼ぶ。K-709 の分け） | — |

二重に作らない物（段 5 が作る）：表 `custom_fields`・`custom_field_kinds`・`ticket_field_values`（K-563）・`ticket_kinds.body_template`（K-561）・読む口 `listTicketKinds`（K-560）・`listTicketFields`（K-563）・値を書く口（K-564）・`toTicketField`（`features/F4/ticket-fields/shape.ts`）。**前の「チケットの形」（区画）の口 `getTicketShape`・`saveTicketShape`・`previewTicketShapeChange` は使わない**（外すのは K-711）。

## 2. 色（見分けの色 8 つを鍵で持つ）

- 正本：`04_design/DESIGN-kaname.md` の `data:`（D-023）の 8 つ。鍵は **`indigo`・`teal`・`amber`・`coral`・`sage`・`plum`・`lavender`・`teal-light`**（下絵の `Tone` と同じ）。画面は `var(--k-d-<鍵>)` で出す（明・暗のトークンが別々なので、16 進を持たず鍵で持つ）
- 種別・状態は列 **`color_key text`**（8 つの check）を持つ。**鍵が元・`ticket_kinds.color`（16 進）は段 5 までの読み手のために残し、鍵から DB の引き金が合わせる**（`app.tone_hex(text)` 1 か所。L-002 の 2 つの持ち方を 1 つの関数に寄せる）。今ある種別の 16 進は `app.ticket_kind_color_key_from_hex(text)` で鍵に直す（8 つの 16 進に一致すればその鍵・一致しなければ `indigo`）。状態は新しい列で、key から初めの色（todo＝teal-light・doing＝indigo・hold＝plum・checking＝teal・awaiting_approval＝amber・running＝coral・done＝sage）を入れる
- 項目のマスタに色は無い（下絵に無い）

## 3. 口の一覧（権限・上限・形）

| 口 | 道 | 入力 | 答え | 権限（資源の edit） |
|---|---|---|---|---|
| createTicketKind | POST /ticket_kinds | `{ name, color_key, body_template? }` | 201 `{ data: TicketKindSetting }` | `ticket_kinds` |
| updateTicketKind | PATCH /ticket_kinds/:id | `{ name?, color_key?, body_template? }`（1 つ以上） | 200 `{ data: TicketKindSetting }` | 同上 |
| deleteTicketKind | DELETE /ticket_kinds/:id | — | 200 `{ data: { id } }` | 同上 |
| reorderTicketKinds | POST /ticket_kinds/order | `{ kind_ids: uuid[] }`（1 つ以上） | 200 `{ data: TicketKindSetting[] }` | 同上 |
| createTicketStage | POST /ticket_stages | `{ name, color_key }` | 201 `{ data: TicketStageSetting }` | `ticket_stages` |
| updateTicketStage | PATCH /ticket_stages/:id | `{ name?, color_key? }` | 200 | 同上 |
| deleteTicketStage | DELETE /ticket_stages/:id | — | 200 `{ data: { id } }` | 同上 |
| reorderTicketStages | POST /ticket_stages/order | `{ stage_ids: uuid[] }` | 200 `{ data: TicketStageSetting[] }` | 同上 |
| listTicketFieldMaster（K-706） | GET /ticket-field-master | — | 200 `{ data: TicketFieldSetting[] }` | `custom_fields` |
| createTicketField（K-706） | POST /ticket-fields | `{ name, field_type, kind_ids, required?, description?, options? }` | 201 `{ data: TicketFieldSetting }` | 同上 |
| updateTicketField（K-717） | PATCH /ticket-fields/:id | `{ name?, field_type?, required?, description?, options?, kind_ids? }`（1 つ以上） | 200 | 同上 |
| deleteTicketField（K-717） | DELETE /ticket-fields/:id | — | 200 `{ data: { id } }` | 同上 |
| reorderTicketFields（K-717） | POST /ticket-fields/order | `{ field_ids: uuid[] }` | 200 `{ data: TicketFieldSetting[] }` | 同上 |

- 権限は「管理者だけ」（切り方 0.13）。実体は 3 つの資源（`ticket_kinds`・`ticket_stages`・`custom_fields`）の edit で、**管理者の束に既に入っている**（`app.refresh_role_bundle_defaults` が `target_kinds` の全部を管理者に渡す）。新しい権限は作らない。口の前で `has_permission` を確かめ、**DB の関数も同じ確かめを持つ**（2 層。口を通らない呼びも `{ error: forbidden }`）
- 書く口の上限：1 分あたり 30 回／人（読む口は 120）。体は 64KB まで（入口の共通）。name は NFKC にしない・前後の空白（全角・タブ・改行）を落とした後 1〜40 字（状態は 1〜20 字・今の check）・NUL は 422
- **断る番号**（控え帳 2026-11-20：422＝形の誤りだけ・404＝指した物が無い・見えない〔欄・details なし〕・409＝今の状態ではできない〔欄・details なし。差し込む値だけ `detail`〕）：

| 番号 | 状態 | 意味 | 口 |
|---|---|---|---|
| E-KND-001 | 409 | 同じ名前の種別がある | K-704 |
| E-KND-002 | 409 | 種別は 10 まで | K-704 |
| E-KND-003 | 409 | 使っているチケットが在る種別は消せない（`detail: { ticket_count }`・消したチケットも数える） | K-704 |
| E-KND-004 | 409 | 並びが今の種別と合わない | K-704 |
| E-KND-005 | 409 | 最後の 1 つの種別は消せない（チケットを作れなくなる） | K-704 |
| E-STG-001 | 409 | 同じ名前の状態がある（仕組みの状態の名前も含む） | K-705 |
| E-STG-002 | 409 | 作業の状態（仕組みの状態を除く）は 8 まで | K-705 |
| E-STG-003 | 409 | 始め・終わり・仕組みの状態は消せない | K-705 |
| E-STG-004 | 409 | 仕組みの状態は名前を変えられない（色は変えられる） | K-705 |
| E-STG-005 | 409 | 使っているチケットが在る状態は消せない（`detail: { ticket_count }`） | K-705 |
| E-STG-006 | 409 | 並びが今の状態と合わない | K-705 |
| E-STG-007 | 409 | 始めを先頭・終わりを最後に置かない並び | K-705 |
| E-FMS-001 | 409 | 同じ名前の項目がある（足す・直す） | K-706（登録）・K-717 が使う |
| E-FMS-002 | 409 | 値が入っている間は型を変えられない | K-717 |
| E-FMS-003 | 409 | 並びが今の項目と合わない | K-717 |
| E-FMS-004 | 409 | 同じ名前の選ぶ物が 1 つの項目に 2 つ（足す・直す） | K-706（登録）・K-717 が使う |
| E-FMS-005 | 409 | 選ぶ型でない項目に選ぶ物だけを送った | K-717 |

  無い・消した・別の会社の種別／状態／項目／選択肢／並びの外の id は **404 E-PAGE-001**（既存）。DB の失敗は **503 E-PAGE-003**（既存・段 10 は 503 にそろえる＝D-136.1 の「内部の不具合で判定できない＝503」の側）。ログインなし 401・権限なし 403・上限 429 は入口の共通。接頭辞 `E-KND-`・`E-STG-`・`E-FMS-` は本枝と `c/段5`・`c/段8`・`c/段9` の `errors.d` に 1 つも無い（`git grep -c "E-KND-[0-9]"` ほかを 4 つの枝で流して 0 件・2026-11-22）。段 5 の `E-FLD-`（項目の値）とは別の枠
- 文の字（画面にそのまま出る・「お知らせ」ではなく設定の言葉）：E-KND-001「同じ名前の種別がすでにあります」／002「種別は 10 までです」／003「この種別を使っているチケットがあるので、消せません」／004・STG-006・FMS-003「並びが古くなっています。開き直してください」／005「最後の 1 つの種別は消せません」／STG-001「同じ名前の状態がすでにあります」／002「状態は 8 つまで足せます」／003「この状態は仕組みが使うので、消せません」／004「この状態の名前は変えられません」／005「この状態のチケットがあるので、消せません」／007「始めの状態は先頭に、終わりの状態は最後に置きます」／FMS-001「同じ名前の項目がすでにあります」／002「値が入っている項目は、型を変えられません」／004「同じ名前の選ぶ物があります」（モックに無い字は「仮」。代表が違えば直す）

## 4. 答えの形（画面が使う・鍵は決め打ち）

```text
TicketKindSetting  = { id, name, color_key, position, is_builtin, body_template }          // 鍵 6。body_template は文書の木（段 5 K-561 の Doc）か null
listTicketKinds    = 段 5 の答え（id・name・color・position・is_builtin・body_template・fields）＋ color_key  // 種別の画面はこれを読む
TicketStageSetting = { id, key, name, color_key, position, lock }                           // 鍵 6。lock は 'start'（key＝todo）・'end'（key＝done）・'system'（仕組みの状態）・null
listTicketStages   = { data: TicketStageSetting[], meta: { limit } }（消した状態は出ない・並びの順）  // 状態の画面はこれを読む（?sort=position は付けても付けなくても同じ）
TicketFieldSetting = 段 5 の TicketField（id・name・field_type・required・description・options・position）＋ { kind_ids, all_kinds, value_count }   // 鍵 10
```

- 画面の行き来：**種別の画面＝`listTicketKinds` 1 本／状態の画面＝`listTicketStages` 1 本／項目の画面＝`listTicketFieldMaster` と `listTicketKinds`（どの種別で出すかのチェックの並び）の 2 本を同時に**。直列の段は 1
- 画面の言葉と型の対応（`FieldType`）：`short_text`＝「1 行」・`long_text`＝「複数行」・`number`＝「数」・`date`＝「日付」・`select`＝「1 つ選ぶ」・`multi_select`＝「複数選ぶ」・`check`＝「チェック」。**画面が鍵を字に直す**（口は鍵だけ）
- `lock` の字（画面）：start「始めの状態なので消せません」・end「終わりの状態なので消せません」・system「仕組みが使う状態なので消せません」（下絵 `StageRow.locked`）
- `all_kinds`：種別の行が 1 つも無い前からの項目（K-563 の移しで入った物）は true・`kind_ids` は今ある全部の種別。保存すると明示になり false。**あとで足した種別には、明示の項目は出ない**（画面は項目の画面で足す種別にチェックを付けてもらう。種別を足した直後に「出す項目を選ぶ」案内を出すかは画面の葉が決める）
- 状態の並び：足した状態は終わりの状態の直前に入り、並びは 10 刻みで振り直す。仕組みの状態は、始めと終わりの間のどこにも置ける（下絵は仕組みの状態を一覧に出さないので、画面は `lock: 'system'` の行を一覧から外し、並べ替えには全部の id を送る）

## 5. 消すときの動き（勧め・代表に確認中）

| 物 | 動き |
|---|---|
| 種別 | 使っているチケットが 1 枚でも在れば消せない（409 E-KND-003・枚数は `detail.ticket_count`・**消したチケットも数える**。ゴミ箱から戻した物が行き場を失わないため）。最後の 1 つも消せない。確かめの小窓の後に消す（元に戻す画面は作らない）。消した種別の項目の種別の行は残す（読みは生きている種別だけを数える） |
| 状態 | 始め・終わり・仕組みの状態は消せない。使っているチケットが在れば消せない（409 E-STG-005） |
| 項目 | **消すと値も見えなくなる**ことを小窓で確かめてから消す（口は確かめを持たない）。値の行は消さない（見えなくなるだけ）・名前は使い回せる |

## 6. 置き場（実装の足場）

- 口の登録（K-326）：`apps/api/src/hooks/ticket-kinds-write.ts`（K-704）・`ticket-stages-write.ts`（K-705）・`ticket-fields-write.ts`（K-706。`listTicketFieldMaster` と足す）・`ticket-fields-edit.ts`（K-717。直す・並べる・消す）。`register = defineHooks({ name, make, fuzz: "same" })`
- 口の本体：`apps/api/src/features/F9/settings/`（`kinds.ts`・`stages.ts`・`fields.ts`〔K-706〕・`fields-edit.ts`〔K-717〕。**葉ごとに 1 ファイル**で、答えの形 `to…Setting` と関数の断りの言葉 → 番号を同じファイルに持つ＝3 つの葉が同じファイルを作らない）。DB の関数が仕事を持ち、口は「入力の確かめ → 関数を呼ぶ → 答えの形にする」だけ
- DB：migration は `packages/db/migrations/20261125014400_ticket_kind_settings.sql`（K-704）・`20261125014500_ticket_stage_settings.sql`（K-705）・`20261125014600_ticket_field_master.sql`（K-706。読む・足すの関数と、選ぶ物の組み立て・種別の行の入れ替えの関数）・`20261125015700_ticket_field_edit.sql`（K-717。直す・並べる・消すの関数）。関数は security definer・`search_path = public, app`・答えは jsonb・**断りは例外にせず `{ "error": "<言葉>" }`**（何も書かない）。権限（`has_permission(app.user_id(), '<資源>', null, 'edit')`）→ 形・状態の確かめ → 書く → 証跡（`audit_events`・action は `ticket_kind.create` など・`target_type` は表の名前・`choke_point_id` は `C2`）の順。**書く・証跡は同じ取引**（証跡が落ちれば書きも戻る）
- 契約の断片：`05_flow/screen_api.d/K-70N.py`・`scripts/ci/contract_shape.d/K-70N.py`・`07_qa/test-specs/errors.d/K-70N.json`・`07_qa/test-plan/ears-elsewhere.d/K-70N.json`・`scripts/ci/ci_scope.d/K-70N.json`。**生成の試験は作る段の最初に契約を足して作り手で作り、先に 1 つのコミットにする**（`python3 scripts/ci/build_registries.py && python3 scripts/tickets/regen_all.py`）
- 試験：`apps/api/test/features/F9/`（`settings.harness.ts`＝3 つの葉の共通の土台・K-704 が持ち込み K-705・K-706・K-717 も carry）・`ticket-kinds-write.test.ts`・`ticket-stages-write.test.ts`・`ticket-fields-write.test.ts`（K-706）・`ticket-fields-edit.test.ts`（K-717）・`k144.d/K-704.ts`〜`K-706.ts`・`K-717.ts`（入口の uuid の行 K144-API-970〜975〔974・975 は K-717〕。976 は空き）
- hooks のファイル名は **段 10 の他の葉と重ならない**（K-675 の置き場は `apps/api/src/features/F9/` の別のフォルダ。`settings/` はこの 3 つの葉だけが使う）

## 7. 画面の葉・中間への申し送り

- K-720（項目を足す・消す画面）：K-709 が直す・保存する面に、「項目を足す」（小窓）と「この項目を消す…」（確かめの小窓）をつなぐ。口は `createTicketField`（K-706）と `deleteTicketField`（K-717）で、断りの番号（E-FMS-001・004 ほか）は上の表のとおり。K-709 の `FieldSlot` の `overlay` に小窓を差す
- K-707〜K-709（画面）：入れ物と hooks を足して口につなぐ。部品（`TicketSettings`・`KindsPanel`・`StagesPanel`・`FieldsPanel`・`ColorPick`）は書き換えない。保存は「保存する」で 1 本の書く口。並べ替えは落とした後に `reorder` を 1 回（つまみ）。**種別・状態の消すは、答えの 409 の番号で字を出し分ける**（E-KND-003 は枚数入りの帯・E-STG-003 は下絵の `locked` の字）。項目の画面は「この項目を消す…」で値が見えなくなる確かめの小窓を出してから `deleteTicketField` を呼ぶ
- 色の選び：8 つの swatch（下絵 `ColorPick`）の radio の値を `color_key` の字で送る。**下絵の `Tone` と口の鍵は同じ 8 つの字**
- K-715（中間）：種別のひな形を直す → `listTicketKinds` の `body_template` が変わる／状態の色を変える → `listTicketStages` の `color_key`／項目を足す → 段 5 の `listTicketFields`・`listTicketKinds.fields`・作る面の項目の表に出る。**3 つの葉の口を叩く道具は `settings.harness.ts`**
- K-711（片付け）：`getTicketShape`・`saveTicketShape`・`previewTicketShapeChange` を契約から外す。外す前に `git grep -n "getTicketShape\|saveTicketShape\|previewTicketShapeChange" -- apps packages` で使う所が 0 件であること
- `listTicketStages` の答えを表の行から `TicketStageSetting` に変える件：`11_tickets/K-59.md`（持ち主）の `apis:` はそのまま（口は前から在る）。試験の `apps/api/test/generated/get_ticket_stages.test.ts` は作り手が作り直す
