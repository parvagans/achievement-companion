#ifndef AC_MEDIA_READER_H
#define AC_MEDIA_READER_H

#include "rc_hash.h"

typedef enum ac_media_status {
  AC_MEDIA_DIRECT,
  AC_MEDIA_NINTENDO_DISC,
  AC_MEDIA_CHD,
  AC_MEDIA_INVALID_CONTAINER
} ac_media_status;

/* Select a reader by probing the media. Extensions only identify a failed
 * known container for diagnostics; nod validates the actual image format. */
ac_media_status ac_media_configure(rc_hash_iterator_t* iterator, const char* path, unsigned console_id);
int ac_media_read_failed(void);

#endif
