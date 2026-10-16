#include "compressed_iso_reader.h"

#include "lz4.h"
#include "miniz.h"

#include <limits.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#define AC_CISO_HEADER_SIZE 24U
#define AC_CISO_MAX_BLOCK_SIZE (16U * 1024U * 1024U)
#define AC_CISO_MAX_INDEX_BYTES (64U * 1024U * 1024U)
#define AC_CISO_INDEX_OFFSET_MASK UINT32_C(0x7fffffff)
#define AC_CISO_INDEX_PLAIN_FLAG UINT32_C(0x80000000)

typedef enum ac_compressed_iso_codec {
  AC_CISO_ZLIB,
  AC_CISO_LZ4
} ac_compressed_iso_codec;

typedef struct ac_compressed_iso_handle {
  FILE* file;
  uint32_t* index;
  uint8_t* input;
  uint8_t* output;
  uint64_t total_size;
  uint64_t position;
  uint64_t file_size;
  uint32_t block_size;
  uint32_t frame_count;
  uint32_t cached_frame;
  size_t input_capacity;
  unsigned align;
  ac_compressed_iso_codec codec;
} ac_compressed_iso_handle;

static int read_failed;

static uint32_t read_le32(const uint8_t* source) {
  return (uint32_t)source[0] |
    ((uint32_t)source[1] << 8) |
    ((uint32_t)source[2] << 16) |
    ((uint32_t)source[3] << 24);
}

static uint64_t read_le64(const uint8_t* source) {
  return (uint64_t)read_le32(source) | ((uint64_t)read_le32(source + 4) << 32);
}

static int file_seek(FILE* file, uint64_t offset) {
  if (offset > INT64_MAX)
    return 0;
  return fseeko64(file, (int64_t)offset, SEEK_SET) == 0;
}

static void compressed_iso_free(ac_compressed_iso_handle* handle) {
  if (handle == NULL)
    return;
  if (handle->file != NULL)
    fclose(handle->file);
  free(handle->index);
  free(handle->input);
  free(handle->output);
  free(handle);
}

