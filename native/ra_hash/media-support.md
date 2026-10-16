# RetroAchievements media support audit

This audit is for the pinned `rcheevos` v12.5.0, `nod` commit
`ebd80cac99b48a323200d84365e07a58cc27412d`, `libchdr` v0.3.0 commit
`93d8c239ff0d4e8d7722985992649fce12d2463b`, and LZ4 v1.10.0 commit
`ebb370ca83af193212df4dcbadcc5d87bc0de2f0`. Console IDs come from the
existing RA systems mapping; the filename suffix never decides the RA hash.
`SUPPORTED` means the packaged helper has a reader. `NOT_IMPLEMENTED` means
the logical game can be hashable by RA, but this package has no validated
adapter. `UNVALIDATED` means a bundled reader may recognize the format but no
equivalence fixture proves the resulting RA hash. `RA_UNSUPPORTED` would mean RA does not define an equivalent game
representation; none of the formats below can be classified that way solely
from its extension.

| Media | Relevant systems | Status | Reader and limitation |
| --- | --- | --- | --- |
| Direct cartridge / executable ROM | NES, NDS/DSi, Game Boy families, N64, SNES, Genesis, 3DS, and other mapped systems | SUPPORTED | Pinned rcheevos file reader; console-specific validity and hashing stay upstream. This does not imply that every emulator install/container format is supported. |
| Raw ISO / GCM | GameCube, Wii, PS2, PSP, other mapped disc systems | SUPPORTED | `nod` probes Nintendo optical discs; otherwise rcheevos direct file/CD reader. A valid game layout is required. |
| BIN / IMG | PS1, PS2, Sega CD, other mapped CD systems | SUPPORTED | rcheevos default CD reader; a bare image may lack multi-track context. |
| CUE plus tracks | PS1, Saturn, Sega CD, and other mapped CD systems | SUPPORTED | rcheevos cue/track reader. Descriptor hashes are not cached because referenced tracks can change. |
| GDI plus tracks | Dreamcast | SUPPORTED | rcheevos GDI/track reader. Descriptor hashes are not cached because referenced tracks can change. |
| PBP | PSP | SUPPORTED | rcheevos PSP parser; it validates the PBP content. |
| WAD | WiiWare | SUPPORTED | rcheevos WiiWare path, distinct from optical-disc hashing. |
| RVZ / WIA / GCZ | GameCube, Wii | SUPPORTED | `nod` random-access disc reader exposed through rcheevos file callbacks. Synthetic ISO/container hash equality is tested for both consoles; Wii RVZ/WIA cover decrypted and encrypted partitions, renamed RVZ content probing is tested, and M3U-to-RVZ uses the same logical reader. |
| Nintendo CISO | GameCube, Wii | SUPPORTED | `nod` reader; distinct from PSP/PS2 CSO. Synthetic equality is tested. |
| WBFS | Wii | SUPPORTED | `nod` reader; synthetic equality is tested. |
| TGC | GameCube | UNVALIDATED | Although `nod` advertises TGC, its reader rejected a synthetic TGC produced by its own writer. No support is claimed until a valid equivalence vector passes. |
| NFS | Wii | UNVALIDATED | `nod` advertises NFS, but the multi-file layout needs a validated synthetic equivalence vector before support can be claimed. |
| ZIP, one clear game member | Mapped non-Arcade systems | SUPPORTED | Python streams one member to a temporary file with its suffix, a 2 GiB extracted-size cap, and a 128-entry cap; rcheevos hashes the member. Diagnostics identify `zip-member`. Multiple plausible members are ambiguous. |
| ZIP / 7z Arcade | Arcade | SUPPORTED | rcheevos archive-name hashing. MS-DOS ZIP uses its upstream content method. |
| 7z outside Arcade / RAR | Cartridge and disc systems | NOT_IMPLEMENTED | Would require a bounded member reader and deterministic member selection; no generic archive hash is used. |
| CHD | CD/DVD systems, including PS1, PS2, PSP, Dreamcast, Sega CD, and Saturn | SUPPORTED | Pinned `libchdr` exposes CD track metadata and sector payloads or 2048-byte DVD logical reads to rcheevos. Copyright-free PS2 CD-CHD and DVD-CHD fixtures must hash identically to their raw ISO source. |
| PSP/PS2 CSO / ZSO | PSP, PS2 | SUPPORTED | Content-probed random-access CISO/ZISO reader with bounded header, index, block, and offset validation. Raw-deflate CSO blocks use bundled miniz and ZSO blocks use pinned LZ4. Synthetic PSP and PS2 ISO/container hash equality is tested, including renamed containers. |
| M3U / multi-disc playlists | Multi-disc and disc-based systems | SUPPORTED | Resolves the first non-comment entry, matching rcheevos' game-identification policy, then probes the referenced media normally. Relative and absolute entries, UTF-8 BOMs, comments, blank lines, CHD, and RVZ are covered. Playlist hashes are never cached because referenced media can change independently. |
| NKit 1 / NKit 2 | GameCube, Wii | UNVALIDATED | No synthetic equivalence fixture or validated reader path in this package; `nod` documents limited NKit 2 handling for WBFS. |
| WUD / WUX and extracted title directories | Wii U | NOT_IMPLEMENTED | No validated logical-title reader or pinned-rcheevos equivalence vector. A mapped RA system does not imply a supported Steam media representation. |
| XISO / XBE layouts | Xbox | NOT_IMPLEMENTED | No validated XISO filesystem reader or pinned-rcheevos equivalence vector. Direct files still reach upstream hashing, but Xbox media identification is not claimed. |

For Nintendo optical media, the helper probes `nod` regardless of suffix.
`nod` reconstructs the disc's original logical byte view for rcheevos. The
GameCube hash reads the apploader and DOL segments. The Wii hash reads the
disc header, region, partition metadata, and selected partition data using
the representation described by the disc header. The packaged test compares
raw ISO hashes against RVZ/WIA/GCZ and other supported Nintendo containers,
including encrypted Wii ISO against equivalent RVZ and WIA.
The reader does not materialize a full ISO at runtime. CHD media is likewise
read in place: content magic selects libchdr even when the suffix is renamed,
CD tracks are translated to rcheevos sectors, and DVD-style CHDs expose their
logical byte stream. Invalid `.chd` files fail as invalid containers.
PSP/PS2 CSO and ZSO images also remain compressed on disk; only requested
blocks are decoded. Nintendo CISO stays on nod's separate GameCube/Wii path.

`rcheevos` exposes [custom file and CD readers](https://github.com/RetroAchievements/rcheevos/blob/v12.5.0/include/rc_hash.h), and its
[game identification methods](https://docs.retroachievements.org/developer-docs/game-identification.html) define the console hash algorithms.
`nod`'s [format list and C API](https://github.com/encounter/nod) document
the Nintendo container reader. `libchdr` and its
[BSD-3-Clause license](https://github.com/rtissera/libchdr/blob/v0.3.0/LICENSE.txt)
are pinned and bundled into the native helper. The M3U first-entry behavior
tracks [rcheevos' playlist implementation](https://github.com/RetroAchievements/rcheevos/blob/v12.5.0/src/rhash/hash.c),
and ZSO block decoding uses the pinned
[LZ4 library](https://github.com/lz4/lz4/tree/v1.10.0/lib).
