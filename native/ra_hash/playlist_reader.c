#include "playlist_reader.h"

#include <ctype.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define AC_PLAYLIST_MAX_LINE 65536

static int path_is_absolute(const char* path) {
  return path[0] == '/';
}

static char* join_playlist_path(const char* playlist_path, const char* entry) {
  const char* separator;
  size_t directory_length;
  size_t entry_length = strlen(entry);
  char* result;

  if (path_is_absolute(entry)) {
    result = (char*)malloc(entry_length + 1);
    if (result != NULL)
      memcpy(result, entry, entry_length + 1);
    return result;
  }

  separator = strrchr(playlist_path, '/');
  directory_length = separator == NULL ? 0 : (size_t)(separator - playlist_path + 1);
  if (directory_length > SIZE_MAX - entry_length - 1)
    return NULL;
  result = (char*)malloc(directory_length + entry_length + 1);
  if (result == NULL)
    return NULL;
  if (directory_length != 0)
    memcpy(result, playlist_path, directory_length);
  memcpy(result + directory_length, entry, entry_length + 1);
  return result;
}

ac_playlist_status ac_playlist_resolve(const char* playlist_path, char** resolved_path) {
  FILE* file;
  char* line;
  int first_line = 1;

  *resolved_path = NULL;
  file = fopen(playlist_path, "rb");
  if (file == NULL)
    return AC_PLAYLIST_UNREADABLE;
  line = (char*)malloc(AC_PLAYLIST_MAX_LINE + 2);
  if (line == NULL) {
    fclose(file);
    return AC_PLAYLIST_UNREADABLE;
  }

  while (fgets(line, AC_PLAYLIST_MAX_LINE + 2, file) != NULL) {
    char* start = line;
    char* end;
    size_t length = strlen(line);
    if (length > AC_PLAYLIST_MAX_LINE || (length != 0 && line[length - 1] != '\n' && !feof(file))) {
      free(line);
      fclose(file);
      return AC_PLAYLIST_INVALID;
    }
    if (first_line && length >= 3 &&
        (unsigned char)line[0] == 0xef && (unsigned char)line[1] == 0xbb && (unsigned char)line[2] == 0xbf)
      start += 3;
    first_line = 0;
    while (*start != '\0' && isspace((unsigned char)*start))
      ++start;
    end = start + strlen(start);
    while (end > start && isspace((unsigned char)end[-1]))
      --end;
    *end = '\0';
    if (*start == '\0' || *start == '#')
      continue;
    if (end - start >= 2 && start[0] == '"' && end[-1] == '"') {
      ++start;
      end[-1] = '\0';
    }
    if (*start == '\0')
      continue;
    *resolved_path = join_playlist_path(playlist_path, start);
    free(line);
    fclose(file);
    return *resolved_path == NULL ? AC_PLAYLIST_UNREADABLE : AC_PLAYLIST_READY;
  }

  free(line);
  if (ferror(file)) {
    fclose(file);
    return AC_PLAYLIST_UNREADABLE;
  }
  fclose(file);
  return AC_PLAYLIST_INVALID;
}
