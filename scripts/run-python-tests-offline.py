"""Run backend tests with all non-loopback socket access denied in-process."""

from __future__ import annotations

import socket
import sys
import unittest
from pathlib import Path


_LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "::1"}
_original_getaddrinfo = socket.getaddrinfo
_original_connect = socket.socket.connect
_original_connect_ex = socket.socket.connect_ex
_original_sendto = socket.socket.sendto


def _is_loopback(address: object) -> bool:
  return isinstance(address, tuple) and bool(address) and str(address[0]).lower() in _LOOPBACK_HOSTS


def _guarded_getaddrinfo(host, *args, **kwargs):  # noqa: ANN001, ANN002, ANN003
  if host is not None and str(host).lower() not in _LOOPBACK_HOSTS:
    raise RuntimeError("Offline backend tests blocked external DNS resolution")
  return _original_getaddrinfo(host, *args, **kwargs)


def _guarded_connect(self, address):  # noqa: ANN001
  if not _is_loopback(address):
    raise RuntimeError("Offline backend tests blocked external socket connection")
  return _original_connect(self, address)


def _guarded_connect_ex(self, address):  # noqa: ANN001
  if not _is_loopback(address):
    raise RuntimeError("Offline backend tests blocked external socket connection")
  return _original_connect_ex(self, address)


def _guarded_sendto(self, data, *args):  # noqa: ANN001, ANN002
  if not args or not _is_loopback(args[-1]):
    raise RuntimeError("Offline backend tests blocked external datagram")
  return _original_sendto(self, data, *args)


socket.getaddrinfo = _guarded_getaddrinfo
socket.socket.connect = _guarded_connect
socket.socket.connect_ex = _guarded_connect_ex
socket.socket.sendto = _guarded_sendto

try:
  socket.getaddrinfo("example.invalid", 443)
except RuntimeError:
  pass
else:
  raise RuntimeError("Offline socket guard did not activate")

root = Path(__file__).resolve().parents[1]
suite = unittest.defaultTestLoader.discover(str(root / "tests" / "python"), pattern="test_*.py")
result = unittest.TextTestRunner(verbosity=2).run(suite)
sys.exit(0 if result.wasSuccessful() else 1)
