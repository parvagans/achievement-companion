from __future__ import annotations

import tarfile
import sys
from pathlib import Path

from package_steamos_preview import (
  ROOT_DIR,
  STEAMOS_PREVIEW_ROOT_DIRNAME,
  STEAMOS_PREVIEW_SOURCE_TO_STAGE_PATHS,
  STEAMOS_PREVIEW_EXECUTABLE_STAGE_PATHS,
  get_steamos_preview_tarball_path,
)


EXPECTED_ARCHIVE_NAMES = {
  STEAMOS_PREVIEW_ROOT_DIRNAME,
  *{
    f"{STEAMOS_PREVIEW_ROOT_DIRNAME}/{stage_relative_path.as_posix()}"
    for stage_relative_path in STEAMOS_PREVIEW_SOURCE_TO_STAGE_PATHS.values()
  },
}
FORBIDDEN_ARCHIVE_MARKERS = (
  "provider-config.json",
  "provider-secrets.json",
  ".tmp-steamos",
  "node_modules",
  "release/staged",
  "dist/index.js",
  "plugin.json",
  "package.json",
  "achievement-companion-v",
)
WRAPPER_SCRIPT_FORBIDDEN_MARKERS = (
  "Authorization",
  "Bearer ",
  "provider-config.json",
  "provider-secrets.json",
  "apiKey",
  "token=",
)


def verify_steamos_preview_tarball_payload(tarball_path: Path) -> None:
  with tarfile.open(tarball_path, "r:gz") as archive:
    names = set(archive.getnames())

  missing_names = sorted(EXPECTED_ARCHIVE_NAMES - names)
  unexpected_names = sorted(names - EXPECTED_ARCHIVE_NAMES)
  if missing_names or unexpected_names:
    problems: list[str] = []
    if missing_names:
      problems.append(f"missing: {', '.join(missing_names)}")
    if unexpected_names:
      problems.append(f"unexpected: {', '.join(unexpected_names)}")
    raise RuntimeError(f"SteamOS preview artifact payload mismatch ({'; '.join(problems)}).")


def verify_steamos_preview_tarball_exclusions(tarball_path: Path) -> None:
  with tarfile.open(tarball_path, "r:gz") as archive:
    names = archive.getnames()
    wrapper_contents: dict[str, str] = {}
    wrapper_modes: dict[str, int] = {}
    for stage_relative_path in STEAMOS_PREVIEW_EXECUTABLE_STAGE_PATHS:
      archive_name = f"{STEAMOS_PREVIEW_ROOT_DIRNAME}/{stage_relative_path.as_posix()}"
      member = archive.getmember(archive_name)
      wrapper_modes[archive_name] = member.mode
      extracted = archive.extractfile(member)
      if extracted is None:
        raise RuntimeError(f"SteamOS preview wrapper script is unreadable: {archive_name}")
      wrapper_contents[archive_name] = extracted.read().decode("utf-8")

  forbidden_matches = [
    marker
    for marker in FORBIDDEN_ARCHIVE_MARKERS
    if any(marker in name for name in names)
  ]
  if forbidden_matches:
    raise RuntimeError(
      "SteamOS preview artifact includes forbidden files or markers: "
      + ", ".join(sorted(set(forbidden_matches)))
      + "."
    )

  non_executable_wrappers = [
    name
    for name, mode in wrapper_modes.items()
    if mode & 0o111 == 0
  ]
  if non_executable_wrappers:
    raise RuntimeError(
      "SteamOS preview wrapper scripts are not executable: "
      + ", ".join(non_executable_wrappers)
      + "."
    )

  wrapper_leaks = [
    f"{name}: {marker}"
    for name, content in wrapper_contents.items()
    for marker in WRAPPER_SCRIPT_FORBIDDEN_MARKERS
    if marker in content
  ]
  if wrapper_leaks:
    raise RuntimeError(
      "SteamOS preview wrapper scripts contain forbidden markers: "
      + ", ".join(wrapper_leaks)
      + "."
    )


def main(argv: list[str] | None = None) -> int:
  del argv
  tarball_path = get_steamos_preview_tarball_path(root_dir=ROOT_DIR)
  if not tarball_path.exists():
    raise RuntimeError(f"SteamOS preview artifact does not exist: {tarball_path}")

  verify_steamos_preview_tarball_payload(tarball_path)
  verify_steamos_preview_tarball_exclusions(tarball_path)
  print(tarball_path)
  return 0


if __name__ == "__main__":
  raise SystemExit(main(sys.argv[1:]))
