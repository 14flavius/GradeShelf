#!/bin/sh
set -eu
umask 077

cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

if [ ! -f .env ]; then
  printf '%s\n' 'Missing .env; backup stopped.' >&2
  exit 1
fi

container=$(docker compose ps --all --quiet gradeshelf)
if [ -z "$container" ]; then
  printf '%s\n' 'No GradeShelf container found. Use the original Compose project name.' >&2
  exit 1
fi

running=$(docker inspect --format '{{.State.Running}}' "$container")
mkdir -p backups
backup=$(mktemp -d "./backups/$(date -u +%Y%m%d-%H%M%S)-XXXXXX")
cp .env "$backup/.env"
cp docker-compose.yml "$backup/docker-compose.yml"
docker inspect --format '{{.Image}}' "$container" > "$backup/image-id.txt"

finish() {
  status=$?
  if [ "$status" -ne 0 ]; then
    printf '%s\n' \
      "Backup incomplete: $backup. Do not use it to restore." \
      'If the app was stopped, restart it with: docker compose start gradeshelf' >&2
  fi
}
trap finish EXIT
trap 'exit 1' HUP INT TERM

if [ "$running" = true ]; then
  docker compose stop gradeshelf
fi

# Copy the entire directory while no application process can write to SQLite.
docker compose cp gradeshelf:/data "$backup/data"
if [ ! -f "$backup/data/gradeshelf.db" ] || [ ! -d "$backup/data/uploads" ]; then
  printf '%s\n' 'Backup is missing its database or uploads directory.' >&2
  exit 1
fi

printf '%s\n' 'Complete data copy; retain .env and the matching image.' > "$backup/COMPLETE"
if [ "$running" = true ]; then
  docker compose start gradeshelf
fi
printf '%s\n' "Backup saved: $backup" 'Store a protected copy outside this server.'
