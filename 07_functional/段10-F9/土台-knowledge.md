# 段 10 ナレッジの土台（K-674 置き場＝DB・K-675 口の置き場）（2026-11-22・切る段）

この文書は、段 10 の後ろの葉（K-676〜K-703・K-704〜K-706・K-711・K-712）が**同じ名前で使う**物を決め切る。
正本は `.ticket-flow/side-notes/段10-すり合わせ-2026-11-21.md`（代表の決め 1〜13）と `07_functional/段10-F9/切り方.md` の 0 章。食い違ったらそちらが勝つ。
前の形（物ごとの表・口・画面）の土台は正としない。

**この文書の名前を変えるときは、持ち主の葉（K-674・K-675）の md と、使う葉の md を同じ変更で直す。** 葉は自分の都合で名前を足さない（足すなら K-675 に頼む）。

## 0. 言葉と名前の決まり

| 決め | 内容 |
|---|---|
| 棚（shelf） | 3 つ：**会社** `company`／**グループ** `group`／**自分** `me`。画面の言葉は「会社」「グループ」「自分」（「部署」は使わない・字も識別子も `group`） |
| 棚の持ち方（DB） | 会社＝いちばん上のグループ（`scopes.parent_id` が空の 1 行）・`is_personal = false`／グループ＝その `scopes.id`・`is_personal = false`／自分＝持ち主の主の所属（`members.scope_id`）・`is_personal = true`・持ち主 `owner_member_id` |
| 書ける人 | 会社の棚＝管理者（`app.is_admin`）／グループの棚＝そのグループのマネージャー（`scope_memberships.role = 'manager'`）／自分の棚＝持ち主本人。**権限の束（`permissions`・`has_permission`）はナレッジでは使わない** |
| 読める人 | 会社＝社内の全員／グループ＝そのグループの人（`scope_memberships` か主の所属）と、共有先のグループの人（K-689）／自分＝本人だけ。**管理者でも、入っていないグループの棚は読めない**（承認する画面は DB の関数が中身を渡す＝K-688） |
| 下書きの見え方 | まだ 1 度も書き終えていないページ（`state = 'draft'`）は**持ち主だけ**。公開済みのページを直している下書きの版（`kind = 'draft'`）は**書いている人だけ** |
| 本文 | `{ doc, text }`。段 5 の形（`@kaname/contracts` の `Doc`・`validateDoc`・`toTicketBody`・`docToText`・K-561）。**画面から `text` は受けない**（口が `doc` から `toTicketBody` で作る） |
| 画面の鍵 | snake_case。`desc`（1 行の説明）は DB の列 `summary`・`must` は列 `is_must`（`desc` は SQL の予約語なので列は別名） |
| 日時 | 答えは ISO 8601（UTC・`Z`）の文字。画面が日本時間に直す |
| 決定の番号 | 代表の決め N は、決定ログ（K-673 が運ぶ新しい節）で **D-152.N**。この文書の中では「決め N」と書く（番号が付くまで `decisions:` には既にある番号だけを書く） |

## 1. DB

### 1.1 migration の名前（誤りの訂正）

まとめ役の指示の式（番号−600 を 4 桁の時刻にする）は、K-674〜K-699 で**分が 59 を超える**（例：K-674 → 00:74）。
`packages/db/src/index.ts` の `isTimeName` は分を 59 までしか通さない（K-561 の md に同じ指摘がある）ので、次の式にする。

> `20261125` ＋ `HH` ＋ `MM` ＋ `00`。**HH×60＋MM ＝ 番号 − 600**（つまり番号−600 を「分」と見て時・分に割る）

| 葉 | 名前 | 持つ物 |
|---|---|---|
| K-674 | `20261125011400_knowledge_shelves.sql` | 列・フォルダの表・見える／書けるの関数・行の守りの作り直し |
| K-677 | `20261125011700_knowledge_page_read.sql` | ページを読む・AI が開いた数を数える関数 |
| K-678 | `20261125011800_knowledge_folder_write.sql` | フォルダの中が空かを数える関数 `app.kn_folder_in_use` |
| K-685 | `20261125012500_knowledge_must_limits.sql` | 上限の設定の表 `knowledge_limits` と 3 行・付け外しの関数 |
| K-686 | `20261125012600_knowledge_similar.sql` | 似たページの索引（pg_trgm）と関数 |
| K-687 | `20261125012700_knowledge_requests.sql` | 頼みの表 `knowledge_requests`・頼む／取り下げる／消す関数 |
| K-688 | `20261125012800_knowledge_decide.sql` | 承認する・断る関数・一覧の関数 |
| K-689 | `20261125012900_knowledge_shares.sql` | 共有の表 `knowledge_shares`・見える関数の差し替え |
| K-695 | `20261125013500_knowledge_review.sql` | 見直すページの 3 つの一覧の関数・管理の数 |
| K-697 | `20261125013700_knowledge_context.sql` | AI に渡す物を作る関数（`app.knowledge_context`・`app.kn_ai_visible_pages`・`app.kn_company_scope_of`・`app.bridge_job_knowledge`・`app.knowledge_ticket_line`） |
| K-698 | `20261125013800_knowledge_open.sql` | AI がページを開く関数 `app.knowledge_open`・`reference_logs` の直し |
| K-699 | `20261125013900_knowledge_guard_specs.sql` | 必ず守るを確認項目に入れる関数・`app.ticket_delegate` の作り直し |
| K-726 | `20261125020600_test_spec_source_page.sql` | 確認項目の行の答え `app.test_spec_item` の作り直し（`source_page`） |
| K-700 | `20261125014000_knowledge_breaches.sql` | 破られた数の表 `knowledge_breaches`・数える関数・引き金 |
| K-701 | `20261125014100_knowledge_complete_guard.sql` | 完了を止める関数・`app.ticket_complete` の作り直し・引き金 |
| K-704 | `20261125014400_ticket_kind_settings.sql` | 種別の設定（土台-settings.md） |
| K-705 | `20261125014500_ticket_stage_settings.sql` | `ticket_stages` の色の列ほか（土台-settings.md） |
| K-706 | `20261125014600_ticket_field_master.sql` | 項目のマスタを読む・足す |
| K-712 | `20261125015200_memory_routes_retire.sql` | 記憶の DB の関数 12 を外す |
| K-717 | `20261125015700_ticket_field_edit.sql` | 項目を直す・並べる・消す |
| K-719 | `20261125015900_knowledge_share_views.sql` | 共有された物の木・共有の見える側の関数 |

