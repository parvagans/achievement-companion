"""Generate notices for the pinned nod-ffi runtime dependency graph.

Run on Linux after fetching the pinned nod checkout with Cargo. This is a
release-maintenance tool; the generated notice is committed and packaged.
"""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


def main() -> None:
  parser = argparse.ArgumentParser()
  parser.add_argument("metadata", type=Path, help="cargo metadata JSON for pinned nod")
  parser.add_argument("source_root", type=Path, help="directory holding nod and .cargo")
  parser.add_argument("output", type=Path)
  args = parser.parse_args()

  metadata = json.loads(args.metadata.read_text(encoding="utf-8"))
  packages = {package["id"]: package for package in metadata["packages"]}
  nodes = {node["id"]: node for node in metadata["resolve"]["nodes"]}
  root = next(package["id"] for package in packages.values() if package["name"] == "nod-ffi")
  reachable = {root}
  pending = [root]
  while pending:
    for dependency in nodes[pending.pop()]["deps"]:
      if not any(kind["kind"] is None for kind in dependency["dep_kinds"]):
        continue
      package_id = dependency["pkg"]
      if package_id not in reachable:
        reachable.add(package_id)
        pending.append(package_id)

  entries: list[tuple[str, str, str, str]] = []
  texts: dict[str, str] = {}
  for package_id in sorted(reachable, key=lambda value: (packages[value]["name"], packages[value]["version"])):
    package = packages[package_id]
    source_dir = Path(package["manifest_path"]).parent
    if str(source_dir).startswith("/work/"):
      source_dir = args.source_root / source_dir.relative_to("/work")
    notice_paths = sorted(
      path for path in source_dir.iterdir()
      if path.is_file() and path.name.upper().startswith(("LICENSE", "COPYING", "NOTICE"))
    )
    for path in notice_paths:
      content = path.read_text(encoding="utf-8", errors="replace").strip() + "\n"
      digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
      texts[digest] = content
      entries.append((package["name"], package["version"], package["license"] or "UNDECLARED", f"{path.name}:{digest[:12]}"))
    if not notice_paths:
      entries.append((package["name"], package["version"], package["license"] or "UNDECLARED", "NO_TOP_LEVEL_NOTICE"))

  special = {
    "libbzip2 (bzip2-sys 0.1.13+1.0.8)": "crates/bzip2-sys-0.1.13+1.0.8/bzip2-1.0.8/LICENSE",
    "liblzma (liblzma-sys 0.4.6)": "crates/liblzma-sys-0.4.6/xz/COPYING.0BSD",
    "zlib (libz-sys 1.1.28)": "crates/libz-sys-1.1.28/src/zlib/LICENSE",
    "Zstandard (zstd-sys 2.0.16+zstd.1.5.7)": "crates/zstd-sys-2.0.16+zstd.1.5.7/zstd/LICENSE",
    "Zstandard bindings (zstd-sys 2.0.16+zstd.1.5.7)": "crates/zstd-sys-2.0.16+zstd.1.5.7/LICENSE.BSD-3-Clause",
  }
  for name, relative in special.items():
    path = args.source_root / relative
    content = path.read_text(encoding="utf-8", errors="replace").strip() + "\n"
    digest = hashlib.sha256(content.encode("utf-8")).hexdigest()
    texts[digest] = content
    entries.append((name, "vendored native source", "see license text", f"{path.name}:{digest[:12]}"))

  lines = [
    "# Native dependency notices",
    "",
    "Generated from the nod/nod-ffi commit and locked Rust dependency graph recorded in",
    "THIRD_PARTY_NOTICES.md. Only normal (runtime) Cargo dependencies are listed.",
    "Build tools and development dependencies are not linked into ac-rhash.",
    "License selections are those allowed by each package's declaration.",
    "",
    "| Package | Version/source | Declared license | Notice file and SHA-256 prefix |",
    "| --- | --- | --- | --- |",
  ]
  lines.extend(f"| {name} | {version} | {license_id} | {notice} |" for name, version, license_id, notice in entries)
  lines.extend(["", "## Verbatim notices", ""])
  for digest, content in sorted(texts.items()):
    lines.extend([f"### SHA-256 {digest}", "", "```text", content.rstrip(), "```", ""])
  args.output.write_text("\n".join(lines), encoding="utf-8")
  print(f"{len(reachable)} runtime crates, {len(entries)} notice entries, {len(texts)} distinct notices")


if __name__ == "__main__":
  main()
