#include "media_reader.h"

#include "chd_reader.h"

#include "nod.h"

#include <ctype.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>

static int read_failed;

static int suffix_is(const char* path, const char* suffix) {
  const char* dot = strrchr(path, '.');
  if (dot == NULL) return 0;
  while (*dot && *suffix) {
    if (tolower((unsigned char)*dot++) != tolower((unsigned char)*suffix++)) return 0;
  }
  return *dot == '\0' && *suffix == '\0';
}

static void* media_open(const char* path) {
  NodHandle* disc = NULL;
  if (nod_disc_open(path, NULL, &disc) != NOD_RESULT_OK) {
    read_failed = 1;
    return NULL;
  }
  return disc;
}

static void media_seek(void* handle, int64_t offset, int origin) {
  if (nod_seek((NodHandle*)handle, offset, origin) < 0) read_failed = 1;
}

static int64_t media_tell(void* handle) {
  int64_t position = nod_seek((NodHandle*)handle, 0, 1);
  if (position < 0) read_failed = 1;
  return position;
}

static size_t media_read(void* handle, void* buffer, size_t requested) {
  size_t total = 0;
  while (total < requested) {
    int64_t count = nod_read((NodHandle*)handle, (uint8_t*)buffer + total, requested - total);
    if (count <= 0) {
      read_failed = 1;
      break;
    }
    total += (size_t)count;
  }
  return total;
}

static void media_close(void* handle) {
  nod_free((NodHandle*)handle);
}

ac_media_status ac_media_configure(rc_hash_iterator_t* iterator, const char* path, unsigned console_id) {
  ac_chd_probe_status chd_status;
  NodHandle* probe = NULL;
  read_failed = 0;
  chd_status = ac_chd_configure(iterator, path);
  if (chd_status == AC_CHD_READY)
    return AC_MEDIA_CHD;
  if (chd_status == AC_CHD_INVALID || suffix_is(path, ".chd"))
    return AC_MEDIA_INVALID_CONTAINER;
  if (console_id != RC_CONSOLE_GAMECUBE && console_id != RC_CONSOLE_WII)
    return AC_MEDIA_DIRECT;

  if (nod_disc_open(path, NULL, &probe) == NOD_RESULT_OK) {
    nod_free(probe);
    iterator->callbacks.filereader.open = media_open;
    iterator->callbacks.filereader.seek = media_seek;
    iterator->callbacks.filereader.tell = media_tell;
    iterator->callbacks.filereader.read = media_read;
    iterator->callbacks.filereader.close = media_close;
    return AC_MEDIA_NINTENDO_DISC;
  }

  if (suffix_is(path, ".rvz") || suffix_is(path, ".wia") ||
      suffix_is(path, ".gcz") || suffix_is(path, ".ciso") ||
      suffix_is(path, ".wbfs") || suffix_is(path, ".tgc"))
    return AC_MEDIA_INVALID_CONTAINER;
  return AC_MEDIA_DIRECT;
}

int ac_media_read_failed(void) {
  return read_failed || ac_chd_read_failed();
}
