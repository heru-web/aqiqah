#!/usr/bin/env bash
# Uji restore mode "sarang terpisah": dump terbaru -> DB sementara uji_restore,
# verifikasi hitung baris, lalu dihapus. TIDAK menyentuh database produksi.
set -euo pipefail
SRC=/srv/madani-aqiqah-v3
DBURL=$(grep -m1 '^DATABASE_URL=' "$SRC/.env" | cut -d= -f2-)
DUMP=${1:-$(ls -t /srv/backups/madani-pg/madani_*.sql.gz | head -1)}
PSQL="sudo -n -u postgres psql"

echo "sumber dump : $DUMP"
$PSQL -q -c "DROP DATABASE IF EXISTS uji_restore;" -c "CREATE DATABASE uji_restore;"
gunzip -c "$DUMP" | $PSQL -d uji_restore -q
echo "verifikasi hitung baris pada uji_restore:"
$PSQL -d uji_restore -qAtc "SELECT 'orders=' || count(*) FROM orders; SELECT 'users=' || count(*) FROM users; SELECT 'animals=' || count(*) FROM animals; SELECT 'journals=' || count(*) FROM journals;"
$PSQL -q -c "DROP DATABASE IF EXISTS uji_restore;"
echo "uji restore BERHASIL (database sementara sudah dihapus)."
