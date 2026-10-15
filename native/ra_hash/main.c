#include "rc_hash.h"
#include "media_reader.h"

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

int main(int argc, char** argv) {
  char* end;
  long console_id;
  const char* ext;
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
  ext = extension(argv[2]);
  if (ext_is(ext, "chd")) {
    report_media("unavailable", "chd-reader-not-implemented", "chd", "not-implemented");
    return 0;
  }
  if (ext_is(ext, "rar") || ext_is(ext, "m3u")) {
    report_media("unavailable", "container-reader-not-implemented",
      ext_is(ext, "rar") ? "rar" : "playlist", "not-implemented");
    return 0;
  }
  if (ext_is(ext, "cso") || ext_is(ext, "zso")) {
    report_media("unavailable", "compressed-iso-reader-not-implemented", "compressed-iso", "not-implemented");
    return 0;
  }
  if (ext_is(ext, "zip") || ext_is(ext, "7z")) {
    if (console_id != RC_CONSOLE_ARCADE && !(ext_is(ext, "zip") && console_id == RC_CONSOLE_MS_DOS)) {
      report_media("unavailable", "unsupported-archive-console", "archive", "not-implemented");
      return 0;
    }
  }

  file = fopen(argv[2], "rb");
  if (file == NULL) {
    report_media("error", "rom-unreadable", "direct", "unreadable");
    return 1;
  }
  if (fgetc(file) == EOF) {
    int read_error = ferror(file);
    report_media(read_error ? "error" : "unavailable", read_error ? "rom-unreadable" : "invalid-file",
      "direct", read_error ? "unreadable" : "invalid");
    fclose(file);
    return read_error ? 1 : 0;
  }
  fclose(file);

  rc_hash_initialize_iterator(&iterator, argv[2], NULL, 0);
  iterator.callbacks.error_message = on_hash_error;
  media_status = ac_media_configure(&iterator, argv[2], (unsigned)console_id);
  if (media_status == AC_MEDIA_INVALID_CONTAINER) {
    rc_hash_destroy_iterator(&iterator);
    report_media("unavailable", "container-reader-invalid", "nintendo-disc", "invalid");
    return 0;
  }
  generated = rc_hash_generate(hash, (uint32_t)console_id, &iterator);
  if (ac_media_read_failed()) {
    rc_hash_destroy_iterator(&iterator);
    report_media("error", "container-read-failed", "nintendo-disc", "read-failed");
    return 1;
  }
  rc_hash_destroy_iterator(&iterator);
  if (!generated) {
    report_media("unavailable", hash_error_reason,
      media_status == AC_MEDIA_NINTENDO_DISC ? "nintendo-disc" : "direct",
      media_status == AC_MEDIA_NINTENDO_DISC ? "ready" : "direct");
    return 0;
  }
  printf("{\"status\":\"resolved\",\"hash\":\"%s\",\"consoleId\":%ld,\"method\":\"rcheevos\",\"mediaReader\":\"%s\",\"mediaReaderStatus\":\"ready\"}\n",
    hash, console_id, media_status == AC_MEDIA_NINTENDO_DISC ? "nintendo-disc" : "direct");
  return 0;
}
