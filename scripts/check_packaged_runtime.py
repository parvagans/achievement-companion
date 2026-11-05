"""Exercise the shipped Linux helper and backend outside the source checkout."""
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import zipfile


def check(zip_path: Path) -> None:
  source = Path(__file__).resolve().parents[1]
  with tempfile.TemporaryDirectory(prefix="ac-packaged-runtime-") as directory:
    root = Path(directory)
    with zipfile.ZipFile(zip_path) as archive:
      for member in archive.infolist():
        destination = (root / member.filename).resolve()
        if not destination.is_relative_to(root):
          raise RuntimeError("Archive member escapes the validation directory.")
        archive.extract(member, root)
        if not member.is_dir():
          destination.chmod((member.external_attr >> 16) & 0o777)
    plugin = root / "achievement-companion"
    helper = plugin / "bin" / "ac-rhash"
    assert helper.stat().st_mode & 0o777 == 0o755
    assert helper.read_bytes()[:6] == b"\x7fELF\x02\x01"
    shutil.copytree(source / "tests" / "native", root / "native-tests")
    subprocess.run([sys.executable, str(root / "native-tests" / "test_ra_hash.py"), str(helper)],
                   cwd=root, check=True)
    # -I excludes the checkout, PYTHONPATH and user-site packages. Only Decky's
    # host API is stubbed; all plugin modules are imported from the extracted ZIP.
    program = """
import importlib.util, logging, pathlib, sys, types
root = pathlib.Path(sys.argv[1])
decky = types.ModuleType('decky')
decky.DECKY_PLUGIN_SETTINGS_DIR = str(root.parent / 'settings')
decky.DECKY_PLUGIN_LOG_DIR = str(root.parent / 'logs')
decky.logger = logging.getLogger('packaged-runtime-check')
sys.modules['decky'] = decky
spec = importlib.util.spec_from_file_location('packaged_main', root / 'main.py')
module = importlib.util.module_from_spec(spec)
sys.modules[spec.name] = module
spec.loader.exec_module(module)
assert module._PLUGIN_DIR == root
assert callable(module.Plugin)
assert all(pathlib.Path(value.__file__).is_relative_to(root) for name, value in sys.modules.items()
           if name == 'backend' or name.startswith('backend.'))
print('Extracted backend imports passed without the source checkout.')
"""
    subprocess.run([sys.executable, "-I", "-c", program, str(plugin)], cwd=root, check=True)


if __name__ == "__main__":
  check(Path(sys.argv[1]).resolve())
