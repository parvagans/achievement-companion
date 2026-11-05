import asyncio
import json
import subprocess
import sys
import tempfile
import unittest
import threading
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from unittest.mock import patch
from test_backend_runtime import load_main_module

class CredentialIntegrityTests(unittest.TestCase):
  def seed(self, directory):
    module = load_main_module(directory)
    asyncio.run(module.Plugin().save_retroachievements_credentials({"username":"Alice", "apiKey":"alice-key"}))
    asyncio.run(module.Plugin().save_steam_credentials({"steamId64":"76561198000000001", "apiKey":"steam-key"}))
    return module

  def test_failed_second_write_restores_pair_and_other_provider(self):
    with tempfile.TemporaryDirectory() as directory:
      module = self.seed(Path(directory))
      with patch.object(module, "_save_provider_config", side_effect=OSError("interrupted")):
        with self.assertRaises(OSError):
          asyncio.run(module.Plugin().save_retroachievements_credentials({"username":"Bob", "apiKey":"bob-key"}))
      restarted = load_main_module(Path(directory))
      view = asyncio.run(restarted.Plugin().get_provider_configs())
      self.assertEqual(view["retroAchievements"]["username"], "Alice")
      self.assertEqual(restarted._load_secret_api_key("retroAchievements"), "alice-key")
      self.assertEqual(restarted._load_secret_api_key("steam"), "steam-key")

  def test_abrupt_process_exit_recovers_before_any_credentials_are_exposed(self):
    with tempfile.TemporaryDirectory() as directory:
      module = self.seed(Path(directory))
      worker = """
import asyncio, os, sys
from pathlib import Path
from test_backend_runtime import load_main_module
module=load_main_module(Path(sys.argv[1]))
module._save_provider_config=lambda *args: os._exit(71)
asyncio.run(module.Plugin().save_steam_credentials({"steamId64":"76561198000000002","apiKey":"new-key"}))
"""
      result = subprocess.run([sys.executable,"-c",worker,directory],cwd=Path(__file__).parent, capture_output=True)
      self.assertEqual(result.returncode,71,result.stderr.decode())
      restarted=load_main_module(Path(directory))
      view=asyncio.run(restarted.Plugin().get_provider_configs())
      self.assertEqual(view["steam"]["steamId64"],"76561198000000001")
      self.assertEqual(restarted._load_secret_api_key("steam"),"steam-key")
      self.assertEqual(restarted._load_secret_api_key("retroAchievements"),"alice-key")

  def test_mutation_never_replaces_unreadable_or_unsupported_store(self):
    for filename in ("provider-config.json","provider-secrets.json"):
      for content in ('{"version":99}', "[]"):
        with self.subTest(filename=filename,content=content), tempfile.TemporaryDirectory() as directory:
          module=self.seed(Path(directory)); path=Path(directory)/filename
          path.write_text(content,encoding="utf8")
          with self.assertRaises((ValueError,OSError)):
            asyncio.run(module.Plugin().save_steam_credentials({"steamId64":"76561198000000002","apiKey":"new-key"}))
          self.assertEqual(path.read_text(encoding="utf8"),content)

  def test_transient_read_failure_and_interrupted_clear_preserve_both_stores(self):
    with tempfile.TemporaryDirectory() as directory:
      module=self.seed(Path(directory))
      before=[path.read_bytes() for path in (module.CONFIG_PATH,module.SECRETS_PATH)]
      original=Path.read_text
      def unreadable(path,*args,**kwargs):
        if path == module.CONFIG_PATH:
          raise PermissionError("temporarily unreadable")
        return original(path,*args,**kwargs)
      with patch.object(Path,"read_text",unreadable):
        with self.assertRaises(OSError):
          asyncio.run(module.Plugin().save_steam_credentials({"steamId64":"76561198000000002","apiKey":"new-key"}))
      with patch.object(module,"_clear_secret_api_key",side_effect=OSError("interrupted")):
        with self.assertRaises(OSError):
          asyncio.run(module.Plugin().clear_provider_credentials({"providerId":"steam"}))
      self.assertEqual([path.read_bytes() for path in (module.CONFIG_PATH,module.SECRETS_PATH)],before)

  def test_worker_reads_wait_for_the_complete_pair(self):
    with tempfile.TemporaryDirectory() as directory:
      module=self.seed(Path(directory))
      entered, release=threading.Event(),threading.Event()
      original=module._save_provider_config
      def held_write(*args):
        entered.set()
        if not release.wait(5): raise TimeoutError("test release")
        return original(*args)
      with patch.object(module,"_save_provider_config",held_write), ThreadPoolExecutor(2) as pool:
        saving=pool.submit(asyncio.run,module.Plugin().save_retroachievements_credentials({"username":"Bob","apiKey":"bob-key"}))
        self.assertTrue(entered.wait(5))
        reading=pool.submit(module._load_credentials,"retroAchievements")
        try:
          self.assertFalse(reading.done())
        finally:
          release.set()
        saving.result(timeout=5)
        config,secret=reading.result(timeout=5)
        self.assertEqual((config["username"],secret),("Bob","bob-key"))

if __name__ == "__main__":
  unittest.main()

