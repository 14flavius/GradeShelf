#!/bin/sh
set -eu
umask 077

# Download this script as install.sh into the directory that will hold the instance.
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

fail() {
  printf '%s\n' "$1" >&2
  exit 1
}

for existing in .env docker-compose.yml docker-compose.yaml compose.yml compose.yaml .git data scripts/backup.sh scripts/prepare-data.sh; do
  if [ -e "$existing" ] || [ -L "$existing" ]; then
    printf '%s\n' "Existing $existing found. Nothing changed." >&2
    if [ -f .env ] && [ -f docker-compose.yml ]; then
      printf '%s\n' \
        'Restart this instance: docker compose restart gradeshelf' \
        'Start a stopped instance: docker compose start gradeshelf' \
        'To change settings, edit .env in this installation directory: nano .env' \
        'Keep BETTER_AUTH_SECRET and COMPOSE_PROJECT_NAME unchanged.' \
        'Apply your changes with: docker compose up -d --pull never --wait' \
        'For image updates, follow the backup/update instructions in the README.' >&2
    else
      printf '%s\n' \
        'Keep or restore the original .env and Compose configuration; see the README.' >&2
    fi
    exit 1
  fi
done
if [ -L scripts ]; then
  fail 'The scripts directory must not be a symbolic link.'
fi
if [ -f ../package.json ] && [ -f ../docker-compose.yml ]; then
  fail 'This is a source checkout. Use sh scripts/setup.sh from its root instead.'
fi

for tool in curl openssl docker; do
  command -v "$tool" >/dev/null 2>&1 || fail "Install $tool before running this installer."
done
docker compose version >/dev/null 2>&1 || fail 'Docker Compose v2 is required.'
docker info >/dev/null 2>&1 || fail 'Docker is not running or is not accessible.'

if [ -n "${COMPOSE_PROJECT_NAME:-}${COMPOSE_FILE:-}${COMPOSE_ENV_FILES:-}${BETTER_AUTH_SECRET:-}${BETTER_AUTH_URL:-}${PORT:-}${BIND_ADDRESS:-}${GRADESHELF_IMAGE:-}${UPLOAD_MAX_FILE_MB:-}${UPLOAD_MAX_FILES_PER_ENTRY:-}${UPLOAD_MAX_USER_GB:-}" ]; then
  fail 'Unset exported GradeShelf/Compose configuration variables before installing; settings will be saved in .env.'
fi

valid_port() {
  printf '%s\n' "$1" | LC_ALL=C grep -Eq '^[1-9][0-9]{0,4}$' &&
    [ "$1" -le 65535 ]
}

valid_instance_name() {
  case "$1" in
    ''|[-_]*|*[!a-z0-9_-]*) return 1 ;;
  esac
  [ "${#1}" -le 63 ]
}

default_instance=$(basename "$PWD")
if ! valid_instance_name "$default_instance"; then
  default_instance=gradeshelf
fi
printf '%s\n' \
  'GradeShelf — new Docker installation' \
  '' \
  'Each instance needs its own directory, instance name and host port.' \
  'The instance name identifies its Docker Compose containers; keep it unchanged later.'
printf 'Instance name [%s]: ' "$default_instance"
IFS= read -r instance_name || fail 'Input closed. No configuration was created.'
instance_name=${instance_name:-$default_instance}
valid_instance_name "$instance_name" ||
  fail 'Use 1–63 lowercase letters, digits, dashes or underscores; start with a letter or digit.'

containers=$(docker ps --all --quiet --filter "label=com.docker.compose.project=$instance_name")
if [ -n "$containers" ]; then
  fail "Instance '$instance_name' already has containers. Use its original directory to start/restart it, or choose a different name."
fi
# Only this instance's previous storage matters. Another instance must not block setup.
if docker volume inspect "${instance_name}_gradeshelf-data" >/dev/null 2>&1; then
  fail "Existing data found for '$instance_name'. Keep its original configuration or choose another instance name. Nothing was deleted."
fi

printf '%s\n' \
  '' \
  'Browser URL: the full address you will use to open GradeShelf.' \
  '  Public HTTPS / reverse proxy: https://grades.example.com' \
  '  Direct LAN access:            http://192.168.1.20:3000' \
  '  Local access only:            http://localhost:3000' \
  'Behind an HTTPS proxy, enter the public https:// domain even though the container uses HTTP.' \
  'Use localhost only if you will open GradeShelf through localhost in your browser.' \
  ''
