# K-1017 決めた値段の版を請求とプランの選びに効かせる（D-128.72・D-156.31・D-156.36・D-156.43）
#   口は足さない（listWorkspacePlans・changePlan の持ち主は K-961・issueOpsInvoices は K-981・changeOpsWorkspacePlan は K-968）。ここは住所だけ：
#   listWorkspacePlans の行の upcoming（{ price_monthly, member_limit, from_month, noticed_on } か null）は K-1005 の断片に在り、
#   この葉が DB の関数 app.workspace_plans（20261128032400_plan_terms.sql）でいまのプランの行に埋める（ほかの行は null）。
#   会社とその日の値段・人数の上限は app.plan_terms の 1 か所で決める
