#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
revision=1433173220a7eaede6a9ed7a18e94117be1821e0
nod_revision=ebd80cac99b48a323200d84365e07a58cc27412d
libchdr_revision=93d8c239ff0d4e8d7722985992649fce12d2463b
build_dir="$(mktemp -d)"
trap 'rm -rf "$build_dir"' EXIT

git clone --quiet --depth 1 --branch v12.5.0 https://github.com/RetroAchievements/rcheevos.git "$build_dir/rcheevos"
git -C "$build_dir/rcheevos" checkout --quiet "$revision"
test "$(git -C "$build_dir/rcheevos" rev-parse HEAD)" = "$revision"
diff -q --strip-trailing-cr "$root/licenses/rcheevos-MIT.txt" "$build_dir/rcheevos/LICENSE"

git clone --quiet https://github.com/encounter/nod.git "$build_dir/nod"
git -C "$build_dir/nod" checkout --quiet "$nod_revision"
test "$(git -C "$build_dir/nod" rev-parse HEAD)" = "$nod_revision"
diff -q --strip-trailing-cr "$root/licenses/nod-MIT.txt" "$build_dir/nod/LICENSE-MIT"
CARGO_TARGET_DIR="$build_dir/target" RUSTFLAGS="${RUSTFLAGS:-} --remap-path-prefix=$build_dir=." cargo build --manifest-path "$build_dir/nod/Cargo.toml" \
  --package nod-ffi --release --locked --no-default-features \
  --features compress-bzip2-static,compress-lzma-static,compress-zlib-static,compress-zstd-static

git clone --quiet https://github.com/rtissera/libchdr.git "$build_dir/libchdr"
git -C "$build_dir/libchdr" checkout --quiet "$libchdr_revision"
test "$(git -C "$build_dir/libchdr" rev-parse HEAD)" = "$libchdr_revision"
diff -q --strip-trailing-cr "$root/licenses/libchdr-BSD-3-Clause.txt" "$build_dir/libchdr/LICENSE.txt"

src="$build_dir/rcheevos/src"
mkdir -p "$root/bin"
"${CC:-cc}" -std=c11 -O2 -static -ffile-prefix-map="$build_dir"=. -D_GNU_SOURCE -D_FILE_OFFSET_BITS=64 -D_LARGEFILE64_SOURCE \
  -DWANT_RAW_DATA_SECTOR=1 -DWANT_SUBCODE=1 -DVERIFY_BLOCK_CRC=1 \
  -I"$build_dir/rcheevos/include" \
  -I"$build_dir/nod/nod-ffi/include" \
  -I"$build_dir/libchdr/include" \
  -I"$build_dir/libchdr/deps/lzma-25.01/include" \
  -I"$build_dir/libchdr/deps/miniz-3.1.1" \
  -I"$build_dir/libchdr/deps/zstd-1.5.7" \
  -I"$build_dir/libchdr" \
  "$root/native/ra_hash/main.c" "$root/native/ra_hash/media_reader.c" "$root/native/ra_hash/chd_reader.c" \
  "$src/rc_compat.c" "$src/rc_util.c" \
  "$src/rhash/hash.c" "$src/rhash/hash_rom.c" "$src/rhash/hash_disc.c" \
  "$src/rhash/hash_zip.c" "$src/rhash/hash_encrypted.c" "$src/rhash/cdreader.c" \
  "$src/rhash/md5.c" "$src/rhash/aes.c" \
  "$build_dir/libchdr/unity.c" \
  "$build_dir/target/release/libnod.a" -ldl -lpthread -lm \
  -o "$root/bin/ac-rhash"
chmod 755 "$root/bin/ac-rhash"
