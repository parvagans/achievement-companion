from __future__ import annotations

import os
import ssl
import tempfile
import types
import unittest
from pathlib import Path

import backend.tls as backend_tls


class BackendTlsTests(unittest.TestCase):
  def test_sanitize_backend_runtime_environment_removes_mei_polluted_ld_library_path(self) -> None:
    original_ld_library_path = os.environ.get("LD_LIBRARY_PATH")
    os.environ["LD_LIBRARY_PATH"] = "/tmp/_MEIabcdef:/usr/lib"
    try:
      backend_tls.sanitize_backend_runtime_environment()
      self.assertNotIn("LD_LIBRARY_PATH", os.environ)
    finally:
      if original_ld_library_path is None:
        os.environ.pop("LD_LIBRARY_PATH", None)
      else:
        os.environ["LD_LIBRARY_PATH"] = original_ld_library_path

  def test_select_backend_ca_source_prefers_existing_candidate(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      cafile = Path(temp_dir) / "custom-ca.pem"
      cafile.write_text("dummy ca file", encoding="utf-8")

      source, label = backend_tls.select_backend_ca_source((("custom-ca", cafile),))

      self.assertEqual(source, str(cafile))
      self.assertEqual(label, "custom-ca")

  def test_get_backend_http_ssl_context_uses_cafile_and_caches_source(self) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
      cafile = Path(temp_dir) / "custom-ca.pem"
      cafile.write_text("dummy ca file", encoding="utf-8")

      original_select_backend_ca_source = backend_tls.select_backend_ca_source
      backend_tls.select_backend_ca_source = lambda candidates=None: (str(cafile), "custom-ca")  # type: ignore[assignment]
      backend_tls._backend_http_ssl_context = None  # type: ignore[attr-defined]
      backend_tls._backend_http_ssl_context_source = None  # type: ignore[attr-defined]

      captured: dict[str, str | None] = {}
      original_create_default_context = ssl.create_default_context

      def fake_create_default_context(*, cafile: str | None = None, **kwargs):  # noqa: ANN001
        captured["cafile"] = cafile
        captured["kwargs"] = repr(kwargs)
        return types.SimpleNamespace(verify_mode=ssl.CERT_REQUIRED, check_hostname=True)

      ssl.create_default_context = fake_create_default_context  # type: ignore[assignment]
      try:
        context = backend_tls.get_backend_http_ssl_context()
      finally:
        ssl.create_default_context = original_create_default_context  # type: ignore[assignment]
        backend_tls.select_backend_ca_source = original_select_backend_ca_source  # type: ignore[assignment]

      self.assertEqual(captured["cafile"], str(cafile))
      self.assertEqual(backend_tls.get_backend_http_ssl_context_source(), "custom-ca")
      self.assertEqual(context.verify_mode, ssl.CERT_REQUIRED)
      self.assertTrue(context.check_hostname)


if __name__ == "__main__":
  unittest.main()
