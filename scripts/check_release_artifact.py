from __future__ import annotations

import ast
import json
import sys
import zipfile
from pathlib import Path

from package_release import (
  FORBIDDEN_FRONTEND_MARKERS,
  INSTALL_DIAGNOSTIC_RELATIVE_PATH,
  PLUGIN_ARCHIVE_ROOT,
  REQUIRED_FRONTEND_MARKERS,
  ROOT_DIR,
  read_package_version,
)

EXPECTED_RELEASE_ARCHIVE_NAMES = {
  f"{PLUGIN_ARCHIVE_ROOT}/LICENSE",
  f"{PLUGIN_ARCHIVE_ROOT}/README.md",
  f"{PLUGIN_ARCHIVE_ROOT}/THIRD_PARTY_NOTICES.md",
  f"{PLUGIN_ARCHIVE_ROOT}/py_modules/backend/__init__.py",
  f"{PLUGIN_ARCHIVE_ROOT}/py_modules/backend/http.py",
  f"{PLUGIN_ARCHIVE_ROOT}/py_modules/backend/diagnostics.py",
  f"{PLUGIN_ARCHIVE_ROOT}/py_modules/backend/steam_shortcuts.py",
  f"{PLUGIN_ARCHIVE_ROOT}/py_modules/backend/redaction.py",
  f"{PLUGIN_ARCHIVE_ROOT}/py_modules/backend/secrets.py",
  f"{PLUGIN_ARCHIVE_ROOT}/py_modules/backend/provider_config.py",
  f"{PLUGIN_ARCHIVE_ROOT}/py_modules/backend/storage.py",
  f"{PLUGIN_ARCHIVE_ROOT}/py_modules/backend/tls.py",
  f"{PLUGIN_ARCHIVE_ROOT}/main.py",
  f"{PLUGIN_ARCHIVE_ROOT}/package.json",
  f"{PLUGIN_ARCHIVE_ROOT}/plugin.json",
  f"{PLUGIN_ARCHIVE_ROOT}/{INSTALL_DIAGNOSTIC_RELATIVE_PATH.as_posix()}",
}
PACKAGE_JSON_RELEASE_FORBIDDEN_MARKERS = (
  "build:steamos",
  "start:steamos",
  "doctor:steamos",
  "steamos_doctor",
  "dev_shell",
  "local_launcher",
  "local_server",
  "--xdg-root",
)
PACKAGE_JSON_REQUIRED_FIELDS = (
  "name",
  "version",
)
PLUGIN_JSON_REQUIRED_FIELDS = (
  "name",
  "version",
)
RUNTIME_PACKAGE_NAME = "backend"
RUNTIME_PACKAGE_ARCHIVE_DIR = f"{PLUGIN_ARCHIVE_ROOT}/py_modules/backend"


def get_release_zip_path(root_dir: Path = ROOT_DIR) -> Path:
  version = read_package_version(root_dir)
  return root_dir / "release" / f"achievement-companion-v{version}.zip"


def get_expected_dist_archive_names(root_dir: Path = ROOT_DIR) -> set[str]:
  dist_dir = root_dir / "dist"
  if not dist_dir.is_dir():
    raise RuntimeError("Release dist directory is missing.")

  dist_js_names = {
    f"{PLUGIN_ARCHIVE_ROOT}/dist/{path.name}"
    for path in dist_dir.iterdir()
    if path.is_file() and path.suffix == ".js"
  }
  if not dist_js_names:
    raise RuntimeError("Release dist JavaScript bundle files are missing.")

  return dist_js_names


def verify_release_zip_payload(zip_path: Path) -> None:
  with zipfile.ZipFile(zip_path) as archive:
    names = set(archive.namelist())

  expected_names = EXPECTED_RELEASE_ARCHIVE_NAMES | get_expected_dist_archive_names()
  missing_names = sorted(expected_names - names)
  unexpected_names = sorted(names - expected_names)
  if missing_names or unexpected_names:
    problems: list[str] = []
    if missing_names:
      problems.append(f"missing: {', '.join(missing_names)}")
    if unexpected_names:
      problems.append(f"unexpected: {', '.join(unexpected_names)}")
    raise RuntimeError(f"Release artifact payload mismatch ({'; '.join(problems)}).")


