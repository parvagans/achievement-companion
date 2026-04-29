from __future__ import annotations

import argparse
import importlib
import os
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping, Sequence, TextIO

from backend.paths import derive_steamos_xdg_env, resolve_steamos_backend_paths, resolve_steamos_xdg_root


_REPO_ROOT = Path(__file__).resolve().parents[1]
_BUILD_STEAMOS_COMMAND = "npm run build:steamos"
_START_STEAMOS_COMMAND = "npm run start:steamos"
_REPO_ROOT_MARKERS: tuple[Path, ...] = (
  Path("package.json"),
  Path("backend/dev_shell.py"),
  Path("rollup.steamos.config.js"),
)
_SCRATCH_DIR_PREFIX = ".tmp-steamos"
_DASHBOARD_CACHE_FILES = {
  "retroachievements": "retroachievements.json",
  "steam": "steam.json",
}
_IMPORT_CHECK_MODULES: tuple[str, ...] = (
  "backend.dev_shell",
  "backend.local_launcher",
  "backend.local_server",
  "backend.paths",
)


@dataclass(frozen=True)
class SteamOSDoctorCheck:
  status: str
  label: str
  detail: str


def _is_repo_root(path: Path) -> bool:
  return all((path / marker).exists() for marker in _REPO_ROOT_MARKERS)


def _format_boolean(value: bool) -> str:
  return "yes" if value else "no"


def _get_env_state(env: Mapping[str, str], key: str) -> str:
  raw_value = env.get(key)
  if raw_value is None or raw_value.strip() == "":
    return "fallback" if key != "XDG_RUNTIME_DIR" else "missing"
  return "set"


def _ensure_runtime_dir_ready(env: Mapping[str, str]) -> tuple[str, str]:
  raw_runtime_dir = env.get("XDG_RUNTIME_DIR")
  if raw_runtime_dir is None or raw_runtime_dir.strip() == "":
    return (
      "WARN",
      "XDG_RUNTIME_DIR missing; set it before starting the SteamOS shell so runtime metadata can be written safely.",
    )

  runtime_dir = Path(raw_runtime_dir.strip())
  try:
    runtime_dir.mkdir(parents=True, exist_ok=True)
  except OSError:
    return (
      "FAIL",
      "XDG_RUNTIME_DIR could not be prepared. Fix that directory before starting the SteamOS shell.",
    )

  return ("PASS", "XDG_RUNTIME_DIR is ready for runtime metadata.")