そのほかの口の葉が DB の関数を足すときは、同じ式で名前を決める（例：K-679 → `20261125011900_…`）。行の守りを作り直す葉は `packages/db/policies/` に**同じ名前**を作る。
一覧 `packages/db/src/migrations.generated.ts` は作り手 `python3 scripts/ci/gen_migrations.py` の生成物（手で書かない）。

### 1.2 今ある表と、K-674 が足す物

| 表 | 扱い |
|---|---|
| `knowledge_pages`（0073） | **使って直す**。足す列：`summary text not null default ''`（1 行の説明・200 字まで）・`is_must boolean not null default false`（必ず守る・公開済みだけ）・`copied_from_page_id uuid`（写しの元）・`folder_id uuid`（フォルダ・空＝棚の直下）・`position int not null default 0`（並び）。使わない列（残す）：`parent_page_id`・`form`・`verify_interval_days`・`verified_at`・`verify_due_on`・`topics`・`archived_at`・`archived_to_page_id`・`state = 'archived'` |
| `knowledge_page_versions`（0073） | **使って直す**。本文 `body` は `{doc, text}`（形の守りは `app.ticket_body_valid`＝K-561）。使う `kind` は `draft`・`published` の 2 つ（`proposal` は使わない）。使わない列：`proposed_*`・`decision`・`decline_reason`・`decided_*`。**下書きの版は 1 ページに 1 つまで**（`unique (page_id, kind, version)` を外し、`kind = 'draft'` と `deleted_at is null` の部分一意に替える）。書き終える＝その行を `kind = 'published'` に更新する（版の数は `current_version + 1`） |
| `knowledge_folders`（K-674 が作る） | フォルダ。列：`id`・`tenant_id`・`scope_id`・`is_personal`・`owner_member_id`・`parent_folder_id`（空＝棚の直下）・`name`（1〜100 字）・`position int`・時刻・`created_by`・`updated_by`・`deleted_at`。同じ棚・同じ親の中で名前は重ならない（大文字小文字を分けない・消した物は数えない・自分の棚は持ち主ごと）。深さは 6 まで |
| `knowledge_requests`（K-687 が作る・**名前と列の案**） | 上げる／共有の頼み。`kind`（`raise`・`share`）・`page_id`・`folder_id`（共有でフォルダのとき）・`from_scope_id`・`from_is_personal`・`to_scope_id`（先の棚：グループか会社）・`to_folder_id`・`requested_by`・`message`・`state`（`pending`・`approved`・`declined`・`withdrawn`）・`decided_by`・`decided_at`・`decline_reason`・`dismissed_at`（断りの帯を消した）・時刻 |
| `knowledge_shares`（K-689 が作る・案） | 共有。`page_id` か `folder_id`・`group_id`（見せる先のグループ）・`request_id`・`shared_by`・`ended_at`（やめた）・時刻。元は 1 つ（コピーを作らない） |
| `knowledge_breaches`（K-700 が作る・案） | 破られた数。`page_id`・`ticket_id`・`test_spec_id`・`kind`（`ai_unchecked`・`human_unchecked`・`ai_self_reported`）・時刻。追記だけ（更新・削除を渡さない） |
| `knowledge_limits`（K-685 が作る・案） | 必ず守るの上限。`shelf` が主キー（`company`・`group`・`me`）・`must_max int`。**行は 3 つ：30・20・10**（グループは 1 グループごとの上限）。運営が後から変える（会社の管理者が変える画面は作らない）。読めるのは社内の全員・アプリからは書けない |
| `knowledge_links`（0073） | **使わない**（K-711 が凍結の印） |
| `reference_logs`（0072） | **使う**（K-698：AI が開いた記録。`ref_type = 'page'`・`ref_id` ＝ページ。追記だけ） |
| `notifications` | **使う**（K-687〜K-689 のお知らせ。形は段 8 の葉に合わせる） |
| `test_specs.source`・`source_ref_id`（段 5 の K-434） | **使う**（K-699：`source = 'knowledge'`・`source_ref_id` ＝ページ） |

### 1.3 本文の形と移し方

- 保存の形：`{ "doc": { "type": "doc", "content": [...] }, "text": "<docToText の結果>" }`。DB は `text` を作らない（口が作って渡す。K-561 と同じ理由）
- DB の最後の砦：`knowledge_page_versions_body_ok` ＝ `app.ticket_body_valid(body)`。前の形の行（`{}`・`{text}` だけ）は migration の中で `app.kn_body_from_text(body->>'text')` に置き換えてから守りを足す
- `app.kn_body_from_text(p text) returns jsonb`：文字を行ごとの段落にした `{doc, text}`（空の行は中身の無い段落・全部空なら節 0 個）。`text` は渡した文字のまま
- 必ず守るの本文の上限：**2,000 字**。DB の関数 `app.kn_must_text_max() returns int`（immutable・2000）が 1 か所の正本。口は TS の定数 `KNOWLEDGE_MUST_TEXT_MAX`（K-675）で先に見るが、`select app.kn_must_text_max()` と同じ数であることを K-675 の試験が見る。数える対象は `body->>'text'` の `char_length`

### 1.4 見える・書けるの関数（K-674 が作る・全部 `security definer`・`stable`・`kaname_app` に渡す）