def _runtime_module_archive_candidates(module_name: str) -> tuple[str, ...]:
  if module_name == RUNTIME_PACKAGE_NAME:
    return (f"{RUNTIME_PACKAGE_ARCHIVE_DIR}/__init__.py",)

  relative_module_name = module_name.removeprefix(f"{RUNTIME_PACKAGE_NAME}.")
  relative_module_path = relative_module_name.replace(".", "/")
  return (
    f"{RUNTIME_PACKAGE_ARCHIVE_DIR}/{relative_module_path}.py",
    f"{RUNTIME_PACKAGE_ARCHIVE_DIR}/{relative_module_path}/__init__.py",
  )


def _resolve_relative_import_base(
  *,
  importer_module: str,
  importer_is_package: bool,
  imported_module: str | None,
  level: int,
) -> str | None:
  package_parts = importer_module.split(".")
  if not importer_is_package:
    package_parts = package_parts[:-1]

  parent_levels = level - 1
  if parent_levels > len(package_parts):
    return None

  base_parts = package_parts[:len(package_parts) - parent_levels]
  if imported_module:
    base_parts.extend(imported_module.split("."))
  return ".".join(base_parts)


def _find_runtime_imports(
  source_text: str,
  *,
  module_name: str,
  is_package: bool,
) -> set[str]:
  try:
    tree = ast.parse(source_text, filename=module_name)
  except SyntaxError as error:
    raise RuntimeError(f"Packaged Python source is invalid for {module_name}: {error}") from error

  imported_modules: set[str] = set()
  for node in ast.walk(tree):
    if isinstance(node, ast.Import):
      for alias in node.names:
        if alias.name == RUNTIME_PACKAGE_NAME or alias.name.startswith(f"{RUNTIME_PACKAGE_NAME}."):
          imported_modules.add(alias.name)
      continue

    if not isinstance(node, ast.ImportFrom):
      continue

    if node.level == 0:
      imported_base = node.module
    else:
      imported_base = _resolve_relative_import_base(
        importer_module=module_name,
        importer_is_package=is_package,
        imported_module=node.module,
        level=node.level,
      )

    if not imported_base or (
      imported_base != RUNTIME_PACKAGE_NAME
      and not imported_base.startswith(f"{RUNTIME_PACKAGE_NAME}.")
    ):
      continue

    imported_modules.add(imported_base)
    if node.module is None or imported_base == RUNTIME_PACKAGE_NAME:
      imported_modules.update(
        f"{imported_base}.{alias.name}"
        for alias in node.names
        if alias.name != "*"
      )

  return imported_modules


def verify_release_runtime_import_closure(zip_path: Path) -> None:
  main_archive_name = f"{PLUGIN_ARCHIVE_ROOT}/main.py"
  with zipfile.ZipFile(zip_path) as archive:
    archive_names = set(archive.namelist())
    if main_archive_name not in archive_names:
      raise RuntimeError(f"Release artifact is missing Python entry point: {main_archive_name}")

    pending: list[tuple[str, str, bool]] = [("main", main_archive_name, False)]
    visited: set[str] = set()
    while pending:
      module_name, archive_name, is_package = pending.pop()
      if module_name in visited:
        continue
      visited.add(module_name)

      source_text = archive.read(archive_name).decode("utf-8")
      for imported_module in sorted(
        _find_runtime_imports(
          source_text,
          module_name=module_name,
          is_package=is_package,
        )
      ):
        if imported_module in visited:
          continue

        candidates = _runtime_module_archive_candidates(imported_module)
        imported_archive_name = next(
          (candidate for candidate in candidates if candidate in archive_names),
          None,
        )
        if imported_archive_name is None:
          raise RuntimeError(
            "Release runtime import closure is missing "
            f"{imported_module} required by {module_name}; expected "
            + " or ".join(candidates)
            + "."
          )

        pending.append(
          (
            imported_module,
            imported_archive_name,
            imported_archive_name.endswith("/__init__.py"),
          )
        )


def verify_release_package_json(zip_path: Path) -> None:
  with zipfile.ZipFile(zip_path) as archive:
    package_json_bytes = archive.read(f"{PLUGIN_ARCHIVE_ROOT}/package.json")

  package_json_text = package_json_bytes.decode("utf-8")
  package_data = json.loads(package_json_text)

  missing_fields = [
    field_name
    for field_name in PACKAGE_JSON_REQUIRED_FIELDS
    if not isinstance(package_data.get(field_name), str) or package_data[field_name].strip() == ""
  ]
  if missing_fields:
    raise RuntimeError(
      f"Release package.json is missing required string fields: {', '.join(missing_fields)}."
    )

  if package_data["version"].strip() != read_package_version():
    raise RuntimeError("Release package.json version does not match the source package version.")

  forbidden_markers = [
    marker
    for marker in PACKAGE_JSON_RELEASE_FORBIDDEN_MARKERS
    if marker in package_json_text
  ]
  if forbidden_markers:
    raise RuntimeError(
      "Release package.json still exposes SteamOS-only helpers or markers: "
      + ", ".join(forbidden_markers)
      + "."
    )


