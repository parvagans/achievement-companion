#include "chd_reader.h"

#include "libchdr/chd.h"

#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define AC_CHD_MAGIC "MComprHD"
#define AC_CHD_MAGIC_SIZE 8
#define AC_CHD_CD_FRAME_SIZE 2448
#define AC_CHD_MAX_TRACKS 99

typedef enum ac_chd_track_type {
  AC_CHD_TRACK_MODE1,
  AC_CHD_TRACK_MODE1_RAW,
  AC_CHD_TRACK_MODE2,
  AC_CHD_TRACK_MODE2_FORM1,
  AC_CHD_TRACK_MODE2_FORM2,
  AC_CHD_TRACK_MODE2_FORM_MIX,
  AC_CHD_TRACK_MODE2_RAW,
  AC_CHD_TRACK_AUDIO
} ac_chd_track_type;

typedef struct ac_chd_track {
  uint32_t number;
  ac_chd_track_type type;
  uint32_t frames;
  uint32_t pregap;
  uint32_t postgap;
  uint32_t chd_frame;
  uint32_t first_sector;
  uint32_t data_frames;
  uint32_t data_offset;
  uint32_t data_size;
  int stored_pregap;
  int is_data;
} ac_chd_track;

typedef struct ac_chd_handle {
  chd_file* file;
  const chd_header* header;
  uint8_t* hunk;
  uint32_t cached_hunk;
  int has_cached_hunk;
  uint64_t position;
  ac_chd_track tracks[AC_CHD_MAX_TRACKS];
  uint32_t track_count;
  uint32_t selected_track;
  int is_cd;
} ac_chd_handle;

static int read_failed;

static int ac_chd_has_magic(const char* path) {
  char magic[AC_CHD_MAGIC_SIZE];
  FILE* input = fopen(path, "rb");
  size_t read;
  if (input == NULL)
    return 0;
  read = fread(magic, 1, sizeof(magic), input);
  fclose(input);
  return read == sizeof(magic) && memcmp(magic, AC_CHD_MAGIC, sizeof(magic)) == 0;
}

static int ac_chd_type(const char* value, ac_chd_track_type* type,
                       uint32_t* data_offset, uint32_t* data_size) {
  if (strcmp(value, "MODE1") == 0 || strcmp(value, "MODE1/2048") == 0) {
    *type = AC_CHD_TRACK_MODE1;
    *data_offset = 0;
    *data_size = 2048;
  }
  else if (strcmp(value, "MODE1_RAW") == 0 || strcmp(value, "MODE1/2352") == 0) {
    *type = AC_CHD_TRACK_MODE1_RAW;
    *data_offset = 16;
    *data_size = 2048;
  }
  else if (strcmp(value, "MODE2") == 0 || strcmp(value, "MODE2/2336") == 0 ||
           strcmp(value, "MODE2_FORM_MIX") == 0) {
    *type = strcmp(value, "MODE2_FORM_MIX") == 0 ? AC_CHD_TRACK_MODE2_FORM_MIX : AC_CHD_TRACK_MODE2;
    *data_offset = 8;
    *data_size = 2048;
  }
  else if (strcmp(value, "MODE2_FORM1") == 0 || strcmp(value, "MODE2/2048") == 0) {
    *type = AC_CHD_TRACK_MODE2_FORM1;
    *data_offset = 0;
    *data_size = 2048;
  }
  else if (strcmp(value, "MODE2_FORM2") == 0 || strcmp(value, "MODE2/2324") == 0) {
    *type = AC_CHD_TRACK_MODE2_FORM2;
    *data_offset = 0;
    *data_size = 2324;
  }
  else if (strcmp(value, "MODE2_RAW") == 0 || strcmp(value, "MODE2/2352") == 0 ||
           strcmp(value, "CDI/2352") == 0) {
    *type = AC_CHD_TRACK_MODE2_RAW;
    *data_offset = 24;
    *data_size = 2048;
  }
  else if (strcmp(value, "AUDIO") == 0 || strcmp(value, "CDG") == 0) {
    *type = AC_CHD_TRACK_AUDIO;
    *data_offset = 0;
    *data_size = 2352;
  }
  else {
    return 0;
  }
  return 1;
}

