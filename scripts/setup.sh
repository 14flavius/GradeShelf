#!/bin/sh
set -eu
umask 077

cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

if [ -e .env ] || [ -L .env ]; then
  printf '%s\n' 'Existing .env preserved. Check BETTER_AUTH_URL before starting.'
  exit 0
fi

if ! command -v openssl >/dev/null 2>&1; then
  printf '%s\n' 'OpenSSL is required to generate the secret. No files were changed.' >&2
  exit 1
fi

secret=$(openssl rand -hex 32)
temporary=$(mktemp .env.setup.XXXXXX)
trap 'rm -f "$temporary"' EXIT
trap 'exit 1' HUP INT TERM

sed "s/^BETTER_AUTH_SECRET=$/BETTER_AUTH_SECRET=$secret/" .env.example > "$temporary"
# A hard link publishes the complete file without overwriting a concurrent setup.
if ! ln "$temporary" .env; then
  printf '%s\n' 'Could not create .env. Any existing configuration was preserved.' >&2
  exit 1
fi

printf '%s\n' \
  'Created .env with a private, random secret.' \
  'For LAN or domain access, edit BETTER_AUTH_URL and BIND_ADDRESS before starting.' \
  'New Docker installation: sh scripts/prepare-data.sh && docker compose up -d --wait' \
  'Existing installation: keep its data directory and storage configuration.'
