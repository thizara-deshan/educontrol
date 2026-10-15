# shellcheck shell=bash
# install.sh step 30: install and build as the checkout's owner (services never write to the repo).

build_home=$(getent passwd "$BUILD_USER" | cut -d: -f6)
as_builder() {
  runuser -u "$BUILD_USER" -- env -i HOME="$build_home" PATH=/usr/local/bin:/usr/bin:/bin LANG=C.UTF-8 CI=true "$@"
}

log "building as $BUILD_USER (pnpm install, pnpm build, uv sync)"
(cd "$REPO" && as_builder pnpm install --frozen-lockfile)
(cd "$REPO" && as_builder pnpm build)
(cd "$REPO/services/hw" && as_builder uv sync --frozen)

# The services run as $SERVICE_USER: it must be able to read the build and run the venv.
for path in "$REPO/apps/core-api/dist/main.js" "$REPO/apps/kiosk/dist/index.html"; do
  runuser -u "$SERVICE_USER" -- test -r "$path" ||
    die "$SERVICE_USER cannot read $path; clone the repo where $SERVICE_USER can read it (deploy/pi/README.md)"
done
runuser -u "$SERVICE_USER" -- "$REPO/services/hw/.venv/bin/python" -c 'import uvicorn' ||
  die "$SERVICE_USER cannot run $REPO/services/hw/.venv; clone the repo where $SERVICE_USER can read it"

# One stamp over lockfiles and build output: a new stamp counts as a change (and restarts the services).
build_stamp=$(
  {
    sha256sum "$REPO/pnpm-lock.yaml" "$REPO/services/hw/uv.lock"
    tree_hash "$REPO/apps/kiosk/dist"
    tree_hash "$REPO/apps/core-api/dist"
  } | sha256sum | cut -d' ' -f1
)
if [[ $(cat "$STATE_DIR/build.stamp" 2>/dev/null || true) != "$build_stamp" ]]; then
  printf '%s\n' "$build_stamp" >"$STATE_DIR/build.stamp"
  changed "new build ${build_stamp:0:12}"
fi
