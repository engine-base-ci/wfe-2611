# apps/api（Hono）。Railway の service api がこれを使う（T-F-18）。実行は tsx（packages は src を export している。dist への build は段階 1 凍結時に）
# 鍵は image に入れない。全部 環境変数（Infisical → Railway）。migration とバケットは pre-deploy command（pnpm db:migrate && pnpm provision:bucket）
FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@10.28.2 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.base.json tsconfig.json ./
COPY apps ./apps
COPY packages ./packages
COPY infra/provision ./infra/provision
COPY scripts/ci ./scripts/ci
RUN pnpm install --frozen-lockfile
ENV NODE_ENV=production
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:${PORT:-3001}/health || exit 1
CMD ["pnpm", "api:start"]