static int ac_chd_parse_track(chd_file* file, uint32_t index, ac_chd_track* track) {
  char metadata[256];
  char type[32] = "";
  char subtype[32] = "";
  char pgtype[32] = "";
  char pgsub[32] = "";
  uint32_t result_length = 0;
  int number = 0;
  int frames = 0;
  int pregap = 0;
  int postgap = 0;
  int pad = 0;
  int fields = 0;
  chd_error error;

  memset(metadata, 0, sizeof(metadata));
  error = chd_get_metadata(file, CDROM_TRACK_METADATA2_TAG, index, metadata,
    sizeof(metadata) - 1, &result_length, NULL, NULL);
  if (error == CHDERR_NONE) {
    metadata[result_length < sizeof(metadata) ? result_length : sizeof(metadata) - 1] = '\0';
    fields = sscanf(metadata,
      "TRACK:%d TYPE:%31s SUBTYPE:%31s FRAMES:%d PREGAP:%d PGTYPE:%31s PGSUB:%31s POSTGAP:%d",
      &number, type, subtype, &frames, &pregap, pgtype, pgsub, &postgap);
    if (fields != 8)
      return -1;
  }
  else {
    memset(metadata, 0, sizeof(metadata));
    error = chd_get_metadata(file, CDROM_TRACK_METADATA_TAG, index, metadata,
      sizeof(metadata) - 1, &result_length, NULL, NULL);
    if (error == CHDERR_NONE) {
      metadata[result_length < sizeof(metadata) ? result_length : sizeof(metadata) - 1] = '\0';
      fields = sscanf(metadata, "TRACK:%d TYPE:%31s SUBTYPE:%31s FRAMES:%d",
        &number, type, subtype, &frames);
      if (fields != 4)
        return -1;
    }
    else {
      memset(metadata, 0, sizeof(metadata));
      error = chd_get_metadata(file, GDROM_TRACK_METADATA_TAG, index, metadata,
        sizeof(metadata) - 1, &result_length, NULL, NULL);
      if (error == CHDERR_METADATA_NOT_FOUND)
        return 0;
      if (error != CHDERR_NONE)
        return -1;
      metadata[result_length < sizeof(metadata) ? result_length : sizeof(metadata) - 1] = '\0';
      fields = sscanf(metadata,
        "TRACK:%d TYPE:%31s SUBTYPE:%31s FRAMES:%d PAD:%d PREGAP:%d PGTYPE:%31s PGSUB:%31s POSTGAP:%d",
        &number, type, subtype, &frames, &pad, &pregap, pgtype, pgsub, &postgap);
      if (fields != 9)
        return -1;
    }
  }

  (void)subtype;
  (void)pgsub;
  (void)pad;
  if (number < 1 || number > AC_CHD_MAX_TRACKS || frames <= 0 || pregap < 0 || postgap < 0)
    return -1;
  memset(track, 0, sizeof(*track));
  track->number = (uint32_t)number;
  track->frames = (uint32_t)frames;
  track->pregap = (uint32_t)pregap;
  track->postgap = (uint32_t)postgap;
  track->stored_pregap = pgtype[0] == 'V';
  track->is_data = strcmp(type, "AUDIO") != 0 && strcmp(type, "CDG") != 0;
  if (!ac_chd_type(type, &track->type, &track->data_offset, &track->data_size))
    return -1;
  return 1;
}

static int ac_chd_build_tracks(ac_chd_handle* handle) {
  uint32_t index;
  uint32_t chd_offset = 0;
  uint32_t logical_offset = 0;
  int result;

  for (index = 0; index < AC_CHD_MAX_TRACKS; ++index) {
    ac_chd_track* track = &handle->tracks[index];
    result = ac_chd_parse_track(handle->file, index, track);
    if (result == 0)
      break;
    if (result < 0)
      return 0;

    if (!track->stored_pregap)
      logical_offset += track->pregap;
    track->chd_frame = chd_offset;
    track->first_sector = logical_offset + (track->stored_pregap ? track->pregap : 0);
    track->data_frames = track->frames > track->pregap ? track->frames - track->pregap : track->frames;
    chd_offset += (track->frames + 3U) & ~3U;
    logical_offset += track->frames + track->postgap;
    handle->track_count = index + 1;
  }
  return handle->track_count > 0;
}