def collect_steamos_doctor_checks(
  *,
  env: Mapping[str, str] | None = None,
  home: Path | None = None,
  cwd: Path | None = None,
  repo_root: Path = _REPO_ROOT,
  xdg_root: str | Path | None = None,
) -> list[SteamOSDoctorCheck]:
  base_env = os.environ if env is None else env
  resolved_cwd = cwd if cwd is not None else Path.cwd()
  resolved_env = derive_steamos_xdg_env(env=base_env, xdg_root=xdg_root, cwd=resolved_cwd)
  resolved_paths = resolve_steamos_backend_paths(env=resolved_env, home=home)
  checks: list[SteamOSDoctorCheck] = []

  try:
    for module_name in _IMPORT_CHECK_MODULES:
      importlib.import_module(module_name)
    checks.append(SteamOSDoctorCheck("PASS", "Backend imports", "SteamOS backend modules imported successfully."))
  except Exception:
    checks.append(SteamOSDoctorCheck("FAIL", "Backend imports", "Python could not import the SteamOS backend modules."))

  checks.append(
    SteamOSDoctorCheck(
      "PASS" if _is_repo_root(resolved_cwd) else "WARN",
      "Working directory",
      "Current directory looks like the repo root."
      if _is_repo_root(resolved_cwd)
      else "Current directory does not look like the repo root. Run this command from the repository root for the cleanest validation.",
    ),
  )

  bootstrap_asset_path = repo_root / "dist-steamos" / "steamos-bootstrap.js"
  checks.append(
    SteamOSDoctorCheck(
      "PASS" if bootstrap_asset_path.is_file() else "FAIL",
      "SteamOS bootstrap asset",
      "dist-steamos/steamos-bootstrap.js is ready."
      if bootstrap_asset_path.is_file()
      else f"dist-steamos/steamos-bootstrap.js is missing. Run `{_BUILD_STEAMOS_COMMAND}` before launch.",
    ),
  )

  xdg_state_summary = (
    f"config={_get_env_state(resolved_env, 'XDG_CONFIG_HOME')} · "
    f"data={_get_env_state(resolved_env, 'XDG_DATA_HOME')} · "
    f"state={_get_env_state(resolved_env, 'XDG_STATE_HOME')} · "
    f"cache={_get_env_state(resolved_env, 'XDG_CACHE_HOME')} · "
    f"runtime={_get_env_state(resolved_env, 'XDG_RUNTIME_DIR')}"
  )
  checks.append(SteamOSDoctorCheck("INFO", "XDG environment", xdg_state_summary))

  if xdg_root is not None:
    resolved_xdg_root = resolve_steamos_xdg_root(xdg_root, cwd=resolved_cwd)
    try:
      relative_root = resolved_xdg_root.relative_to(repo_root)
      root_label = str(relative_root).replace("\\", "/")
    except ValueError:
      root_label = "custom"
    checks.append(
      SteamOSDoctorCheck(
        "INFO",
        "XDG temp root override",
        f"active ({root_label}) and takes precedence over existing XDG environment variables.",
      ),
    )

  runtime_dir_status, runtime_dir_detail = _ensure_runtime_dir_ready(resolved_env)
  checks.append(SteamOSDoctorCheck(runtime_dir_status, "Runtime metadata directory", runtime_dir_detail))

  checks.append(
    SteamOSDoctorCheck(
      "INFO",
      "Provider storage",
      "provider config file present: "
      f"{_format_boolean(resolved_paths.config_path.is_file())} · "
      "provider secrets file present: "
      f"{_format_boolean(resolved_paths.secrets_path.is_file())}",
    ),
  )

  checks.append(
    SteamOSDoctorCheck(
      "INFO",
      "Dashboard cache",
      "retroachievements cache present: "
      f"{_format_boolean((resolved_paths.dashboard_cache_dir / _DASHBOARD_CACHE_FILES['retroachievements']).is_file())} · "
      "steam cache present: "
      f"{_format_boolean((resolved_paths.dashboard_cache_dir / _DASHBOARD_CACHE_FILES['steam']).is_file())}",
    ),
  )

  scratch_dirs = [
    entry.name
    for entry in repo_root.iterdir()
    if entry.is_dir() and entry.name.startswith(_SCRATCH_DIR_PREFIX)
  ] if repo_root.exists() else []
  checks.append(
    SteamOSDoctorCheck(
      "INFO",
      "Scratch temp roots",
      f"{len(scratch_dirs)} repo-local `{_SCRATCH_DIR_PREFIX}*` folder(s) detected."
      if scratch_dirs
      else f"No repo-local `{_SCRATCH_DIR_PREFIX}*` folders detected.",
    ),
  )

  checks.append(
    SteamOSDoctorCheck(
      "INFO",
      "Release boundary",
      "The standalone SteamOS shell is not the Decky release ZIP.",
    ),
  )

  return checks


def render_steamos_doctor_report(
  checks: Sequence[SteamOSDoctorCheck],
  *,
  stdout: TextIO | None = None,
) -> None:
  output = stdout or sys.stdout
  print("Achievement Companion SteamOS doctor", file=output)
  print("", file=output)
  for check in checks:
    print(f"[{check.status}] {check.label}: {check.detail}", file=output)

  print("", file=output)
  print("Next steps:", file=output)
  print(f"- run `{_BUILD_STEAMOS_COMMAND}` if the SteamOS bootstrap asset is missing", file=output)
  print("- set XDG_RUNTIME_DIR and any optional XDG temp-root overrides before launch", file=output)
  print(f"- run `{_START_STEAMOS_COMMAND}` when the environment is ready", file=output)
  print("- do not paste provider-config/provider-secrets contents, API keys, or runtime tokens", file=output)


def run_steamos_doctor(
  *,
  env: Mapping[str, str] | None = None,
  home: Path | None = None,
  cwd: Path | None = None,
  repo_root: Path = _REPO_ROOT,
  xdg_root: str | Path | None = None,
  stdout: TextIO | None = None,
) -> int:
  checks = collect_steamos_doctor_checks(env=env, home=home, cwd=cwd, repo_root=repo_root, xdg_root=xdg_root)
  render_steamos_doctor_report(checks, stdout=stdout)
  return 1 if any(check.status == "FAIL" for check in checks) else 0


def _build_parser() -> argparse.ArgumentParser:
  parser = argparse.ArgumentParser(
    prog="python -m backend.steamos_doctor",
    description="Run a safe SteamOS standalone preflight check.",
  )
  parser.add_argument(
    "--xdg-root",
    default=None,
    help="Optional validation-only root used to derive XDG config/data/state/cache/runtime directories.",
  )
  return parser


def main(argv: Sequence[str] | None = None) -> int:
  parser = _build_parser()
  args = parser.parse_args(argv)
  try:
    return run_steamos_doctor(xdg_root=args.xdg_root, cwd=Path.cwd())
  except Exception as error:
    print(f"Unable to run SteamOS doctor: {error}", file=sys.stderr)
    return 1


if __name__ == "__main__":
  raise SystemExit(main(sys.argv[1:]))
