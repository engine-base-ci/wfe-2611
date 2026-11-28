# K-959 請求先を変える口（updateBillingContact）
#   契約の形（入力 company・attn・email・答え { company, attn, email }・空白だけの pattern）は K-1005 の断片が持つ。この葉が足す鍵は無い
#   振る舞いの本体は apps/api/src/features/F12/billing/contact.ts（DB の関数 app.billing_contact_set）