printf '%s' 'Browser URL [http://localhost:3000]: '
IFS= read -r instance_url || fail 'Input closed. Run sh install.sh in an interactive terminal.'
instance_url=${instance_url:-http://localhost:3000}
instance_url=${instance_url%/}
if ! printf '%s\n' "$instance_url" | LC_ALL=C grep -Eq '^https?://([A-Za-z0-9]([A-Za-z0-9.-]*[A-Za-z0-9])?|\[[0-9A-Fa-f:]+\])(:[0-9]{1,5})?$'; then
  fail 'Use an http:// or https:// address without credentials, a subpath, query or fragment.'
fi
authority=${instance_url#*://}
url_port=
case "$authority" in
  \[*\]) ;; # IPv6 without an explicit port.
  *:*) url_port=${authority##*:} ;;
esac
if [ -n "$url_port" ] && ! valid_port "$url_port"; then
  fail 'The URL port must be between 1 and 65535.'
fi
default_port=3000
case "$instance_url" in
  http://*) default_port=${url_port:-80} ;;
esac
printf '\n%s\n' \
  'Host port: the HTTP port published on your Docker host (usually 3000).' \
  'Your reverse proxy forwards to this port; the public HTTPS URL stays unchanged.' \
  'For another instance, choose a different host port (for example 3001).'
printf 'Host port [%s]: ' "$default_port"
IFS= read -r host_port || fail 'Input closed. No configuration was created.'
host_port=${host_port:-$default_port}
valid_port "$host_port" || fail 'The host port must be between 1 and 65535.'

printf '%s\n' \
  '' \
  'Listen address: who can reach the HTTP port, independent of your browser URL.' \
  '1) Local access / reverse proxy running directly on this host (127.0.0.1)' \
  '2) LAN / all host interfaces (0.0.0.0)' \
  'A proxy in another container needs Docker network access; see the README.'
printf '%s' 'Listen on [1]: '
IFS= read -r exposure || fail 'Input closed. No configuration was created.'
case "${exposure:-1}" in
  1) bind_address=127.0.0.1 ;;
  2) bind_address=0.0.0.0 ;;
  *) fail 'Choose 1 or 2.' ;;
esac

temporary=$(mktemp -d .gradeshelf-install.XXXXXX)
trap 'rm -rf "$temporary"' EXIT
trap 'exit 1' HUP INT TERM
source_url=https://raw.githubusercontent.com/14flavius/GradeShelf/main
download() {
  curl --fail --silent --show-error --location --proto '=https' --proto-redir '=https' \
    --connect-timeout 15 --max-time 120 "$source_url/$1" -o "$2"
}

# Finish all downloads and checks before publishing any configuration.
download docker-compose.yml "$temporary/docker-compose.yml"
download .env.example "$temporary/env.example"
download scripts/backup.sh "$temporary/backup.sh"
download scripts/prepare-data.sh "$temporary/prepare-data.sh"
sh -n "$temporary/backup.sh"
sh -n "$temporary/prepare-data.sh"
secret=$(openssl rand -hex 32)
sed \
  -e "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$secret|" \
  -e "s|^BETTER_AUTH_URL=.*|BETTER_AUTH_URL=$instance_url|" \
  -e "s|^PORT=.*|PORT=$host_port|" \
  -e "s|^BIND_ADDRESS=.*|BIND_ADDRESS=$bind_address|" \
  -e "s|^COMPOSE_PROJECT_NAME=.*|COMPOSE_PROJECT_NAME=$instance_name|" \
  "$temporary/env.example" > "$temporary/.env"
docker compose --env-file "$temporary/.env" -f "$temporary/docker-compose.yml" config --quiet

# Hard links fail if a concurrent installer created a destination in the meantime.
mkdir -p scripts
ln "$temporary/docker-compose.yml" docker-compose.yml
ln "$temporary/backup.sh" scripts/backup.sh
ln "$temporary/prepare-data.sh" scripts/prepare-data.sh
ln "$temporary/.env" .env

printf '%s\n' 'Configuration saved. Downloading and starting GradeShelf...'
sh scripts/prepare-data.sh
if ! docker compose up -d --wait --wait-timeout 180; then
  fail 'Startup failed. Configuration and any data were retained. Check docker compose logs --tail=100, then retry docker compose up -d --wait.'
fi
printf '\nOpen %s\n' "$instance_url"
printf '%s\n' \
  'Initial login: gradeshelf / gradeshelf0000 — change the password immediately.' \
  'Restart: docker compose restart gradeshelf' \
  'Backup: sh scripts/backup.sh' \
  'Update: sh scripts/backup.sh && docker compose pull && docker compose up -d --wait'
