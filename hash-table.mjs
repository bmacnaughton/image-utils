import fsp from 'node:fs/promises';
import {createHash} from 'node:crypto';

import ExifReader from 'exifreader';

export default class HashTable {
  constructor() {
    this.hashes = new Map();
  }

  addHash(hash, metadata) {
    if (this.hashes.has(hash)) {
      this.hashes.get(hash).push(metadata);
    } else {
      this.hashes.set(hash, [metadata]);
    }
  }

  getHashEntries(hash) {
    return this.hashes.get(hash);
  }

  getHashesWithCollisions() {
    const hashesWithCollisions = [];
    for (const [hash, metadata] of this.hashes) {
      if (metadata.length > 1) {
        hashesWithCollisions.push({hash, metadata});
      }
    }
    return hashesWithCollisions;
  }

  summarize() {
    // get number of hashes
    // number of hashes with no collisions
    // number of hashes with collisions (metadata.length > 1)
    // total number of collisions (sum of metadata.length > 1)
    const numberOfHashes = this.hashes.size;
    let hashesWithCollisions = 0;
    let itemsWithHashCollisions = 0;
    for (const [hash, metadata] of this.hashes) {
      if (metadata.length > 1) {
        hashesWithCollisions += 1;
        itemsWithHashCollisions += metadata.length;
      }
    }

    return {
      numberOfHashes,
      hashesWithoutCollisions: numberOfHashes - hashesWithCollisions,
      hashesWithCollisions,
      totalHashCollisions: itemsWithHashCollisions,
    };
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
    details: {file,  ...details},
  };
}