def verify_release_plugin_json(zip_path: Path) -> None:
  with zipfile.ZipFile(zip_path) as archive:
    plugin_json_bytes = archive.read(f"{PLUGIN_ARCHIVE_ROOT}/plugin.json")

  plugin_json_text = plugin_json_bytes.decode("utf-8")
  plugin_data = json.loads(plugin_json_text)

  missing_fields = [
    field_name
    for field_name in PLUGIN_JSON_REQUIRED_FIELDS
    if not isinstance(plugin_data.get(field_name), str) or plugin_data[field_name].strip() == ""
  ]
  if missing_fields:
    raise RuntimeError(
      f"Release plugin.json is missing required string fields: {', '.join(missing_fields)}."
    )

  if plugin_data["version"].strip() != read_package_version():
    raise RuntimeError("Release plugin.json version does not match the source package version.")


def verify_release_install_diagnostic(zip_path: Path) -> None:
  diagnostic_archive_name = f"{PLUGIN_ARCHIVE_ROOT}/{INSTALL_DIAGNOSTIC_RELATIVE_PATH.as_posix()}"

  with zipfile.ZipFile(zip_path) as archive:
    install_diagnostic_text = archive.read(diagnostic_archive_name).decode("utf-8")
    dist_js_names = sorted(
      name
      for name in archive.namelist()
      if name.startswith(f"{PLUGIN_ARCHIVE_ROOT}/dist/") and name.endswith(".js")
    )
    dist_bundle_text_by_name = {
      name: archive.read(name).decode("utf-8", errors="ignore")
      for name in dist_js_names
    }

  active_frontend_bundle_names = [
    name for name in dist_js_names if Path(name).name.startswith("index")
  ]
  if not active_frontend_bundle_names:
    raise RuntimeError("Release artifact is missing active dist/index JavaScript bundle files.")

  if not any(
    "AchievementCompanionGamePageBadge" in dist_bundle_text_by_name[name]
    for name in active_frontend_bundle_names
  ):
    raise RuntimeError(
      "Release active frontend JavaScript bundle chain is missing the game-page badge marker."
    )

  missing_marker_lines = [
    marker
    for marker in REQUIRED_FRONTEND_MARKERS
    if marker not in install_diagnostic_text
  ]
  if missing_marker_lines:
    raise RuntimeError(
      "Release INSTALL_DIAGNOSTIC.txt is missing marker report lines for: "
      + ", ".join(missing_marker_lines)
      + "."
    )


def verify_release_dist_bundles(zip_path: Path) -> None:
  with zipfile.ZipFile(zip_path) as archive:
    dist_js_names = sorted(
      name
      for name in archive.namelist()
      if name.startswith(f"{PLUGIN_ARCHIVE_ROOT}/dist/") and name.endswith(".js")
    )
    dist_bundle_text_by_name = {
      name: archive.read(name).decode("utf-8", errors="ignore")
      for name in dist_js_names
    }

  if not dist_js_names:
    raise RuntimeError("Release artifact is missing packaged dist JavaScript bundle files.")

  for forbidden_marker in FORBIDDEN_FRONTEND_MARKERS:
    offending_bundles = [
      name for name, bundle_text in dist_bundle_text_by_name.items() if forbidden_marker in bundle_text
    ]
    if offending_bundles:
      raise RuntimeError(
        "Release packaged dist JavaScript still contains forbidden Decky runtime markers: "
        + f"{forbidden_marker} -> {', '.join(offending_bundles)}."
      )


def main(argv: list[str] | None = None) -> int:
  del argv
  zip_path = get_release_zip_path()
  if not zip_path.exists():
    raise RuntimeError(f"Release artifact does not exist: {zip_path}")

  verify_release_runtime_import_closure(zip_path)
  verify_release_zip_payload(zip_path)
  verify_release_package_json(zip_path)
  verify_release_plugin_json(zip_path)
  verify_release_install_diagnostic(zip_path)
  verify_release_dist_bundles(zip_path)
  print(zip_path)
  return 0


if __name__ == "__main__":
  raise SystemExit(main(sys.argv[1:]))