| 関数 | 引数 → 答え | 中身 | 呼ぶ人 |
|---|---|---|---|
| `app.kn_company_scope()` | → uuid | 今の会社のいちばん上のグループ（`parent_id is null`・消していない最初の 1 つ） | 口・関数 |
| `app.kn_in_group(uid, g)` | → boolean | その人がそのグループに入っている（`scope_memberships` の行か `members.scope_id`） | 関数 |
| `app.kn_my_groups()` | → uuid[] | 今の人の入っているグループの全部（会社のいちばん上は含めない） | 木の口（K-676）・AI の渡し（K-697） |
| `app.kn_group_manager(uid, g)` | → boolean | そのグループの `scope_memberships.role = 'manager'` で、会社の所属が有効 | 関数 |
| `app.kn_shelf_kind(scope, personal)` | → text | `me`／`company`／`group` | 口・関数 |
| `app.kn_shelf_name(scope, personal)` | → text | `自分`／`会社`／グループの名前 | 口（place・お知らせの文） |
| `app.kn_shelf_readable(scope, personal, owner)` | → boolean | 棚が読める（上の「読める人」。共有は含めない） | 行の守り・関数 |
| `app.kn_shelf_writable(scope, personal, owner)` | → boolean | 棚に書ける（上の「書ける人」） | 行の守り・関数・口 |
| `app.kpage_visible(pid)` | → boolean | ページが読める：下書き（`state = 'draft'`）は持ち主／公開済みは `kn_shelf_readable` か `kn_shared_visible(pid)`。消した物は読めない | 版の守り・`knowledge_links` の守り・K-470 の探す・口 |
| `app.kpage_writable(pid)` | → boolean | ページに書ける：下書きは持ち主／公開済みは `kn_shelf_writable`。消した物は書けない | 版の守り・`scripts/ci/row_rules.mjs` の `RULES.write.knowledge_pages`（前からある・作り直さない） |
| `app.kfolder_visible(fid)`・`app.kfolder_writable(fid)` | → boolean | フォルダ版（読む：`kn_shelf_readable` か `kn_shared_folder_visible`／書く：`kn_shelf_writable`） | 口・`row_rules.mjs` |
| `app.kn_shared_visible(pid)` | → boolean | **K-674 では常に false の器**。K-689 が `create or replace` で「ページ自身か上のフォルダが、自分の入っているグループに共有されている」に差し替える | `kpage_visible`・行の守り |
| `app.kn_shared_folder_visible(fid)` | → boolean | 同上（フォルダ・上のフォルダも見る） | `kfolder_visible`・行の守り |
| `app.kn_folder_names(fid)` | → text[] | 棚の直下から数えたフォルダの名前の並び（`PagePlace.folders`） | 口 |
| `app.kn_body_from_text(p)`・`app.kn_must_text_max()` | 上のとおり | | 口・migration |

**共有を見える側に足す形**：K-689 は `kn_shared_visible`・`kn_shared_folder_visible` の 2 つだけを作り直す。`knowledge_pages` の行の守りは K-674 の時点でこの 2 つを呼んでいるので、K-689 は行の守りも `kpage_visible` も作り直さない（共有をやめた直後に見えなくなることは、関数が `knowledge_shares.ended_at is null` を見ることで効く）。

### 1.5 行の守り（`05_flow/rls_policies.py` の POLICIES・K-674 が作り直す）

| 表 | 守り（名前・操作） | 条件の要点 |
|---|---|---|
| `knowledge_pages` | `knowledge_pages_read`（select） | 同じ会社で、下書きは持ち主／公開済みは棚が読める（`kn_shelf_readable`）か共有（`kn_shared_visible`） |
| | `knowledge_pages_create`（insert） | 同じ会社・持ち主は自分・**`state = 'draft'` で作る**・`kn_shelf_writable` |
| | `knowledge_pages_update`（update） | 使う側：`kpage_writable(id)`／変えた後の行：同じ会社で、公開済みなら `kn_shelf_writable`・下書きなら持ち主 |
| | `knowledge_pages_ops_read_with_grant` | 前のまま |
| `knowledge_page_versions` | `_read`（select） | 公開の版はページが読めるとき／下書きの版は書いた人（`author_member_id`）だけ |
| | `_add`（insert） | `kind = 'draft'`・書いた人は自分・`kpage_writable(page_id)` |
| | `_decide`（update） | 使う側：書いた人の下書き・`kpage_writable`／変えた後：`kpage_writable`（下書き→公開の更新が通る） |
| `knowledge_folders` | `knowledge_folders_read`（select） | `kn_shelf_readable` か `kn_shared_folder_visible(id)` |
| | `knowledge_folders_write`（insert,update） | `kn_shelf_writable`（持ち主は自分でなくてよい＝グループの棚は誰が作っても同じ） |
| `knowledge_links` | 前のまま | `kpage_visible`・`kpage_writable` を呼ぶ（凍結・K-711） |

引き金（K-674 が `app.knowledge_same_tenant()` を作り直す）で守る物。**失敗の言葉は文の先頭の印**（口が 409 や 404 に直す）：

| 印（先頭の文字） | 条件 | errcode |
|---|---|---|
| `KNW_FOLDER_SHELF` | フォルダの親・ページのフォルダが、同じ棚（`scope_id`・`is_personal`・自分の棚は持ち主）でない | 22023 |
| `KNW_FOLDER_DEPTH` | フォルダの深さが 6 を超える | 22023 |
| `KNW_FOLDER_CYCLE` | 親が自分か自分の下 | 22023 |
| `KNW_PERSONAL_SCOPE` | 自分の棚のページ・フォルダの `scope_id` が持ち主の主の所属でない | 22023 |
| （同じ会社でない） | 親・フォルダ・写しの元・棚が別の会社 | 22023（言葉は前から） |

## 2. 口の一覧（契約）

行頭の操作 ID は契約の `operationId`。**契約を宣言する葉**＝`05_flow/screen_api.d/K-<番号>.py`（と、前からある操作 ID を直す物は `05_flow/screen_api.py` の本体）を書く葉。道は `/api/v1` から。

