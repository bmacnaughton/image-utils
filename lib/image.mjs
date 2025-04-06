import fsp from 'node:fs/promises';

import ExifReader from 'exifreader';
import {findImageLengthAndOffset} from './find-image-data.mjs';

// class Image {...}
//   constructor(file, options)
//     option.imageOffset = -1
//     option.imageLength = -1
//       or
//     replace getImageOffsetAndLength with
//       getImageDataReader() - returns closure for reading
//   getExifData()
//   getImageOffsetAndLength()
//   readImageData(file, length, offset)
//   getImageHash()

// read an image file and find the tags and iamge data.
// possible optimizations:
// - find image only if requested.
// - defer reading tags and finding image until requested.
export default class Image {
  constructor(file, options) {
    this.file = file;
    this.options = options;
    this.imageOffset = -1;
    this.imageLength = -1;
    this.buf = undefined;
    this.readPromise = fsp.readFile(file)
      .then(buf => {
        this.buf = buf;
        return ExifReader.load(buf);
      })
      .then(tags => {
        this.tags = tags;
        const {imageOffset, imageLength} = findImageLengthAndOffset(this.buf);
        this.imageOffset = imageOffset;
        this.imageLength = imageLength;
      })
      .catch(err => {
        console.error(`Error reading ${file}: ${err}`);
        throw err;
      });
  }

  async getExifData() {
    await this.readPromise;
    return this.tags;
  }

  async getImageOffsetAndLength() {
    await this.readPromise;
    if (this.imageOffset === -1 || this.imageLength === -1) {
      throw new Error('Image data not found');
    }
    return {length: this.imageLength, offset: this.imageOffset};
  }

  async getImageBuffer() {
    await this.readPromise;
    if (this.imageOffset === -1 || this.imageLength === -1) {
      throw new Error('Image data not found');
    }
    return this.buf.subarray(this.imageOffset, this.imageOffset + this.imageLength);
  }
}


async function getHashes(file) {
  const buf = await fsp.readFile(file);
  const tags = await ExifReader.load(buf);

  if (tags.CreatorTool?.description.startsWith('Adobe')) {
    //
  }

  // let's start with just DateTimeOriginal and see how it works
  let hash = tags.DateTimeOriginal?.description || tags.CreateDate?.description;
  if (!hash) {
    hash = tags.DateTime?.description || 'default';
  }
  const details = hash === 'default' ? tags : extractDetails(tags);

  const hashes = {
    dateTime: hash,
  }

  // const thumb = details.Thumbnail?.image;

  // if (thumb?.byteLength) {
  //   hashes.imageBytes = thumb.byteLength;
  // } else {
  //   hashes.imageBytes = undefined;
  // }

  // move logic to store image-length table here. only if image-length is dup
  // do we execute she256 hash. so two-pass? not simple unless we keep data
  // around too. maybe store {file, startImage, endImage} in table so it can
  // easily be reread and a sha256 calculated when there are collisions?

  const image = findImageData(buf);
  if (image) {
    hashes.imageLength = image.length;
    hashes.imageBytes = image[0] << 24 | image[1] << 16 | image.at(-2) << 8 << image.at(-1) << 0;

    //hashes.imageXor = hashes.imageLength ^ hashes.imageBytes;
    const hash = createHash('sha256');
    hash.update(image);
    hashes.imageXor = hash.digest('hex');
  } else {
    hashes.imageLength = undefined;
    hashes.imageBytes = -1;
    hashes.imageXor = -1;
  }

  return {
    hashes,
    details: {file, ...details},
  };
}
