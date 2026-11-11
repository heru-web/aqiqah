#!/usr/bin/env bash
set -euo pipefail
SRC=/srv/madani-aqiqah-v3
DBURL=$(grep -m1 '^DATABASE_URL=' "$SRC/.env" | cut -d= -f2-)
DIR=/srv/backups/madani-pg
mkdir -p "$DIR"
STAMP=$(date +%F_%H%M%S)
pg_dump "$DBURL" | gzip > "$DIR/madani_$STAMP.sql.gz.tmp"
mv "$DIR/madani_$STAMP.sql.gz.tmp" "$DIR/madani_$STAMP.sql.gz"
find "$DIR" -name 'madani_*.sql.gz' -type f -mtime +14 -delete
echo "backup selesai: $DIR/madani_$STAMP.sql.gz ($(du -h "$DIR/madani_$STAMP.sql.gz" | cut -f1))"
