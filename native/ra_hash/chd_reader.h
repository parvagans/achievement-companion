#ifndef AC_CHD_READER_H
#define AC_CHD_READER_H

#include "rc_hash.h"

typedef enum ac_chd_probe_status {
  AC_CHD_NOT_CHD,
  AC_CHD_READY,
  AC_CHD_INVALID
} ac_chd_probe_status;

/* Probe the file contents and, for a supported CHD, install random-access
 * file and CD callbacks on the iterator. */
ac_chd_probe_status ac_chd_configure(rc_hash_iterator_t* iterator, const char* path);
int ac_chd_read_failed(void);

#endif