static ac_chd_handle* ac_chd_open_handle(const char* path) {
  ac_chd_handle* handle = (ac_chd_handle*)calloc(1, sizeof(*handle));
  chd_error error;
  if (handle == NULL)
    return NULL;
  error = chd_open(path, CHD_OPEN_READ, NULL, &handle->file);
  if (error != CHDERR_NONE) {
    free(handle);
    return NULL;
  }
  handle->header = chd_get_header(handle->file);
  if (handle->header == NULL || handle->header->hunkbytes == 0 || handle->header->unitbytes == 0) {
    chd_close(handle->file);
    free(handle);
    return NULL;
  }
  handle->hunk = (uint8_t*)malloc(handle->header->hunkbytes);
  if (handle->hunk == NULL) {
    chd_close(handle->file);
    free(handle);
    return NULL;
  }

  if (handle->header->unitbytes == AC_CHD_CD_FRAME_SIZE) {
    handle->is_cd = 1;
    if (handle->header->hunkbytes % AC_CHD_CD_FRAME_SIZE != 0 || !ac_chd_build_tracks(handle)) {
      free(handle->hunk);
      chd_close(handle->file);
      free(handle);
      return NULL;
    }
  }
  else if (handle->header->unitbytes == 2048) {
    ac_chd_track* track = &handle->tracks[0];
    handle->track_count = 1;
    track->number = 1;
    track->type = AC_CHD_TRACK_MODE1;
    track->frames = (uint32_t)(handle->header->logicalbytes / 2048U);
    track->data_frames = track->frames;
    track->data_size = 2048;
    track->is_data = 1;
  }
  else {
    free(handle->hunk);
    chd_close(handle->file);
    free(handle);
    return NULL;
  }
  return handle;
}

static void ac_chd_close_handle(ac_chd_handle* handle) {
  if (handle == NULL)
    return;
  free(handle->hunk);
  chd_close(handle->file);
  free(handle);
}

static int ac_chd_read_hunk(ac_chd_handle* handle, uint32_t hunk) {
  if (handle->has_cached_hunk && handle->cached_hunk == hunk)
    return 1;
  if (chd_read(handle->file, hunk, handle->hunk) != CHDERR_NONE) {
    read_failed = 1;
    return 0;
  }
  handle->cached_hunk = hunk;
  handle->has_cached_hunk = 1;
  return 1;
}

static size_t ac_chd_read_bytes(ac_chd_handle* handle, uint64_t offset, void* output, size_t requested) {
  uint8_t* destination = (uint8_t*)output;
  size_t total = 0;
  while (requested > 0 && offset < handle->header->logicalbytes) {
    uint32_t hunk = (uint32_t)(offset / handle->header->hunkbytes);
    uint32_t within = (uint32_t)(offset % handle->header->hunkbytes);
    size_t available = handle->header->hunkbytes - within;
    size_t logical_available = (size_t)(handle->header->logicalbytes - offset);
    if (available > logical_available)
      available = logical_available;
    if (available > requested)
      available = requested;
    if (!ac_chd_read_hunk(handle, hunk))
      break;
    memcpy(destination + total, handle->hunk + within, available);
    offset += available;
    total += available;
    requested -= available;
  }
  return total;
}

static void* ac_chd_file_open(const char* path) {
  ac_chd_handle* handle = ac_chd_open_handle(path);
  if (handle == NULL)
    read_failed = 1;
  return handle;
}

static void ac_chd_file_seek(void* opaque, int64_t offset, int origin) {
  ac_chd_handle* handle = (ac_chd_handle*)opaque;
  uint64_t base;
  uint64_t magnitude;
  if (handle == NULL)
    return;
  if (origin == SEEK_SET)
    base = 0;
  else if (origin == SEEK_CUR)
    base = handle->position;
  else if (origin == SEEK_END)
    base = handle->header->logicalbytes;
  else {
    read_failed = 1;
    return;
  }
  if (offset < 0) {
    magnitude = (uint64_t)(-(offset + 1)) + 1U;
    if (magnitude > base) {
      read_failed = 1;
      return;
    }
    handle->position = base - magnitude;
  }
  else {
    if ((uint64_t)offset > UINT64_MAX - base) {
      read_failed = 1;
      return;
    }
    handle->position = base + (uint64_t)offset;
  }
}

static int64_t ac_chd_file_tell(void* opaque) {
  ac_chd_handle* handle = (ac_chd_handle*)opaque;
  return handle == NULL ? -1 : (int64_t)handle->position;
}

static size_t ac_chd_file_read(void* opaque, void* output, size_t requested) {
  ac_chd_handle* handle = (ac_chd_handle*)opaque;
  size_t result;
  if (handle == NULL)
    return 0;
  result = ac_chd_read_bytes(handle, handle->position, output, requested);
  handle->position += result;
  return result;
}

static void ac_chd_file_close(void* opaque) {
  ac_chd_close_handle((ac_chd_handle*)opaque);
}

