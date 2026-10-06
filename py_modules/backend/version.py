from __future__ import annotations

import json
import os
from pathlib import Path


def get_application_version(plugin_dir: Path) -> str:
  decky_version = os.environ.get("DECKY_PLUGIN_VERSION", "").strip()
  if decky_version:
    return decky_version

  package_path = plugin_dir / "package.json"
  try:
    package_data = json.loads(package_path.read_text(encoding="utf-8"))
    package_version = package_data.get("version")
    if isinstance(package_version, str) and package_version.strip():
      return package_version.strip()
  except (OSError, ValueError, TypeError):
    pass

  properties_path = plugin_dir / "version.properties"
  try:
    for line in properties_path.read_text(encoding="utf-8").splitlines():
      if line.strip().startswith("version="):
        version = line.split("=", 1)[1].strip()
        if version:
          return version
  except OSError:
    pass

  return "0.0.0-dev"
