# RetroAchievements ROM hashing

RetroAchievements uses console-specific ROM hashes. A generic whole-file MD5
is wrong for systems such as Nintendo DS and for disc-based games. The bundled
`ac-rhash` helper calls upstream `rcheevos` `rc_hash_generate` with the
RetroAchievements console ID resolved from the shortcut's platform metadata.
It accepts a file path and returns one JSON object on stdout. Diagnostics from
`rcheevos` go to stderr. The [media support audit](media-support.md) records
the validated readers and known gaps for mapped systems.

The build uses upstream `rcheevos` v12.5.0, pinned to commit
`1433173220a7eaede6a9ed7a18e94117be1821e0`, directly from its official
repository. The build verifies the commit and MIT license against
`licenses/rcheevos-MIT.txt`. No upstream source is duplicated in this repo.
CHD access uses `libchdr` v0.3.0 at commit
`93d8c239ff0d4e8d7722985992649fce12d2463b`; the build verifies its
BSD-3-Clause license against `licenses/libchdr-BSD-3-Clause.txt`.
ZSO block decompression uses LZ4 v1.10.0 at commit
`ebb370ca83af193212df4dcbadcc5d87bc0de2f0`; only its BSD-2-Clause `lib`
sources are linked, and the build verifies `licenses/lz4-BSD-2-Clause.txt`.
On Linux x86_64, run `bash scripts/build-ra-hash.sh`; it requires Git and a C11
compiler with static libc support. `release:prepare` runs this build and the
synthetic native smoke test before packaging. The release ZIP includes
`bin/ac-rhash` with Unix executable permissions and the applicable licenses. The
helper is statically linked, so the installed Decky plugin needs no extra
package, compiler, or runtime download. Building now also requires Rust 1.86+
and Cargo for the pinned MIT/Apache-2.0 `nod` C library; the release bundles
its MIT license.

The TypeScript resolver determines `system.consoleId` from the existing RA
systems metadata, then passes it to Decky's backend method. Python discovers
the ROM path in `steam_shortcuts.py`, invokes `bin/ac-rhash` from the installed
plugin root with an argument array in a backend worker, and validates the JSON
and hash. Successful hashes are cached in memory by resolved path, size,
nanosecond modification time, and console ID. Failures are not cached. CUE,
GDI, and M3U files are excluded from this cache because referenced content could
change independently.

Existing plausible game files, including extensions outside historic hints, are
passed to the helper for media probing and console-specific validation. For
GameCube and Wii images, `nod` offers random-access logical disc reads through
the per-iterator rcheevos file callbacks. This covers validated RVZ, WIA, GCZ,
Nintendo CISO, and WBFS without temporary ISO conversion or installed Dolphin.
M3U playlists resolve their first non-comment entry before reader selection, so
raw images, CHDs, and Nintendo containers receive the correct underlying reader.
PSP and PS2 CISO/ZISO images expose bounded, random-access logical ISO reads;
zlib and LZ4 blocks are decoded in memory without extracting a temporary ISO.
WiiWare WAD stays on rcheevos' distinct direct-file path. Other disc hashing
uses upstream file and CD readers; Python does not read the image. CHD files
are probed by content, then streamed through libchdr: CD metadata is translated
into rcheevos track/sector callbacks, while 2048-byte-unit DVD images use
random-access logical reads. No temporary ISO or installed `chdman` is needed.
Non-Arcade ZIPs with exactly one
plausible game member are streamed to a size-bounded temporary file, then hashed by `rcheevos`
for the resolved console. Ambiguous ZIPs are rejected. Arcade ZIP/7z and MS-DOS
ZIP use upstream archive methods directly. Other 7z and RAR archives are
reported unavailable. RetroAchievements Game IDs resolve only
from an exact generated hash in the supported-hash catalogue. Unsupported media,
unreadable paths, and valid unlisted hashes remain unresolved.

