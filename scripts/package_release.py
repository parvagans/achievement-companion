from __future__ import annotations

import json
import os
import shutil
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

ROOT_DIR = Path(__file__).resolve().parents[1]
RELEASE_DIR = ROOT_DIR / "release"
PLUGIN_ARCHIVE_ROOT = "achievement-companion"
PLUGIN_DISPLAY_NAME = "Achievement Companion"
PLUGIN_FRONTEND_ENTRY_RELATIVE_PATH = Path("dist/index.js")
PLUGIN_BACKEND_ENTRY_RELATIVE_PATH = Path("main.py")
INSTALL_DIAGNOSTIC_RELATIVE_PATH = Path("INSTALL_DIAGNOSTIC.txt")
PACKAGE_RELEASE_COMMAND = "npm run package:release"
EXPECTED_DECK_INSTALL_FOLDER = f"/home/deck/homebrew/plugins/{PLUGIN_ARCHIVE_ROOT}"
REQUIRED_FRONTEND_MARKERS: tuple[str, ...] = (
  "AchievementCompanionGamePageBadge",
  "/routes/library/app",
  "formatDeckyGamePageAchievementBadgeLabel",
  "retroachievements",
  "completion-progress-title-match",
  "dashboard-identity-detail",
  "API_GetGameList.php",
  "ra-api-game-detail",
  "no-retroachievements-shortcut-mapping",
  "ra-game-list-no-match",
)
FORBIDDEN_FRONTEND_MARKERS: tuple[str, ...] = (
  "createRoot",
  "react-dom/client",
  ".protondb-decky-indicator-container",
)
STAGE_DIR = RELEASE_DIR / "staged" / PLUGIN_ARCHIVE_ROOT
REQUIRED_RELATIVE_PATHS: tuple[Path, ...] = (
  Path("main.py"),
  Path("backend/__init__.py"),
  Path("backend/http.py"),
  Path("backend/tls.py"),
  Path("backend/redaction.py"),
  Path("backend/secrets.py"),
  Path("backend/storage.py"),
  Path("backend/provider_config.py"),
  Path("backend/diagnostics.py"),
  Path("backend/steam_shortcuts.py"),
  Path("package.json"),
  Path("plugin.json"),
  Path("README.md"),
  Path("LICENSE"),
  Path("THIRD_PARTY_NOTICES.md"),
)
RELEASE_PACKAGE_JSON_ALLOWED_FIELDS: tuple[str, ...] = (
  "name",
  "version",
  "author",
  "license",
  "type",
  "dependencies",
)


def read_package_version(root_dir: Path = ROOT_DIR) -> str:
  package_json_path = root_dir / "package.json"
  package_data = json.loads(package_json_path.read_text(encoding="utf-8"))
  version = package_data.get("version")
  if not isinstance(version, str) or version.strip() == "":
    raise RuntimeError("package.json version is missing.")
  return version.strip()


def read_plugin_name(root_dir: Path = ROOT_DIR) -> str:
  plugin_json_path = root_dir / "plugin.json"
  plugin_data = json.loads(plugin_json_path.read_text(encoding="utf-8"))
  plugin_name = plugin_data.get("name")
  if not isinstance(plugin_name, str) or plugin_name.strip() == "":
    raise RuntimeError("plugin.json name is missing.")
  return plugin_name.strip()


def _copy_required_file(root_dir: Path, stage_dir: Path, relative_path: Path) -> None:
  source_path = root_dir / relative_path
  if not source_path.exists():
    raise FileNotFoundError(f"Required release file is missing: {relative_path.as_posix()}")

  destination_path = stage_dir / relative_path
  destination_path.parent.mkdir(parents=True, exist_ok=True)
  shutil.copy2(source_path, destination_path)


def _copy_dist_bundle_files(root_dir: Path, stage_dir: Path) -> None:
  source_dist_dir = root_dir / "dist"
  if not source_dist_dir.is_dir():
    raise FileNotFoundError("Required release dist directory is missing: dist")

  dist_bundle_paths = sorted(
    path for path in source_dist_dir.iterdir() if path.is_file() and path.suffix == ".js"
  )
  if not dist_bundle_paths:
    raise RuntimeError("Required release dist JavaScript bundle files are missing.")

  for source_path in dist_bundle_paths:
    destination_path = stage_dir / "dist" / source_path.name
    destination_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source_path, destination_path)


def _get_staged_dist_bundle_paths(stage_dir: Path) -> list[Path]:
  dist_dir = stage_dir / "dist"
  return sorted(
    path for path in dist_dir.iterdir() if path.is_file() and path.suffix == ".js"
  )


