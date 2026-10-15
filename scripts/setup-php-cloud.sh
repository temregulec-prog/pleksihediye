#!/usr/bin/env bash
# Codex/Debian development environment only. Do not run this on shared hosting.
set -euo pipefail
umask 077
TOOLS=/tmp/pleksi-php-tools
mkdir -p "$TOOLS"/{etc/apt.conf.d,etc/sources.list.d,state/lists/partial,cache/archives/partial,root}
if ! "$TOOLS/php" -v >/dev/null 2>&1; then
  cat > "$TOOLS/etc/sources.list" <<'SOURCES'
deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://deb.debian.org/debian bookworm main
deb [signed-by=/usr/share/keyrings/debian-archive-keyring.gpg] https://deb.debian.org/debian-security bookworm-security main
SOURCES
  cat > "$TOOLS/apt.conf" <<'APT'
Dir::Etc::main "/tmp/pleksi-php-tools/etc/empty.conf";
Dir::Etc::parts "/tmp/pleksi-php-tools/etc/apt.conf.d";
Dir::Etc::sourcelist "/tmp/pleksi-php-tools/etc/sources.list";
Dir::Etc::sourceparts "/tmp/pleksi-php-tools/etc/sources.list.d";
Dir::State::lists "/tmp/pleksi-php-tools/state/lists";
Dir::State::status "/tmp/pleksi-php-tools/state/status";
Dir::State::extended_states "/tmp/pleksi-php-tools/state/extended_states";
Dir::Cache::archives "/tmp/pleksi-php-tools/cache/archives";
APT::Sandbox::User "agent";
Debug::NoLocking "true";
APT
  cp /var/lib/dpkg/status "$TOOLS/state/status"
  APT_CONFIG="$TOOLS/apt.conf" /usr/bin/apt-get update
  APT_CONFIG="$TOOLS/apt.conf" /usr/bin/apt-get --download-only -y install php8.2-cli php8.2-common php8.2-mysql php8.2-curl php8.2-xml php8.2-mbstring mariadb-server-core mariadb-client-core
  for archive in "$TOOLS/cache/archives/"*.deb; do dpkg-deb -x "$archive" "$TOOLS/root"; done
fi
cat > "$TOOLS/php.ini" <<'INI'
extension_dir=/tmp/pleksi-php-tools/root/usr/lib/php/20220829
extension=pdo
extension=mysqlnd
extension=pdo_mysql
extension=mbstring
extension=curl
extension=dom
extension=simplexml
extension=xml
extension=fileinfo
extension=iconv
extension=ctype
upload_max_filesize=5M
post_max_size=8M
memory_limit=192M
max_execution_time=120
display_errors=Off
log_errors=On
session.save_path=/tmp
pdo_mysql.default_socket=/tmp/pleksi-php-tools/mysql.sock
INI
cat > "$TOOLS/php" <<'PHP'
#!/bin/sh
exec env LD_LIBRARY_PATH=/tmp/pleksi-php-tools/root/usr/lib/x86_64-linux-gnu:/tmp/pleksi-php-tools/root/lib/x86_64-linux-gnu /tmp/pleksi-php-tools/root/usr/bin/php8.2 -c /tmp/pleksi-php-tools/php.ini "$@"
PHP
chmod +x "$TOOLS/php"
if [ ! -d "$TOOLS/mysql/mysql" ]; then
  LD_LIBRARY_PATH="$TOOLS/root/usr/lib/x86_64-linux-gnu:$TOOLS/root/lib/x86_64-linux-gnu" "$TOOLS/root/usr/bin/mariadb-install-db" --basedir="$TOOLS/root/usr" --datadir="$TOOLS/mysql" --auth-root-authentication-method=normal --skip-test-db
fi
"$TOOLS/php" -v
