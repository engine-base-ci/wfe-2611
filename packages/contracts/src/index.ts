// 契約（OpenAPI）と生成型。信頼源は 08_api/openapi.yaml。types.ts と registry.ts は scripts/ci/contract.mjs gen が生成する（手で直さない）。
export * from "./types.js";
export { ENDPOINTS, type EndpointDef } from "./registry.js";
