#!/usr/bin/env bash
# 一键部署：本地构建前端 + 打包后端 → 上传到服务器 → 原子切换 → 重启服务 → 健康检查，失败自动回滚。
#
# 用法：
#   ./deploy.sh                 完整流程（安装依赖、构建、上传、重启）
#   ./deploy.sh --skip-build    跳过构建，直接上传 .deploy/app 里上一次的产物
#   ./deploy.sh --rollback      不构建不上传，服务器切回上一个版本
#   ./deploy.sh --dry-run       只构建、不上传
#
# 可用环境变量覆盖：
#   DEPLOY_HOST=root@159.75.6.38  DEPLOY_DIR=/opt/sanguosha  DEPLOY_SERVICE=sanguosha
set -euo pipefail

HOST="${DEPLOY_HOST:-root@159.75.6.38}"
REMOTE_DIR="${DEPLOY_DIR:-/opt/sanguosha}"
SERVICE="${DEPLOY_SERVICE:-sanguosha}"
HEALTH_URL="${DEPLOY_HEALTH_URL:-http://127.0.0.1/api/health}"
NODE_TARGET="${DEPLOY_NODE_TARGET:-node22}"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STAGE="$ROOT/.deploy"
APP="$STAGE/app"

SKIP_BUILD=0; ROLLBACK=0; DRY_RUN=0
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=1 ;;
    --rollback)   ROLLBACK=1 ;;
    --dry-run)    DRY_RUN=1 ;;
    -h|--help)    sed -n '2,13p' "$0"; exit 0 ;;
    *) echo "未知参数: $arg" >&2; exit 2 ;;
  esac
done

log()  { printf '\033[1;36m==> %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31m错误: %s\033[0m\n' "$*" >&2; exit 1; }

# 远端脚本：切换版本 + 重启 + 健康检查，失败回滚。通过 ssh 整段执行。
remote_switch() {
  # $1 = 新版本目录名（相对 REMOTE_DIR），或 "app.prev" 表示回滚
  ssh "$HOST" "bash -s" <<REMOTE
set -euo pipefail
cd "$REMOTE_DIR"
NEW="$1"
if [ "\$NEW" = "app.prev" ]; then
  [ -d app.prev ] || { echo "没有可回滚的版本 (app.prev 不存在)"; exit 1; }
  rm -rf app.failed; mv app app.failed; mv app.prev app
  echo "已切回上一版本，当前失败版本保留在 app.failed"
else
  [ -d "\$NEW" ] || { echo "上传目录 \$NEW 不存在"; exit 1; }
  rm -rf app.prev
  [ -d app ] && mv app app.prev
  mv "\$NEW" app
fi
chown -R root:root app
chmod -R u+rwX,go+rX,go-w app
systemctl restart "$SERVICE"
for i in \$(seq 1 15); do
  sleep 1
  if out=\$(curl -fsS --max-time 2 "$HEALTH_URL" 2>/dev/null); then
    echo "健康检查通过: \$out"
    cat app/BUILD_INFO 2>/dev/null || true
    exit 0
  fi
done
echo "健康检查失败，最近日志："
journalctl -u "$SERVICE" -n 30 --no-pager || true
if [ "\$NEW" != "app.prev" ] && [ -d app.prev ]; then
  echo "自动回滚到上一版本..."
  rm -rf app.failed; mv app app.failed; mv app.prev app
  systemctl restart "$SERVICE"
  sleep 2
  curl -fsS --max-time 2 "$HEALTH_URL" && echo " (回滚后服务正常)" || echo "回滚后服务仍异常，请手动检查"
fi
exit 1
REMOTE
}

if [ "$ROLLBACK" = 1 ]; then
  log "回滚服务器到上一版本"
  remote_switch app.prev
  exit 0
fi

cd "$ROOT"

if [ "$SKIP_BUILD" = 0 ]; then
  command -v node >/dev/null || die "本机没有 node"
  if [ ! -d node_modules ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
    log "安装依赖 (npm ci)"
    npm ci --no-audit --no-fund || npm install --no-audit --no-fund
  fi
  [ -x node_modules/.bin/esbuild ] || die "缺少 esbuild，请先执行 npm install"

  log "类型检查 + 构建前端 (tsc + vite build)"
  npm run build

  log "打包后端为单文件 server.cjs (esbuild)"
  rm -rf "$APP"; mkdir -p "$APP"
  node_modules/.bin/esbuild server/index.ts \
    --bundle --platform=node --format=cjs --target="$NODE_TARGET" \
    --outfile="$APP/server.cjs" --log-level=warning

  cp -R dist "$APP/dist"
  node --check "$APP/server.cjs"

  {
    echo "commit=$(git rev-parse --short HEAD 2>/dev/null || echo unknown)"
    echo "branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo unknown)"
    echo "dirty=$([ -n "$(git status --porcelain 2>/dev/null)" ] && echo yes || echo no)"
    echo "built_at=$(date '+%Y-%m-%d %H:%M:%S %z')"
    echo "built_by=$(whoami)@$(hostname)"
  } > "$APP/BUILD_INFO"
  log "构建产物："; (cd "$STAGE" && du -sh app/server.cjs app/dist && cat app/BUILD_INFO)
else
  [ -f "$APP/server.cjs" ] && [ -f "$APP/dist/index.html" ] || die ".deploy/app 没有可用产物，去掉 --skip-build 重新构建"
  log "跳过构建，使用 .deploy/app 现有产物"
fi

if [ "$DRY_RUN" = 1 ]; then
  log "dry-run 结束，未上传。产物在 $APP"
  exit 0
fi

REL="app.$(date +%Y%m%d-%H%M%S)"
log "上传到 $HOST:$REMOTE_DIR/$REL"
tar -C "$STAGE" -czf - app | ssh "$HOST" "mkdir -p '$REMOTE_DIR' && cd '$REMOTE_DIR' && rm -rf '$REL' && mkdir '$REL' && tar -xzf - --strip-components=1 -C '$REL'"

log "切换版本并重启 $SERVICE"
remote_switch "$REL"

log "部署完成: http://${HOST#*@}/"
