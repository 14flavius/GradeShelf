#!/bin/sh
set -eu
umask 077

cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

test -f .env || fail 'Missing .env. Run setup first.'
docker compose config --quiet
# Let Compose resolve .env, overrides and directory defaults; never source .env as shell code.
compose_environment=$(docker compose config --environment)
instance_name=$(printf '%s\n' "$compose_environment" | sed -n 's/^COMPOSE_PROJECT_NAME=//p')
unset compose_environment
case "$instance_name" in
  ''|[-_]*|*[!a-z0-9_-]*) fail 'Could not resolve a valid Compose project name. Check COMPOSE_PROJECT_NAME in .env.' ;;
esac
containers=$(docker ps --all --quiet --filter "label=com.docker.compose.project=$instance_name")
if [ -n "$containers" ]; then
  fail 'An installation already exists. Keep its data and configuration; this helper is only for new installations.'
fi
if docker volume inspect "${instance_name}_gradeshelf-data" >/dev/null 2>&1; then
  fail 'An existing GradeShelf volume was found. Preserve its data and original configuration; no data was changed.'
fi
if [ -L data ] || { [ -e data ] && [ ! -d data ]; }; then
  fail './data must be a directory, not a file or symbolic link.'
fi
if [ -d data ]; then
  contents=$(ls -A data) || fail 'Cannot inspect ./data. No permissions were changed.'
  test -z "$contents" || fail './data already contains files. Preserve them and use the existing installation.'
else
  mkdir data
fi

# Only the empty mount directory changes owner. The application still runs as node,
# with all capabilities dropped; no database, uploads or other host paths are changed.
if ! docker compose run --rm --no-deps --pull missing --user 0:0 --cap-add CHOWN \
  --entrypoint node gradeshelf -e 'require("node:fs").chownSync("/data", 1000, 1000)'; then
  fail 'Could not prepare ./data. The directory was retained; check Docker access and retry this script while it is empty.'
fi
printf '%s\n' 'Prepared ./data for GradeShelf (container UID/GID 1000).'
