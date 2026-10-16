#include "rc_hash.h"
#include "media_reader.h"
#include "playlist_reader.h"

#include <ctype.h>
#include <errno.h>
#include <limits.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

static const char* hash_error_reason = "hash-failed";

static void report(const char* status, const char* reason) {
  printf("{\"status\":\"%s\",\"reason\":\"%s\"}\n", status, reason);
}

static void report_media(const char* status, const char* reason, const char* reader, const char* reader_status) {
  printf("{\"status\":\"%s\",\"reason\":\"%s\",\"mediaReader\":\"%s\",\"mediaReaderStatus\":\"%s\"}\n",
    status, reason, reader, reader_status);
}

static void on_hash_error(const char* message, const rc_hash_iterator_t* iterator) {
  (void)iterator;
  if (message != NULL) {
    if (strstr(message, "Unsupported console") != NULL)
      hash_error_reason = "unsupported-console";
    else if (strstr(message, "Could not open") != NULL)
      hash_error_reason = "rom-unreadable";
    else if (strstr(message, "Not a valid") != NULL || strstr(message, "Not a ") != NULL ||
             strstr(message, "No partitions found") != NULL || strstr(message, "Failed to read") != NULL)
      hash_error_reason = "invalid-file";
    fprintf(stderr, "rcheevos: %s\n", message);
  }
}

static const char* extension(const char* path) {
  const char* basename = strrchr(path, '/');
  const char* dot;
  basename = basename == NULL ? path : basename + 1;
  dot = strrchr(basename, '.');
  return dot == NULL ? "" : dot + 1;
}

static int ext_is(const char* actual, const char* expected) {
  while (*actual != '\0' && *expected != '\0') {
    if (tolower((unsigned char)*actual++) != tolower((unsigned char)*expected++))
      return 0;
  }
  return *actual == '\0' && *expected == '\0';
}

static const char* media_reader_name(ac_media_status status, int playlist, const char* ext) {
  if (playlist)
    return "playlist";
  if (status == AC_MEDIA_NINTENDO_DISC)
    return "nintendo-disc";
  if (status == AC_MEDIA_CHD)
    return "chd";
  if (status == AC_MEDIA_COMPRESSED_ISO)
    return "compressed-iso";
  if (ext_is(ext, "chd"))
    return "chd";
  if (ext_is(ext, "cso") || ext_is(ext, "zso"))
    return "compressed-iso";
  if (ext_is(ext, "rvz") || ext_is(ext, "wia") || ext_is(ext, "gcz") ||
      ext_is(ext, "wbfs") || ext_is(ext, "tgc"))
    return "nintendo-disc";
  return "direct";
}

int main(int argc, char** argv) {
  char* end;
  long console_id;
  const char* ext;
  const char* path;
  char* playlist_entry = NULL;
  int playlist = 0;
  char hash[33] = {0};
  rc_hash_iterator_t iterator;
  FILE* file;
  int generated;
  ac_media_status media_status;

  if (argc != 3) {
    report("error", "invalid-arguments");
    return 2;
  }
  errno = 0;
  console_id = strtol(argv[1], &end, 10);
  if (errno != 0 || *end != '\0' || console_id < 1 || console_id > 65535) {
    report("error", "invalid-console-id");
    return 2;
  }
  path = argv[2];
  ext = extension(path);
  if (ext_is(ext, "rar")) {
    report_media("unavailable", "container-reader-not-implemented", "rar", "not-implemented");
    return 0;
  }
  if (ext_is(ext, "m3u")) {
    ac_playlist_status playlist_status = ac_playlist_resolve(path, &playlist_entry);
    playlist = 1;
    if (playlist_status != AC_PLAYLIST_READY) {
      report_media(playlist_status == AC_PLAYLIST_UNREADABLE ? "error" : "unavailable",
        playlist_status == AC_PLAYLIST_UNREADABLE ? "rom-unreadable" : "playlist-invalid",
        "playlist", playlist_status == AC_PLAYLIST_UNREADABLE ? "unreadable" : "invalid");
      return playlist_status == AC_PLAYLIST_UNREADABLE ? 1 : 0;
    }
    path = playlist_entry;
    ext = extension(path);
    if (ext_is(ext, "m3u")) {
      free(playlist_entry);
      report_media("unavailable", "playlist-invalid", "playlist", "invalid");
      return 0;
    }
    if (ext_is(ext, "rar")) {
      free(playlist_entry);
      report_media("unavailable", "container-reader-not-implemented", "playlist", "not-implemented");
      return 0;
    }
  }
  if (ext_is(ext, "zip") || ext_is(ext, "7z")) {
    if (console_id != RC_CONSOLE_ARCADE && !(ext_is(ext, "zip") && console_id == RC_CONSOLE_MS_DOS)) {
      report_media("unavailable", "unsupported-archive-console", playlist ? "playlist" : "archive", "not-implemented");
      free(playlist_entry);
      return 0;
    }
  }

  file = fopen(path, "rb");
  if (file == NULL) {
    report_media("error", "rom-unreadable", playlist ? "playlist" : "direct", "unreadable");
    free(playlist_entry);
    return 1;
  }
  if (fgetc(file) == EOF) {
    int read_error = ferror(file);
    report_media(read_error ? "error" : "unavailable", read_error ? "rom-unreadable" : "invalid-file",
      playlist ? "playlist" : "direct", read_error ? "unreadable" : "invalid");
    fclose(file);
    free(playlist_entry);
    return read_error ? 1 : 0;
  }
  fclose(file);

  rc_hash_initialize_iterator(&iterator, path, NULL, 0);
  iterator.callbacks.error_message = on_hash_error;
  media_status = ac_media_configure(&iterator, path, (unsigned)console_id);
  if (media_status == AC_MEDIA_INVALID_CONTAINER) {
    rc_hash_destroy_iterator(&iterator);
    report_media("unavailable", "container-reader-invalid", media_reader_name(media_status, playlist, ext), "invalid");
    free(playlist_entry);
    return 0;
  }
  generated = rc_hash_generate(hash, (uint32_t)console_id, &iterator);
  if (ac_media_read_failed()) {
    rc_hash_destroy_iterator(&iterator);
    report_media("error", "container-read-failed", media_reader_name(media_status, playlist, ext), "read-failed");
    free(playlist_entry);
    return 1;
  }
  rc_hash_destroy_iterator(&iterator);
  if (!generated) {
    report_media("unavailable", hash_error_reason,
      media_reader_name(media_status, playlist, ext),
      media_status == AC_MEDIA_DIRECT ? "direct" : "ready");
    free(playlist_entry);
    return 0;
  }
  printf("{\"status\":\"resolved\",\"hash\":\"%s\",\"consoleId\":%ld,\"method\":\"rcheevos\",\"mediaReader\":\"%s\",\"mediaReaderStatus\":\"ready\"}\n",
    hash, console_id, media_reader_name(media_status, playlist, ext));
  free(playlist_entry);
  return 0;
}