| operationId | 方法と道 | 持ち主 | 契約 | 入力（strict） | 成功 | 断り |
|---|---|---|---|---|---|---|
| `getKnowledgeTree`（前から・作り直し） | GET `/knowledge/tree` | K-676 | K-675 | 無し | 200 `KnowledgeTree` | — |
| `getKnowledgePage`（前から・作り直し） | GET `/knowledge_pages/:id` | K-677 | K-675 | 無し | 200 `KnowledgePageDetail` | 404 |
| `listKnowledgeVersions`（前から） | GET `/knowledge_pages/:id/versions` | K-677 | K-675 | 無し | 200 `KnowledgeVersionItem[]`＋`meta.count`（全部・200 行で切る） | 404 |
| `getKnowledgePageVersion`（新） | GET `/knowledge_pages/:id/versions/:v` | K-677 | K-675 | 無し（`v` は 1 以上の整数） | 200 `KnowledgeVersion` | 404 |
| `createKnowledgeFolder`（新） | POST `/knowledge/folders` | K-678 | K-675 | `{shelf, group_id?, parent_folder_id?, name}` | 201 `KnowledgeFolder` | 403・404・409（020・021）・422 |
| `updateKnowledgeFolder`（新） | PATCH `/knowledge/folders/:id` | K-678 | K-675 | `{name?, parent_folder_id?(null＝棚の直下), position?}`（1 つは要る） | 200 `KnowledgeFolder` | 403・404・409（020〜023）・422 |
| `deleteKnowledgeFolder`（新） | DELETE `/knowledge/folders/:id` | K-678 | K-675 | 無し | 200 `KnowledgeFolderDeleted` | 403・404・409（024・051） |
| `createKnowledgePage`（前から・作り直し） | POST `/knowledge_pages` | K-679 | K-675 | `{shelf, group_id?, folder_id?, title, desc?}` | 201 `KnowledgePageStub`（下書きのページを作る） | 403・404・422 |
| `saveKnowledgeDraft`（前から・作り直し） | PATCH `/knowledge_pages/:id/draft` | K-679 | K-675 | `{title?, desc?, doc?}`（1 つは要る） | 200 `KnowledgeDraftSaved` | 403・404・409（012）・422 |
| `discardKnowledgeDraft`（前から・作り直し） | DELETE `/knowledge_pages/:id/draft` | K-679 | K-675 | 無し | 200 `KnowledgeDraftDiscarded` | 403・404・409（030） |
| `publishKnowledgePage`（前から・作り直し） | POST `/knowledge_pages/:id/publish` | K-680 | K-675 | `{}`（空の形） | 200 `KnowledgePublished` | 403・404・409（040・041） |
| `updateKnowledgePage`（前から・作り直し） | PATCH `/knowledge_pages/:id` | K-681 | K-675 | `{folder_id?(null＝棚の直下), position?}`（1 つは要る） | 200 `KnowledgePageStub` | 403・404・409（011・052）・422 |
| `deleteKnowledgePage`（新） | DELETE `/knowledge_pages/:id` | K-681 | K-675 | 無し | 200 `KnowledgePageDeleted` | 403・404・409（011・050・051） |
| `setKnowledgeMust`（新） | PUT `/knowledge_pages/:id/must` | K-685 | K-675 | `{must}` | 200 `KnowledgeMustSet` | 403・404・409（010・011・060・061） |
| `findSimilarKnowledge`（新） | POST `/knowledge/similar` | K-686 | K-675 | `{title, desc?, text?, exclude_page_id?}` | 200 `KnowledgeSimilar`（上位 3 件） | 422 |
| `copyKnowledgePage`（新） | POST `/knowledge_pages/:id/copy` | K-690 | K-675 | `{folder_id?}`（自分の棚のフォルダ） | 201 `KnowledgePageStub` | 404・409（010・080） |
| `requestKnowledgeRaise`（新） | POST `/knowledge_pages/:id/raise` | K-687 | K-687 | `{group_id?, folder_id?, message?}`（自分→グループは `group_id` が要る） | 201 `KnowledgeRequest` | 403・404・409（010・011・100〜）・422 |
| `withdrawKnowledgeRequest`（新） | DELETE `/knowledge/requests/:id` | K-687 | K-687 | 無し | 200 `KnowledgeRequestEnded` | 403・404・409 |
| `dismissKnowledgeRequest`（新） | POST `/knowledge/requests/:id/dismiss` | K-687 | K-687 | `{}` | 200 `KnowledgeRequestEnded` | 403・404 |
| `listKnowledgeApprovals`（新） | GET `/knowledge/approvals` | K-688 | K-688 | 無し | 200 `KnowledgeApproval[]`＋`meta.count` | 403 |
| `approveKnowledgeRequest`（新） | POST `/knowledge/requests/:id/approve` | K-688 | K-688 | `{}` | 200 `KnowledgeRequestDecided` | 403・404・409 |
| `declineKnowledgeRequest`（新） | POST `/knowledge/requests/:id/decline` | K-688 | K-688 | `{reason}`（空白だけ・1,000 字超は 422） | 200 `KnowledgeRequestDecided` | 403・404・409・422 |
| `getKnowledgeShares`（新） | GET `/knowledge/shares?page_id=&folder_id=` | K-689 | K-689 | 問い合わせ（どちらか 1 つ） | 200 `KnowledgeShares` | 403・404・422 |
| `setKnowledgeShares`（新） | PUT `/knowledge/shares` | K-689 | K-689 | `{page_id?, folder_id?, group_ids, message?}`（どちらか 1 つ） | 200 `KnowledgeShares` | 403・404・409・422 |
| `getKnowledgeReview`（新） | GET `/knowledge/review` | K-695 | K-695 | 無し | 200 `KnowledgeReview` | 403 |

- **契約を K-675 が宣言する 16 本**は、表が K-674 までに在る物だけ。`:id` が K-687 以降の表を指す物（頼み）と、表が K-687 以降の物は、**その葉が自分の `.d` で宣言する**（`ID_TABLE`・行の言葉もその葉が足す）
- 前からある操作 ID の宣言は `05_flow/screen_api.py` の本体の行（SCREEN_API の行・RESPONSES・PERMS）を **K-675 が直す**（`.d` に同じ鍵があると止まるため）。INPUTS・ERRORS_4XX などは本体に無い鍵なので K-675 の `.d` に書く
- 呼べる回数の上限：`saveKnowledgeDraft` は 120/min/user（自動で保存する）・`findSimilarKnowledge` と `copyKnowledgePage` は 30/min/user・読む口は 120/min/user・ほかは 60/min/user
- `PERMS` の言葉：読む口の `:id` あり＝`read`／木・管理の読む口＝`self`／書く口＝`write`（`:id` ありの行の確かめ：ページ＝前からある `RULES.write.knowledge_pages`＝`app.kpage_writable(id)`。**フォルダは入口で行を読まない**：K-675 が `scripts/ci/row_rules.mjs` の `ROW_EXEMPT` に `/api/v1/knowledge/folders` を理由つきで足し、口が `kfolder_visible`〔見えなければ 404〕・`kfolder_writable`〔見えて書けなければ 403〕で決める。表を `packages/db/src/repository.ts` の `TABLES` に足さない＝足すと、それを読む 43 本の前からの試験を動かす）。言葉が通しても、棚ごとの書ける人の確かめは**行の守りと口**が持つ（言葉は「社内の人」までしか見ない）
- **契約から外す（K-711）**：`getKnowledgeHome`・`askKnowledge`・`sendKnowledgeAnswerFeedback`・`listKnowledgePages`・`uploadKnowledgeAttachment`・`restoreKnowledgeVersion`・`exportKnowledgeMarkdown`・`getKnowledgeUsage`・`getKnowledgeLinks`・`linkKnowledgeMention`・`searchKnowledgeLinkTargets`・`listKnowledgeMessages`・`postKnowledgeMessage`・`listKnowledgeVerifications`・`verifyKnowledgePage`・`archiveKnowledgePage`・`unarchiveKnowledgePage`・`listKnowledgeProposals`・`acceptKnowledgeProposal`・`declineKnowledgeProposal`・`createKnowledgeImport`・`getKnowledgeImport`・`commitKnowledgeImport`（23 本）。`search`（K-470）は残す