static ac_compressed_iso_handle* compressed_iso_open_internal(const char* path) {
  ac_compressed_iso_handle* handle = NULL;
  uint8_t header[AC_CISO_HEADER_SIZE];
  uint64_t frame_count64;
  uint64_t index_bytes64;
  uint64_t data_start;
  uint64_t previous_offset = 0;
  size_t maximum_span = 0;
  uint32_t frame;

  handle = (ac_compressed_iso_handle*)calloc(1, sizeof(*handle));
  if (handle == NULL)
    return NULL;
  handle->cached_frame = UINT32_MAX;
  handle->file = fopen(path, "rb");
  if (handle->file == NULL)
    goto failed;
  if (fread(header, 1, sizeof(header), handle->file) != sizeof(header))
    goto failed;
  if (memcmp(header, "CISO", 4) == 0)
    handle->codec = AC_CISO_ZLIB;
  else if (memcmp(header, "ZISO", 4) == 0)
    handle->codec = AC_CISO_LZ4;
  else
    goto failed;

  handle->total_size = read_le64(header + 8);
  handle->block_size = read_le32(header + 16);
  handle->align = header[21];
  if (handle->total_size == 0 || handle->total_size > INT64_MAX ||
      handle->block_size < 2048 || handle->block_size > AC_CISO_MAX_BLOCK_SIZE ||
      header[20] > 1 || handle->align > 20)
    goto failed;

  if (fseeko64(handle->file, 0, SEEK_END) != 0)
    goto failed;
  {
    int64_t size = ftello64(handle->file);
    if (size < 0)
      goto failed;
    handle->file_size = (uint64_t)size;
  }

  frame_count64 = handle->total_size / handle->block_size;
  if (handle->total_size % handle->block_size != 0)
    ++frame_count64;
  if (frame_count64 == 0 || frame_count64 >= UINT32_MAX)
    goto failed;
  index_bytes64 = (frame_count64 + 1) * sizeof(uint32_t);
  if (index_bytes64 > AC_CISO_MAX_INDEX_BYTES ||
      index_bytes64 > handle->file_size - (handle->file_size >= AC_CISO_HEADER_SIZE ? AC_CISO_HEADER_SIZE : 0))
    goto failed;
  data_start = AC_CISO_HEADER_SIZE + index_bytes64;
  handle->frame_count = (uint32_t)frame_count64;
  handle->index = (uint32_t*)malloc((size_t)index_bytes64);
  if (handle->index == NULL || !file_seek(handle->file, AC_CISO_HEADER_SIZE))
    goto failed;
  for (frame = 0; frame <= handle->frame_count; ++frame) {
    uint8_t encoded[4];
    if (fread(encoded, 1, sizeof(encoded), handle->file) != sizeof(encoded))
      goto failed;
    handle->index[frame] = read_le32(encoded);
  }

  for (frame = 0; frame <= handle->frame_count; ++frame) {
    uint64_t offset = ((uint64_t)(handle->index[frame] & AC_CISO_INDEX_OFFSET_MASK)) << handle->align;
    if (offset < data_start || offset < previous_offset || offset > handle->file_size)
      goto failed;
    if (frame != 0) {
      uint64_t span = offset - previous_offset;
      uint64_t maximum_allowed = (uint64_t)handle->block_size + (UINT64_C(1) << handle->align) + 65536U;
      if (span > maximum_allowed || span > SIZE_MAX)
        goto failed;
      if ((size_t)span > maximum_span)
        maximum_span = (size_t)span;
    }
    previous_offset = offset;
  }
  if (maximum_span == 0)
    goto failed;

  handle->input_capacity = maximum_span;
  handle->input = (uint8_t*)malloc(handle->input_capacity);
  handle->output = (uint8_t*)malloc(handle->block_size);
  if (handle->input == NULL || handle->output == NULL)
    goto failed;
  return handle;

failed:
  compressed_iso_free(handle);
  return NULL;
}

static size_t frame_logical_size(const ac_compressed_iso_handle* handle, uint32_t frame) {
  uint64_t start = (uint64_t)frame * handle->block_size;
  uint64_t remaining = handle->total_size - start;
  return remaining < handle->block_size ? (size_t)remaining : handle->block_size;
}

static int load_frame(ac_compressed_iso_handle* handle, uint32_t frame) {
  uint32_t entry;
  uint64_t start;
  uint64_t end;
  size_t span;
  size_t output_size;

  if (frame >= handle->frame_count)
    return 0;
  if (handle->cached_frame == frame)
    return 1;
  entry = handle->index[frame];
  start = ((uint64_t)(entry & AC_CISO_INDEX_OFFSET_MASK)) << handle->align;
  end = ((uint64_t)(handle->index[frame + 1] & AC_CISO_INDEX_OFFSET_MASK)) << handle->align;
  span = (size_t)(end - start);
  output_size = frame_logical_size(handle, frame);
  if (!file_seek(handle->file, start))
    return 0;

  if ((entry & AC_CISO_INDEX_PLAIN_FLAG) != 0) {
    if (output_size > span || fread(handle->output, 1, output_size, handle->file) != output_size)
      return 0;
  } else {
    if (span == 0 || span > handle->input_capacity || fread(handle->input, 1, span, handle->file) != span)
      return 0;
    if (handle->codec == AC_CISO_LZ4) {
      int decoded = LZ4_decompress_safe_partial((const char*)handle->input, (char*)handle->output,
        (int)span, (int)output_size, (int)output_size);
      if (decoded != (int)output_size)
        return 0;
    } else {
      mz_stream stream;
      int status;
      memset(&stream, 0, sizeof(stream));
      stream.next_in = handle->input;
      stream.avail_in = (unsigned int)span;
      stream.next_out = handle->output;
      stream.avail_out = (unsigned int)output_size;
      if (mz_inflateInit2(&stream, -MZ_DEFAULT_WINDOW_BITS) != MZ_OK)
        return 0;
      status = mz_inflate(&stream, MZ_FINISH);
      mz_inflateEnd(&stream);
      if (status != MZ_STREAM_END || stream.total_out != output_size)
        return 0;
    }
  }
  handle->cached_frame = frame;
  return 1;
}

