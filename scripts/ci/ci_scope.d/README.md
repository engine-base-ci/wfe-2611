# ci_scope.d（K-325）
表に足す分はチケットごとに K-<番号>.json（data_links・reads_ok・no_test_paths）に書く。前からの中身とほかの鍵は _base.json。
足し合わせは python3 scripts/ci/build_registries.py。同じ鍵や同じ道を 2 つのファイルが持てば止まる。