def _find_dist_marker_hits(stage_dir: Path) -> dict[str, list[str]]:
  marker_hits: dict[str, list[str]] = {marker: [] for marker in REQUIRED_FRONTEND_MARKERS}

  for bundle_path in _get_staged_dist_bundle_paths(stage_dir):
    bundle_text = bundle_path.read_text(encoding="utf-8", errors="ignore")
    for marker in REQUIRED_FRONTEND_MARKERS:
      if marker in bundle_text:
        marker_hits[marker].append(bundle_path.relative_to(stage_dir).as_posix())

  return marker_hits


def _find_dist_forbidden_marker_hits(stage_dir: Path) -> dict[str, list[str]]:
  marker_hits: dict[str, list[str]] = {marker: [] for marker in FORBIDDEN_FRONTEND_MARKERS}

  for bundle_path in _get_staged_dist_bundle_paths(stage_dir):
    bundle_text = bundle_path.read_text(encoding="utf-8", errors="ignore")
    for marker in FORBIDDEN_FRONTEND_MARKERS:
      if marker in bundle_text:
        marker_hits[marker].append(bundle_path.relative_to(stage_dir).as_posix())

  return marker_hits


def _write_install_diagnostic_file(root_dir: Path, stage_dir: Path) -> None:
  version = read_package_version(root_dir)
  plugin_name = read_plugin_name(root_dir)
  staged_bundle_paths = _get_staged_dist_bundle_paths(stage_dir)
  staged_bundle_names = [path.relative_to(stage_dir).as_posix() for path in staged_bundle_paths]
  marker_hits = _find_dist_marker_hits(stage_dir)
  forbidden_marker_hits = _find_dist_forbidden_marker_hits(stage_dir)
  active_frontend_marker_hits = [
    bundle_name
    for bundle_name in marker_hits["AchievementCompanionGamePageBadge"]
    if Path(bundle_name).name.startswith("index")
  ]
  if not active_frontend_marker_hits:
    raise RuntimeError(
      "Release dist JavaScript bundle files are missing the required diagnostic marker in the active frontend entry chain."
    )
  forbidden_hit_lines = [
    f"{marker}: {', '.join(hit_names)}"
    for marker, hit_names in forbidden_marker_hits.items()
    if hit_names
  ]
  if forbidden_hit_lines:
    raise RuntimeError(
      "Release dist JavaScript bundle files still contain forbidden Decky runtime markers: "
      + "; ".join(forbidden_hit_lines)
      + "."
    )

  build_timestamp = datetime.now(timezone.utc).isoformat()
  diagnostic_lines = [
    f"build_timestamp_utc: {build_timestamp}",
    f"version: {version}",
    f"plugin_id_or_folder: {PLUGIN_ARCHIVE_ROOT}",
    f"plugin_display_name: {plugin_name}",
    f"expected_deck_install_folder: {EXPECTED_DECK_INSTALL_FOLDER}",
    f"frontend_entry_file: {PLUGIN_FRONTEND_ENTRY_RELATIVE_PATH.as_posix()}",
    f"backend_entry_file: {PLUGIN_BACKEND_ENTRY_RELATIVE_PATH.as_posix()}",
    "active_js_bundle_chunks:",
    *[f"  - {bundle_name}" for bundle_name in staged_bundle_names],
    "required_marker_strings_found:",
    *[
      f"  - {marker}: {', '.join(hit_names) if hit_names else 'missing'}"
      for marker, hit_names in marker_hits.items()
    ],
    "forbidden_marker_strings_found:",
    *[
      f"  - {marker}: {', '.join(hit_names) if hit_names else 'clean'}"
      for marker, hit_names in forbidden_marker_hits.items()
    ],
    f"active_frontend_bundle_marker_found: {', '.join(active_frontend_marker_hits)}",
    f"package_command_used: {PACKAGE_RELEASE_COMMAND}",
  ]

  destination_path = stage_dir / INSTALL_DIAGNOSTIC_RELATIVE_PATH
  destination_path.parent.mkdir(parents=True, exist_ok=True)
  destination_path.write_text("\n".join(diagnostic_lines) + "\n", encoding="utf-8")


def _write_release_package_json(root_dir: Path, stage_dir: Path) -> None:
  source_path = root_dir / "package.json"
  package_data = json.loads(source_path.read_text(encoding="utf-8"))
  release_package_data = {
    field_name: package_data[field_name]
    for field_name in RELEASE_PACKAGE_JSON_ALLOWED_FIELDS
    if field_name in package_data
  }

  destination_path = stage_dir / "package.json"
  destination_path.parent.mkdir(parents=True, exist_ok=True)
  destination_path.write_text(
    json.dumps(release_package_data, indent=2) + "\n",
    encoding="utf-8",
  )


