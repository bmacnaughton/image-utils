
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
