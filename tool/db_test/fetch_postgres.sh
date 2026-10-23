#!/bin/sh
# Downloads portable Postgres binaries (initdb, pg_ctl, postgres; with pg_trgm and pgcrypto) into a
# temporary directory and prints the bin path to pass as --pg-bin / PG_BIN. Nothing is installed.
#
#   PG_BIN=$(tool/db_test/fetch_postgres.sh) python3 tool/db_test/run_tests.py
#
# Binaries come from Maven Central (io.zonky.test.postgres embedded-postgres-binaries).
# Override the version with PG_VERSION=15.14.0 (any version listed there). Delete the printed
# directory's parent when you're done.
set -eu
VERSION="${PG_VERSION:-17.6.0}"
case "$(uname -s)-$(uname -m)" in
  Darwin-arm64)  PLATFORM=darwin-arm64v8 ;;
  Darwin-x86_64) PLATFORM=darwin-amd64 ;;
  Linux-x86_64)  PLATFORM=linux-amd64 ;;
  Linux-aarch64) PLATFORM=linux-arm64v8 ;;
  *) echo "unsupported platform $(uname -s)-$(uname -m)" >&2; exit 1 ;;
esac
DIR="$(mktemp -d /tmp/wavee-pg-bin-XXXXXX)"
URL="https://repo1.maven.org/maven2/io/zonky/test/postgres/embedded-postgres-binaries-$PLATFORM/$VERSION/embedded-postgres-binaries-$PLATFORM-$VERSION.jar"
curl -fsSL -o "$DIR/pg.jar" "$URL"
(cd "$DIR" && unzip -q pg.jar && mkdir pg && tar -xJf ./*.txz -C pg && rm -f pg.jar ./*.txz && rm -rf META-INF)
echo "$DIR/pg/bin"