def _remove_tree(path: Path) -> None:
  if not path.exists():
    return

  def handle_remove_error(func, target_path, exc_info):  # noqa: ANN001
    del exc_info
    try:
      os.chmod(target_path, 0o700)
    except OSError:
      pass
    func(target_path)

  shutil.rmtree(path, onerror=handle_remove_error)


def stage_release_package(root_dir: Path = ROOT_DIR, stage_dir: Path = STAGE_DIR) -> Path:
  if stage_dir.exists():
    _remove_tree(stage_dir)

  stage_dir.mkdir(parents=True, exist_ok=True)
  for relative_path in REQUIRED_RELATIVE_PATHS:
    if relative_path == Path("package.json"):
      _write_release_package_json(root_dir, stage_dir)
      continue
    _copy_required_file(root_dir, stage_dir, relative_path)

  _copy_dist_bundle_files(root_dir, stage_dir)
  _write_install_diagnostic_file(root_dir, stage_dir)

  if not (stage_dir / "main.py").exists():
    raise RuntimeError("Staged release output is missing main.py.")
  if not (stage_dir / "backend" / "__init__.py").exists():
    raise RuntimeError("Staged release output is missing backend/__init__.py.")
  if not (stage_dir / "backend" / "http.py").exists():
    raise RuntimeError("Staged release output is missing backend/http.py.")
  if not (stage_dir / "backend" / "tls.py").exists():
    raise RuntimeError("Staged release output is missing backend/tls.py.")
  if not (stage_dir / "package.json").exists():
    raise RuntimeError("Staged release output is missing package.json.")
  if not any((stage_dir / "dist").glob("*.js")):
    raise RuntimeError("Staged release output is missing dist JavaScript bundle files.")
  if not (stage_dir / INSTALL_DIAGNOSTIC_RELATIVE_PATH).exists():
    raise RuntimeError("Staged release output is missing INSTALL_DIAGNOSTIC.txt.")

  return stage_dir


def verify_staged_release_package(stage_dir: Path = STAGE_DIR) -> None:
  if not (stage_dir / "main.py").exists():
    raise RuntimeError("Staged release output is missing main.py.")
  if not (stage_dir / "backend" / "__init__.py").exists():
    raise RuntimeError("Staged release output is missing backend/__init__.py.")
  if not (stage_dir / "backend" / "secrets.py").exists():
    raise RuntimeError("Staged release output is missing backend/secrets.py.")
  if not (stage_dir / "backend" / "provider_config.py").exists():
    raise RuntimeError("Staged release output is missing backend/provider_config.py.")
  if not (stage_dir / "backend" / "diagnostics.py").exists():
    raise RuntimeError("Staged release output is missing backend/diagnostics.py.")
  if not (stage_dir / "backend" / "http.py").exists():
    raise RuntimeError("Staged release output is missing backend/http.py.")
  if not (stage_dir / "backend" / "tls.py").exists():
    raise RuntimeError("Staged release output is missing backend/tls.py.")
  if not (stage_dir / "package.json").exists():
    raise RuntimeError("Staged release output is missing package.json.")
  if not (stage_dir / INSTALL_DIAGNOSTIC_RELATIVE_PATH).exists():
    raise RuntimeError("Staged release output is missing INSTALL_DIAGNOSTIC.txt.")

def create_release_zip(
  *,
  root_dir: Path = ROOT_DIR,
  release_dir: Path = RELEASE_DIR,
  stage_dir: Path = STAGE_DIR,
) -> Path:
  release_dir.mkdir(parents=True, exist_ok=True)
  version = read_package_version(root_dir)
  zip_path = release_dir / f"achievement-companion-v{version}.zip"
  if zip_path.exists():
    zip_path.unlink()

  with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as archive:
    for file_path in sorted(path for path in stage_dir.rglob("*") if path.is_file()):
      archive.write(file_path, arcname=f"{PLUGIN_ARCHIVE_ROOT}/{file_path.relative_to(stage_dir).as_posix()}")

  return zip_path


def build_release_package(root_dir: Path = ROOT_DIR) -> tuple[Path, Path]:
  stage_dir = stage_release_package(root_dir=root_dir)
  verify_staged_release_package(stage_dir)
  zip_path = create_release_zip(root_dir=root_dir, stage_dir=stage_dir)
  return stage_dir, zip_path


def main(argv: Iterable[str] | None = None) -> int:
  del argv
  _, zip_path = build_release_package(ROOT_DIR)
  print(zip_path)
  return 0


if __name__ == "__main__":
  raise SystemExit(main(sys.argv[1:]))