## 3. 入力・答えの形（画面が使う鍵・下絵 v2 の `apps/web/features/F9/knowledge/types.ts` に合わせる）

下絵の型との違いは鍵の snake_case と、`TreeGroup` に uuid の `id` が足されること（`code` は残る＝グループのチケットの番号の頭 `scopes.ticket_prefix`・決めていなければ null）。下絵の型の「部署 → グループ」（`dept`・`TreeDept` → `group`・`TreeGroup`）は K-670 の側で直っている（`types.ts` を見て確かめる）。

### 3.1 読む

`getKnowledgeTree` → `{ data: KnowledgeTree }`（`TreeData` に対応）

| 鍵 | 型 | 中身 |
|---|---|---|
| `company_name` | string | 会社の名前（`TreeData.company`） |
| `company_nodes` | TreeNode[] | 会社の棚の木 |
| `groups` | TreeGroup[] | 自分の入っているグループごと＋共有された物だけのグループ。`{ id: uuid, name, code: string｜null, tone: "teal"｜"plum"｜"amber", shared: boolean, nodes: TreeNode[] }`。`code` はグループのチケットの番号の頭（`scopes.ticket_prefix`・空の文字は null。K-682 が札の字に使う）。`tone` はグループの作った順の番号を 3 で割った余り（teal・plum・amber の順）。`shared: true` のグループは共有された物だけを `nodes` に持つ |
| `my_nodes` | TreeNode[] | 自分の棚の木 |
| `can_write` | `{ company: boolean, group_ids: uuid[], me: boolean }` | 書ける棚（＋を出す）。`me` は常に true |
| `admin_counts` | `{ approvals: integer, review: integer }` または null | 管理者・マネージャーだけ（それ以外は null）。`approvals`＝自分が承認できる待ちの数・`review`＝見直すページの数 |
| `truncated` | boolean | 5,000 ノードで切ったら true（切ったらログに `[knowledge] 木を 5000 で切った` を 1 行・名前は出さない） |

`TreeNode`：ページ `{ kind: "page", id, title, must: boolean, mark: "waiting"｜"declined"｜"copy"｜"draft"｜null }`／フォルダ `{ kind: "folder", id, name, children: TreeNode[] }`。並びは フォルダ → ページ、それぞれ `position`・名前（題名）・id の順。
`mark` は 1 つだけ：承認待ちの頼みがある（`waiting`）＞断られて帯を消していない（`declined`）＞下書きのまま（`draft`・持ち主だけに出る）＞写し（`copy`）。**`draft` は下絵に無い印**（書きかけのページを木に出す必要があるため。画面の葉が小さな「下書き」の字を足す＝K-670 に頼む）

`getKnowledgePage` → `{ data: KnowledgePageDetail }`

| 鍵 | 型 | 中身 |
|---|---|---|
| `id`・`title`・`desc`（1 行の説明）・`state`（`draft`｜`published`）・`must`（boolean） | | |
| `must_blocked` | `"too_long"` または null | 付けられない訳（本文が 2,000 字を超える）。画面が文にする |
| `place` | `{ shelf: ShelfKind, shelf_name, group_id: uuid｜null, folder_id: uuid｜null, folders: string[] }` | `PagePlace` に対応（`folders` は棚の直下から） |
| `acts` | `PageAct[]` | 帯に出す操作（`"must-on"｜"must-off"｜"raise"｜"share"｜"copy"｜"edit"`）。**口が今の人・今の状態から決めて返す**（承認待ちの間は `raise`・`share` を入れない） |
| `body` | `{ doc, text }` または null | 読む本文（公開済みの最新の版。まだ公開していないページは自分の下書き） |
| `draft` | `{ title, desc, doc, saved_at }` または null | 自分が直している下書き（あれば「書いている」画面を開く）。`title`・`desc` は版でなくページの今の題名・説明（保存のたびにすぐ効く＝K-679）で、欄の初めの値に使う |
| `request` | 下の `PageRequest` または null | 題名の下の帯（承認待ち・断られた） |
| `copied_from` | `{ page_id: uuid｜null, title, shelf_name, folders: string[], must: boolean, gone: boolean }` または null | 写しの帯（`folders`＝元の置き場のフォルダの名前を棚の直下から・直下なら空。元が消えたら `gone: true`・`page_id` null・`folders` 空）。作るのは K-677 |
| `shared_from` | `{ group_name, manager_names: string[], writable: false }` または null | 共有された側の帯（自分の入っているグループの物でない公開済みページ）。`manager_names`＝元のグループのマネージャーの表示名（名前順・いなければ空の並び）。作るのは K-719 の `shared-from.ts` |
| `raise_to` | `{ shelf: "group"｜"company", shelf_name, group_id: uuid｜null, approver_names: string[] }` または null | 上げる小窓の「上げる先・承認する人」。上げられない（承認待ち・会社の棚・下書き）は null |
| `foot` | `{ last_editor_name: string｜null, last_edited_at: string, version: integer, ai_opened_30d: integer }` | 足元（最後に直した人・版・AI がこの 30 日に開いた数＝`reference_logs`） |

`PageRequest`：`{ id, kind: "raise"｜"share", state: "waiting"｜"declined", to_name, who_name, at, reason: string｜null, can_withdraw: boolean }`（**`who_name`＝相手の名前**：承認待ちなら承認する人〔名前順の先頭の 1 人〕・断られたなら断った人。`at`＝その状態になった時刻〔承認待ち＝頼んだ時刻・断られた＝断った時刻〕。帯の字は `<who_name>さん（<役>）`＝K-692）。

`listKnowledgeVersions` の 1 行：`{ version: integer, published_at, by_name: string｜null }`（新しい順）。`getKnowledgePageVersion` → `{ version, published_at, by_name, body: { doc, text } }`。

### 3.2 書く

