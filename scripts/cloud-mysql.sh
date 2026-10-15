#!/usr/bin/env bash
# Local socket-only test database; never a production database service.
set -euo pipefail
TOOLS=/tmp/pleksi-php-tools
if LD_LIBRARY_PATH="$TOOLS/root/usr/lib/x86_64-linux-gnu:$TOOLS/root/lib/x86_64-linux-gnu" "$TOOLS/root/usr/bin/mariadb" --no-defaults --socket="$TOOLS/mysql.sock" -u root -e 'SELECT 1' >/dev/null 2>&1; then
  echo 'Local test database already running.'
  exit 0
fi
exec env LD_LIBRARY_PATH="$TOOLS/root/usr/lib/x86_64-linux-gnu:$TOOLS/root/lib/x86_64-linux-gnu" "$TOOLS/root/usr/sbin/mariadbd" --no-defaults --basedir="$TOOLS/root/usr" --datadir="$TOOLS/mysql" --socket="$TOOLS/mysql.sock" --pid-file="$TOOLS/mysql.pid" --skip-networking --log-error="$TOOLS/mysql.log" --innodb-buffer-pool-size=64M