static void* compressed_iso_open(const char* path) {
  ac_compressed_iso_handle* handle = compressed_iso_open_internal(path);
  if (handle == NULL)
    read_failed = 1;
  return handle;
}

static void compressed_iso_seek(void* opaque, int64_t offset, int origin) {
  ac_compressed_iso_handle* handle = (ac_compressed_iso_handle*)opaque;
  uint64_t base;
  uint64_t target;
  if (origin == SEEK_SET)
    base = 0;
  else if (origin == SEEK_CUR)
    base = handle->position;
  else if (origin == SEEK_END)
    base = handle->total_size;
  else {
    read_failed = 1;
    return;
  }
  if (offset < 0) {
    uint64_t distance = (uint64_t)(-(offset + 1)) + 1;
    if (distance > base) {
      read_failed = 1;
      return;
    }
    target = base - distance;
  } else {
    if ((uint64_t)offset > UINT64_MAX - base) {
      read_failed = 1;
      return;
    }
    target = base + (uint64_t)offset;
  }
  handle->position = target;
}

static int64_t compressed_iso_tell(void* opaque) {
  ac_compressed_iso_handle* handle = (ac_compressed_iso_handle*)opaque;
  return handle->position <= INT64_MAX ? (int64_t)handle->position : -1;
}

static size_t compressed_iso_read(void* opaque, void* buffer, size_t requested) {
  ac_compressed_iso_handle* handle = (ac_compressed_iso_handle*)opaque;
  size_t total = 0;
  if (handle->position >= handle->total_size)
    return 0;
  if ((uint64_t)requested > handle->total_size - handle->position)
    requested = (size_t)(handle->total_size - handle->position);
  while (total < requested) {
    uint32_t frame = (uint32_t)(handle->position / handle->block_size);
    size_t within = (size_t)(handle->position % handle->block_size);
    size_t available = frame_logical_size(handle, frame) - within;
    size_t count = requested - total < available ? requested - total : available;
    if (!load_frame(handle, frame)) {
      read_failed = 1;
      break;
    }
    memcpy((uint8_t*)buffer + total, handle->output + within, count);
    handle->position += count;
    total += count;
  }
  return total;
}

static void compressed_iso_close(void* opaque) {
  compressed_iso_free((ac_compressed_iso_handle*)opaque);
}

ac_compressed_iso_probe_status ac_compressed_iso_configure(rc_hash_iterator_t* iterator, const char* path) {
  FILE* file;
  uint8_t magic[4];
  ac_compressed_iso_handle* probe;
  read_failed = 0;
  file = fopen(path, "rb");
  if (file == NULL)
    return AC_COMPRESSED_ISO_NOT_CONTAINER;
  if (fread(magic, 1, sizeof(magic), file) != sizeof(magic)) {
    fclose(file);
    return AC_COMPRESSED_ISO_NOT_CONTAINER;
  }
  fclose(file);
  if (memcmp(magic, "CISO", 4) != 0 && memcmp(magic, "ZISO", 4) != 0)
    return AC_COMPRESSED_ISO_NOT_CONTAINER;
  probe = compressed_iso_open_internal(path);
  if (probe == NULL)
    return AC_COMPRESSED_ISO_INVALID;
  compressed_iso_free(probe);
  iterator->callbacks.filereader.open = compressed_iso_open;
  iterator->callbacks.filereader.seek = compressed_iso_seek;
  iterator->callbacks.filereader.tell = compressed_iso_tell;
  iterator->callbacks.filereader.read = compressed_iso_read;
  iterator->callbacks.filereader.close = compressed_iso_close;
  return AC_COMPRESSED_ISO_READY;
}

int ac_compressed_iso_read_failed(void) {
  return read_failed;
}