| 操作 | 入力の欄の型 | 答え（`data`） |
|---|---|---|
| `createKnowledgeFolder` | `shelf`（`company`｜`group`｜`me`）・`group_id`（uuid・`shelf = group` のとき要る＝契約の `INPUT_RULES` で 422・`company`・`me` のときは使わない〔あっても通す〕）・`parent_folder_id`（uuid・null）・`name`（空白だけでない・100 字まで） | `KnowledgeFolder`：`{ id, name, shelf, group_id, parent_folder_id, position }` |
| `updateKnowledgeFolder` | `name?`・`parent_folder_id?`（uuid・null）・`position?`（0 以上の整数） | `KnowledgeFolder` |
| `deleteKnowledgeFolder` | — | `{ id }` |
| `createKnowledgePage` | `shelf`・`group_id?`・`folder_id?`（uuid・null）・`title`（空白だけでない・200 字まで）・`desc?`（200 字まで） | `KnowledgePageStub`：`{ id, title, desc, state, must, place: PagePlace（上の `place` と同じ 5 鍵）}` |
| `saveKnowledgeDraft` | `title?`・`desc?`・`doc?`（object・`validateDoc` を通る物） | `{ saved_at, title, desc }` |
| `discardKnowledgeDraft` | — | `{ id, page_deleted: boolean }`（まだ 1 度も書き終えていないページは、やめるとページごと消えて `true`） |
| `publishKnowledgePage` | `{}` | `{ id, version, published_at }` |
| `updateKnowledgePage` | `folder_id?`（uuid・null）・`position?` | `KnowledgePageStub` |
| `deleteKnowledgePage` | — | `{ id }` |
| `setKnowledgeMust` | `must`（boolean） | `{ id, must, used: integer, limit: integer }`（この棚で付いている数と上限） |
| `findSimilarKnowledge` | `title`（空白だけでない・200 字まで）・`desc?`・`text?`（10,000 字まで）・`exclude_page_id?`（uuid） | `{ pages: PageBrief[] }`（上位 3 件・見える棚の中・公開済みだけ）。`PageBrief`＝`{ id, title, desc, place: string }`（`place` は「会社 › 経理」のように `›` でつなぐ） |
| `copyKnowledgePage` | `folder_id?`（自分の棚のフォルダ） | `KnowledgePageStub`（自分の棚・公開済みの写し・`copied_from_page_id` が元） |

- **必ず守るの上限に届いた**（`setKnowledgeMust` の 409・E-KNW-060）は、体が `{ error, code, detail }`。`detail`＝`{ shelf_name, limit, pages: [{ id, title, folder }] }`（`MustFullProps` に対応・`folder` は直下のフォルダの名前または空）。控え帳の「409 は field・details を付けない」は守り、差し込む値は `detail`（単数）で返す
- 草稿の同時の書き：1 つのページの下書きの版は 1 つ。同じ人が別の画面で書いても同じ版を直す（後の保存が勝つ）。別の人が先に書いていれば 409・E-KNW-012
- **K-687 以降の答え**（名前と鍵だけ・詳しくは各葉が決める）：`KnowledgeRequest`＝`{ id, kind, state, page_id, to_name, at }`／`KnowledgeApproval`＝`{ id, kind: "raise"｜"share", from_name, from_shelf_name, to_shelf_name, title, desc, message: string｜null, requested_at, similar: { page_id, title, place }｜null, body: { doc, text }｜null }`（11 鍵・`ApprovalItem` に対応。`body`＝承認する人が読めない棚のページの本文も DB の関数が渡す・フォルダの共有の頼みは null＝K-688 が正）／`KnowledgeShares`＝`{ target: { page_id｜null, folder_id｜null, title }, from_group_name, groups: [{ group_id, name, manager_name, checked: boolean, state: "shared"｜"waiting"｜"declined"｜null }] }`（`ShareProps` に対応）／`KnowledgeReview`＝`{ unused: [{ id, title, place, last_opened_at: string｜null }], conflicts: [{ id（`<上の id>:<下の id>`）, upper: { id, title, place }, lower: { id, title, place }, point }], broken: [{ id, title, place, count, how }] }`（`ReviewProps` に対応）

### 3.3 チケットの側（段 5 の画面に足す分）

- 確認項目の出どころ（K-703）：段 5 の `listTestSpecs` の答えは `source` を持つが `source_ref_id` を出さない。ナレッジから入った行の「ナレッジ：ページの名前」を出すため、**K-726 が `listTestSpecs` の 1 行に `source_page: { id, title } または null` を足す**（出どころが `knowledge` で、そのページが今も必ず守るで生きている行だけ非 null＝`app.knowledge_guard_specs` と同じ判定。段 5 の K-434 の 6 鍵の答えが 7 鍵になる＝段 5 への申し送り。行を作るのは K-699・印を出す画面は K-703）
- やり取りの行（K-702）：段 7 の変更の 1 行（K-574）の形で、`ticket_messages.kind = 'change'`・`changes = [{ field: "knowledge", from, to, note }]`。`field` は `guard_list`（このチケットで守る物）・`knowledge_open`（AI が開いたページ）・`knowledge_breach`（守れていなかった決まり）の 3 つ。`note` に「ページの名前」。`GuardPage`＝`{ id, title, place }`

## 4. エラー番号の枠（`E-KNW-NNN`）

今まで `E-KNW-` は台帳（`07_qa/test-specs/errors.json`・`errors.d/`）にも、c/段5・c/段8・c/段9 の葉にも使われていない（調べた）。**番号は 3 桁・十の位ごとに葉の枠**。台帳の断片は各葉の `errors.d/K-<番号>.json`。
**ただし K-675 が宣言する 16 本の口の分は、K-675 の `errors.d/K-675.json` が先にまとめて書く**（契約の断りが番号を指すため。持ち主の葉は同じ番号を書かない＝同じ id が 2 つあると止まる）。