static int ac_chd_select_track(ac_chd_handle* handle, uint32_t requested, uint32_t* selected) {
  uint32_t index;
  uint32_t best = 0;
  uint32_t best_frames = 0;

  if (requested == 0)
    requested = RC_HASH_CDTRACK_LARGEST;
  if (requested == RC_HASH_CDTRACK_LAST) {
    *selected = handle->track_count - 1;
    return 1;
  }
  if (requested == RC_HASH_CDTRACK_FIRST_DATA) {
    for (index = 0; index < handle->track_count; ++index) {
      if (handle->tracks[index].is_data) {
        *selected = index;
        return 1;
      }
    }
    return 0;
  }
  if (requested == RC_HASH_CDTRACK_LARGEST) {
    for (index = 0; index < handle->track_count; ++index) {
      if (handle->tracks[index].is_data && handle->tracks[index].data_frames > best_frames) {
        best = index;
        best_frames = handle->tracks[index].data_frames;
      }
    }
    if (best_frames == 0)
      return 0;
    *selected = best;
    return 1;
  }
  if (requested == RC_HASH_CDTRACK_FIRST_OF_SECOND_SESSION) {
    for (index = 1; index < handle->track_count; ++index) {
      if (handle->tracks[index - 1].type == AC_CHD_TRACK_AUDIO && handle->tracks[index].is_data) {
        *selected = index;
        return 1;
      }
    }
    return 0;
  }
  for (index = 0; index < handle->track_count; ++index) {
    if (handle->tracks[index].number == requested) {
      *selected = index;
      return 1;
    }
  }
  return 0;
}

static void* ac_chd_open_track(const char* path, uint32_t track, const rc_hash_iterator_t* iterator) {
  ac_chd_handle* handle = ac_chd_open_handle(path);
  (void)iterator;
  if (handle == NULL || !ac_chd_select_track(handle, track, &handle->selected_track)) {
    ac_chd_close_handle(handle);
    return NULL;
  }
  return handle;
}

static size_t ac_chd_read_sector(void* opaque, uint32_t sector, void* output, size_t requested) {
  ac_chd_handle* handle = (ac_chd_handle*)opaque;
  ac_chd_track* track;
  uint8_t* destination = (uint8_t*)output;
  uint32_t local_sector;
  size_t total = 0;
  if (handle == NULL || handle->selected_track >= handle->track_count)
    return 0;
  track = &handle->tracks[handle->selected_track];
  if (sector < track->first_sector)
    return 0;
  local_sector = sector - track->first_sector;
  while (requested > 0 && local_sector < track->data_frames) {
    uint64_t frame = track->chd_frame + local_sector + (track->stored_pregap ? track->pregap : 0);
    uint64_t offset = frame * handle->header->unitbytes + track->data_offset;
    size_t amount = requested < track->data_size ? requested : track->data_size;
    size_t actual = ac_chd_read_bytes(handle, offset, destination + total, amount);
    total += actual;
    requested -= actual;
    if (actual < amount)
      break;
    ++local_sector;
  }
  return total;
}

static void ac_chd_close_track(void* opaque) {
  ac_chd_close_handle((ac_chd_handle*)opaque);
}

static uint32_t ac_chd_first_track_sector(void* opaque) {
  ac_chd_handle* handle = (ac_chd_handle*)opaque;
  if (handle == NULL || handle->selected_track >= handle->track_count)
    return 0;
  return handle->tracks[handle->selected_track].first_sector;
}

ac_chd_probe_status ac_chd_configure(rc_hash_iterator_t* iterator, const char* path) {
  ac_chd_handle* probe;
  read_failed = 0;
  if (!ac_chd_has_magic(path))
    return AC_CHD_NOT_CHD;
  probe = ac_chd_open_handle(path);
  if (probe == NULL)
    return AC_CHD_INVALID;
  ac_chd_close_handle(probe);

  iterator->callbacks.filereader.open = ac_chd_file_open;
  iterator->callbacks.filereader.seek = ac_chd_file_seek;
  iterator->callbacks.filereader.tell = ac_chd_file_tell;
  iterator->callbacks.filereader.read = ac_chd_file_read;
  iterator->callbacks.filereader.close = ac_chd_file_close;
  iterator->callbacks.cdreader.open_track = NULL;
  iterator->callbacks.cdreader.read_sector = ac_chd_read_sector;
  iterator->callbacks.cdreader.close_track = ac_chd_close_track;
  iterator->callbacks.cdreader.first_track_sector = ac_chd_first_track_sector;
  iterator->callbacks.cdreader.open_track_iterator = ac_chd_open_track;
  return AC_CHD_READY;
}

int ac_chd_read_failed(void) {
  return read_failed;
}
