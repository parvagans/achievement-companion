#ifndef AC_PLAYLIST_READER_H
#define AC_PLAYLIST_READER_H

typedef enum ac_playlist_status {
  AC_PLAYLIST_READY,
  AC_PLAYLIST_INVALID,
  AC_PLAYLIST_UNREADABLE
} ac_playlist_status;

/* Resolve the first playable entry using the same first-disc policy as
 * rcheevos. The caller owns *resolved_path when AC_PLAYLIST_READY is returned. */
ac_playlist_status ac_playlist_resolve(const char* playlist_path, char** resolved_path);

#endif
