import { adminDatabaseUrl, requireEnv } from "@kaname/config";
import { migrateAuth } from "./migrate.js";
const app = adminDatabaseUrl() ?? requireEnv("DATABASE_URL");
migrateAuth(app).then(
  (t) => {
    console.log(`auth の表 ${t.length ? "作成 " + t.join(", ") : "済み"}`);
    process.exit(0);
  },
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