| 番号 | 葉（持ち主） | 状態 | 中身（言葉は台帳が正本） | 使う口 |
|---|---|---|---|---|
| 001〜009 | K-674（DB の印） | — | 台帳には書かない（DB の失敗の印 `KNW_…`＝上の表）。口が下の番号に直す | — |
| 010 | K-675（共通） | 409 | ページがまだ書き終わっていない（下書き）ので使えない | `setKnowledgeMust`・`copyKnowledgePage`・`requestKnowledgeRaise`・`setKnowledgeShares` |
| 011 | K-675（共通） | 409 | 承認待ちの頼みがあるので変えられない（動かす・消す・必ず守る・上げる・共有） | `updateKnowledgePage`・`deleteKnowledgePage`・`setKnowledgeMust`・`requestKnowledgeRaise` ほか |
| 012 | K-675（共通） | 409 | ほかの人がこのページを書いている（下書きが別の人） | `saveKnowledgeDraft` |
| 020 | K-678 | 409 | 同じ場所に同じ名前のフォルダがある | `createKnowledgeFolder`・`updateKnowledgeFolder` |
| 021 | K-678 | 409 | フォルダの深さが 6 を超える | 同上 |
| 022 | K-678 | 409 | フォルダを自分の中へは動かせない | `updateKnowledgeFolder` |
| 023 | K-678 | 409 | 別の棚へは動かせない（フォルダ） | `updateKnowledgeFolder` |
| 024 | K-678 | 409 | 中にページ・フォルダがあるので消せない | `deleteKnowledgeFolder` |
| 030 | K-679 | 409 | 捨てる下書きが無い | `discardKnowledgeDraft` |
| 040 | K-680 | 409 | 書き終える下書きが無い | `publishKnowledgePage` |
| 041 | K-680 | 409 | 「必ず守る」のページは本文 2,000 字までなので書き終えられない | `publishKnowledgePage` |
| 050 | K-681 | 409 | 「必ず守る」が付いているので消せない | `deleteKnowledgePage` |
| 051 | K-681 | 409 | 共有しているので消せない | `deleteKnowledgePage`・`deleteKnowledgeFolder`（フォルダは K-719 が返す） |
| 052 | K-681 | 409 | 別の棚へは動かせない（ページ・上げるを使う） | `updateKnowledgePage` |
| 060 | K-685 | 409 | 「必ず守る」の上限に届いた（`detail` に今付いている一覧） | `setKnowledgeMust` |
| 061 | K-685 | 409 | 本文が 2,000 字を超えるので付けられない | `setKnowledgeMust` |
| 080 | K-690 | 409 | 自分の棚のページは写せない | `copyKnowledgePage` |
| 100〜109 | K-687 | — | 上げる・取り下げ・消すの断り（これ以上上の棚が無い・もう決まっている ほか） | K-687 の口 |
| 110〜119 | K-688 | — | 承認する・断るの断り（もう決まっている・承認する人でない ほか） | K-688 の口 |
| 120〜129 | K-689 | — | 共有の断り | K-689 の口 |
| 130〜139 | K-695 | — | 見直すページの断り（あれば） | K-695 |
| 200〜209 | K-697 | — | AI に渡す物（あれば） | K-697 |
| 210〜219 | K-698 | — | AI がページを開く道具の断り（見えない・無い は「見つからない」と同じ答え） | K-698 |
| 220〜229 | K-699 | — | 任せたときの確認項目 | K-699 |
| 230〜239 | K-700 | — | 破られた数 | K-700 |
| 240〜249 | K-701 | — | 完了を止める（まだ完了にできない・必ず守るの未チェックが残っている） | K-701 |
| 300〜309 | K-704 | — | 種別 | K-704 |
| 310〜319 | K-705 | — | 状態 | K-705 |
| 320〜329 | K-706 | — | 項目 | K-706 |

- 断る番号の決まり（控え帳）：404＝指した物が無い・見えない・消した（体は `{ error, code }` だけ・欄も details も付けない）／409＝今の状態ではできない（体は `{ error, code }`・差し込む値は `detail` 単数）／422＝契約に書ける形の誤りだけ（体は `details`）／403＝その棚に書けない（`{ error: "forbidden", code: "FORBIDDEN" }`）
- どの棚にも書けない人が「見えないページ」に書こうとしたら **404**（見える物だけ 403）。見えるが書けない（例：グループの人がグループのページを直す）は **403**

## 5. ファイルの置き場と名前

| 物 | 置き場・名前 |
|---|---|
| 口の本体 | `apps/api/src/features/F9/knowledge/<口の名前>.ts`（持ち主の葉が作る）。口が使う共通の物は下の K-675 の 5 ファイル |
| K-675 の共通ファイル | `apps/api/src/features/F9/knowledge/ops.ts`（`KNOWLEDGE_OPS`：操作 ID → `{ leaf, file }` の表）・`reply.ts`（断りの答え）・`shelf.ts`（棚を決める）・`body.ts`（本文を確かめて text を作る）・`shape.ts`（行 → 答えの形・木の印）。定数 `KNOWLEDGE_MUST_TEXT_MAX`（2000）は `shape.ts` |
| 口の登録（K-326） | `apps/api/src/hooks/f9-knowledge-<名前>.ts`（1 葉 1 ファイル・`register`・`fuzz: "same"`）。名前は `ops.ts` の `file` の列。**同じ操作 ID を 2 つのファイルに書かない**（K-675 の試験が見る） |
| 試験の土台 | `apps/api/test/features/F9/knowledge.harness.ts`（K-675 が運ぶ・`setupKnowledge()`・`addKnowledgeLeafHooks(f, file)`）。土台は `apps/api/src/hooks/f9-knowledge-*.ts` を全部読む |
| 口の試験 | `apps/api/test/features/F9/knowledge-<名前>.test.ts`（持ち主の葉）。行 ID は `K<番号>-API-NNN` |
| DB の試験 | `packages/db/test/knowledge_<名前>.test.ts`（K-674 は `knowledge_shelves.test.ts`） |
| 共有の試験 k144 の葉のファイル | `apps/api/test/features/contract/k144.d/K-<番号>.ts`。**行 ID は `K144-API-100〜149`**（本線・c/段5・段8・段9 に在る番号の外）。K-675＝100〜111（16 本のうち `:id` を持つ 12 本）・K-687＝120〜129・K-688＝130〜139・K-689＝140〜149 |
| 契約の断片 | `05_flow/screen_api.d/K-<番号>.py`・`scripts/ci/contract_shape.d/K-<番号>.py`・`07_qa/test-specs/errors.d/K-<番号>.json`・`07_qa/test-plan/ears-elsewhere.d/K-<番号>.json`・`scripts/ci/ci_scope.d/K-<番号>.json` |
| 画面の入れ物 | `apps/web/features/F9/knowledge/`（部品＝K-670〜K-672・入れ物と hooks は画面の葉） |

- 口の登録の材料 `HookDeps` は `{ appPool, repo, config }` だけを使う（ナレッジは秘密の関門を使わない）。AI の道具（K-698）は `callKanameTool` の側に足す

## 6. AI が読んで守る側の名前（K-697〜K-701）

