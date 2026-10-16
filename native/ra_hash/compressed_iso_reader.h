#ifndef AC_COMPRESSED_ISO_READER_H
#define AC_COMPRESSED_ISO_READER_H

#include "rc_hash.h"

typedef enum ac_compressed_iso_probe_status {
  AC_COMPRESSED_ISO_NOT_CONTAINER,
  AC_COMPRESSED_ISO_READY,
  AC_COMPRESSED_ISO_INVALID
} ac_compressed_iso_probe_status;

/* Probe CISO/ZISO by content and expose the decompressed ISO byte stream to
 * rcheevos without materializing a temporary image. */
ac_compressed_iso_probe_status ac_compressed_iso_configure(rc_hash_iterator_t* iterator, const char* path);
int ac_compressed_iso_read_failed(void);

#endif