この文書の名前は、K-697〜K-701 の md が決めた名前（整合で合わせた）が正。変えるときは持ち主の葉の md を直してから、ここを合わせる。

| 葉 | DB の関数（`app.`）・TS の関数 | 中身の要点 |
|---|---|---|
| K-697 | `app.knowledge_context(p_member uuid, p_ticket uuid) returns jsonb`・`app.kn_ai_visible_pages(p_member, p_ticket) returns setof uuid`・`app.kn_company_scope_of(会社)`・`app.bridge_job_knowledge(p_session uuid, p_job uuid) returns jsonb`（PC が仕事を取る瞬間に呼ぶ）・`app.knowledge_ticket_line(p_ticket, p_field, p_changes, p_body) returns uuid`（やり取りの 1 行を足す）・TS `loadKnowledge`／`renderKnowledgeSection`（`features/F9/knowledge/ai/context.ts`） | 答え `{ must: [{id, title, place, shelf_name, body_text}], index: [{id, title, desc, place}] }`。必ず守るは全部（本文ごと）・ほかは目次・並びは 会社 > グループ > 自分・上に同じ物があれば下は渡さない。**ナレッジは「任せたとき」の prompt に入れず、PC が仕事を取る瞬間に足す**（チケットの仕事は prompt の後ろ・会話は conventions の後ろ）。範囲：チケットあり＝会社＋そのチケットのグループ（共有を含む）＋任せた人の自分／チケットなし＝会社＋入っている全部のグループ＋自分 |
| K-698 | `app.knowledge_open(p_job uuid, p_token_hash text, p_session uuid, p_page uuid) returns jsonb`・道具の名前 `knowledge_open`（`callKanameTool`）・TS `features/F9/knowledge/ai/open.ts`（`parseOpenInput`・`runKnowledgeOpen`・`openAnswer`） | 見える物だけ開ける（見えない・無いは同じ答え）。`reference_logs` に 1 行（`ticket_id` の not null を外し `member_id`・`bridge_job_id` を足す）・チケットの仕事ならやり取りに 1 行（`field: knowledge_open`）。同じページを同じ仕事で 2 度開いても記録は 1 行。Bridge 側の道具の定義は K-718 |
| K-699 | `app.knowledge_seed_specs(p_ticket uuid, p_member uuid) returns jsonb`（`app.ticket_delegate` の中から。K-565 の後に作り直す） | 必ず守るのページごとに確認項目を 1 行（`source = 'knowledge'`・`source_ref_id` ＝ページ・文は「『題名』を守った」）。やり取りに `field: guard_list` の 1 行 |
| K-700 | `app.knowledge_record_breach(p_ticket uuid, p_spec uuid, p_kind text, p_note text default null) returns uuid`（4 引数）・`app.knowledge_breach_scan(p_ticket uuid) returns integer`・`app.knowledge_guard_specs(p_ticket uuid) returns setof uuid`（今も必ず守るで効く行だけ・K-701 と K-703 の `source_page` も同じ判定）・引き金 `bridge_jobs_knowledge_breach` | `knowledge_breaches` に追記。3 つの出来事（`ai_unchecked`・`human_unchecked`・`ai_self_reported`）だけ。やり取りに `field: knowledge_breach` の 1 行。**段 6 が「AI がチェックを付ける」を作るとき、この関数を呼ぶ入口が要る**（段 6 への申し送り） |
| K-701 | `app.knowledge_open_guard_count(p_ticket uuid) returns int`・`app.knowledge_guard_left(p_ticket uuid) returns jsonb`・引き金 `tickets_knowledge_complete_guard`（`app.knowledge_complete_guard()`）・`app.ticket_complete` に 1 か所足す。`listTestSpecs` の 1 行に `source_page: { id, title } ｜ null`（今も必ず守るで生きている行だけ非 null）を足す | 必ず守るから入った（`source = 'knowledge'`）確認項目でチェックの無い数。0 でなければ完了にできない（409・E-KNW-240・`detail.left`・段 5 の K-566 の「止めない」への例外）。K-703 の小窓と出どころの印が読む |

## 7. 当たる前からの試験と登録先（共通）

- K-674 が変える守りは、前からの `packages/db/test/knowledge_clients.test.ts` の「ナレッジ」の 4 つの試験を古くする。**K-674 が carry で運び、ナレッジの describe を新しい試験（`knowledge_shelves.test.ts`）へ移して外す**（取引先の describe はそのまま）
- 場合表（`07_qa/test-plan/access-matrix.json`・`packages/db/test/matrix.test.ts`）は、守りの名前と条件が変わり、`knowledge_folders` の行が増える。種（`seed_generic.ts`）が既定の値で入れる行が新しい期待に合うかは作る段で確かめ、合わなければ `seed_generic.ts` を `changes-add` で直す（K-674 の「リスク」）
- 口の葉は前の `apps/api/test/generated/*knowledge*` のうち、自分の口の生成の試験を `ears-elsewhere.d` の `covers` で本物の試験に結ぶ（K-351 の形）。外す口の生成の試験は K-711 が消す

## 8. まとめ役に頼むこと・申し送り

1. 決定ログの新しい節の番号を **D-152.N（N＝代表の決め N）** にしてよいか（K-673 が運ぶ）。確定したら、葉の `decisions:` に D-152.N を足す
2. migration の名前の式を上の 1.1 に訂正（指示の式は分が 59 を超える）
3. 段 5 への申し送り：K-726（K-701 から分けた）が `listTestSpecs` の答えに `source_page` を足す（K-434 の 6 鍵が 7 鍵）。K-566（完了は止めない）の文に、段 10 の K-701 の例外を書いてもらう
4. K-670 への頼み：`TreeNode` の `mark` に `draft` を足す（`PageMark`）・`TreeGroup.code` を uuid の `id` に・`PageView` が `acts`・`request`・`copied_from`・`shared_from`・`raise_to`・`foot` を読める形
5. K-687・K-688・K-689・K-695 の葉を切る人へ：自分の `.d` に契約を宣言する。頼みの `:id` の口（`/knowledge/requests/:id`）は、K-675 のフォルダと同じく `ROW_EXEMPT` にするか、表を `TABLES` に足して `RULES`・`ID_TABLE` を書くかを K-687 が決める（`TABLES` に足すと 43 本の前からの試験が動くので、勧めは `ROW_EXEMPT`）。migration の名前は 1.1。エラー番号は 4 章の枠
