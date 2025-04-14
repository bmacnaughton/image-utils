#!/usr/bin/env node

// read sha256-collisions file
// sort by number of collisions?
// read file, compare buffers. if the same, then
//    have to decide which file(s) to keep/delete
//    get file stats for creation/modified date
//    check file name overlap - is one a super-set of the other?
//       e.g., file1.jpg and file1_1.jpg, file.jpg and file-1.jpg
//    also, newer version of file, like file-2.jpg and file-4.jpg
//    accept the "earliest" of those pairs.
//    also, does file creation time match directory that it is located in?
//
// not file overlap, but pattern matching for files in same directory
// file1.jpg, file2.jpg
// file1_1.jpg, file1_2.jpg
// file1-1.jpg, file1-2.jpg
// file-2.jpg, file-4.jpg
// file.jpg, file (1).jpg but not file (2).jpg, file (23).jpg
//
// if not same directories, just flag
//   is one a better match?


import fs from 'node:fs';
import path from 'node:path';
import {createInterface} from 'node:readline';

const fsp = fs.promises;

const fileName = process.argv[2] || 'sha256-collisions.txt';
if (!fileName) {
  console.error('Usage: node 1-process-hashes.mjs <file>');
  process.exit(1);
}

const file = fs.createReadStream(fileName, {encoding: 'utf8'});
const rl = createInterface({
  input: file,
  crlfDelay: Infinity
});

const re = /^([a-f0-9]{8,64}) (\d+) (.+)$/;

for await (const line of rl) {
  const m = line.match(re);
  if (!m) {
    console.error(`RE doesn't match for: ${line}`);
    continue;
  }
  const [, hash, n, fileList] = m;
  const files = fileList.split(',').map(file => file.startsWith('"') && file.endsWith('"') ? file.slice(1, -1) : file);
  if (files.length != n) {
    console.error(`file count doesn't match n: ${line}`);
    continue;
  }

  const statPromises = files.map(file => fsp.stat(file));
  const stats = await Promise.all(statPromises);

  const fileStats = new Map();
  for (let i = 0; i < files.length; i++) {
    fileStats.set(files[i], stats[i]);
  }

  findDeleteCandidates(files, fileStats);
  continue;
  //sortBy(files, fileStats);
  // files.sort((a, b) => {
  //   const aStat = fileStats.get(a);
  //   const bStat = fileStats.get(b);
  //   if (aStat.birthtimeMs < bStat.birthtimeMs) {
  //     return -1;
  //   } else if (aStat.birthtimeMs > bStat.birthtimeMs) {
  //     return 1;
  //   }
  //   return 0;
  // });
  console.log(`  ${files.join(', ')}`);
  console.log(`  ${files.map(file => fileStats.get(file).birthtime).join(', ')}`);



  // need fixed + variable parsing.
  // hash n file,file...
}

function findDeleteCandidates(files, fileStats) {
  const parsed = new Map();
  const dirs = new Set();
  let shortest = [undefined, Infinity];

  for (const file of files) {

    const p = path.parse(file);
    parsed.set(file, p);
    dirs.add(p.dir);

    if (p.name.length < shortest[1]) {
      // we don't need to worry about the extension at this point
      // because they are all jpg/jpeg.
      shortest[0] = p.name;
      shortest[1] = p.name.length;
    }
  }

  if (dirs.size === 1) {
    // files are all in same directory.
    console.log('[same directory]', dirs);
    console.log('  ', ...parsed.values().map(p => p.base), doPatternMatching(shortest, parsed));
  } else {
    // files are in different directories, so nothing is a candidate this first
    // pass at the code.
    console.log('[multiple directories]', dirs);
  }

}



function doPatternMatching(shortest, parsed) {
  const pats = {
    numberSuffix: /^(.+)[^_)-](\d{1,3})\.(jpg|JPG|jpeg|JPEG)$/,
    underscoreSuffix: /^(.+)(_\d{1,3})\.(jpg|JPG|jpeg|JPEG)$/,
    dashSuffix: /^(.+)(-\d{1,3})\.(jpg|JPG|jpeg|JPEG)$/,
    spaceSuffix: /^(.+)( \(\d{1,3}\))\.(jpg|JPG|jpeg|JPEG)$/,
  };
  // but pattern matching for files in same directory
  // file1.jpg, file2.jpg
  // file1_1.jpg, file1_2.jpg
  // file1-1.jpg, file1-2.jpg
  // file-2.jpg, file-4.jpg
  // file.jpg, file (1).jpg but not file (2).jpg, file (23).jpg
  let counts = {
    numberSuffix: 0,
    underscoreSuffix: 0,
    dashSuffix: 0,
    spaceSuffix: 0,
  };

  const extras = [];

  for (const file of parsed.values()) {
    if (file.name.length === shortest[1]) {
      // it is the shortest, so it's not a candidate. how to handle
      // google photos when multiple files can have the same name?
      // tbd.
      continue;
    }
    const extra = file.name.slice(shortest[1]);
    if (extra.length > 0) {
      extras.push(extra);
    }
    continue;
    // otherwise, it's a suffix candidate
    for (const [key, pat] of Object.entries(pats)) {

      const m = file.match(pat);
      if (m) {
        counts[key]++;
      }
    }
  }

  return extras; //counts;


  // const pat1 =/^(.+)(\d{1,3})?\.(jpg|JPG|jpeg|JPEG)$/;
  // const pat2 =/^(.+)(_\d{1,3})?\.(jpg|JPG|jpeg|JPEG)$/;
  // const pat3 =/^(.+)(-\d{1,3})?\.(jpg|JPG|jpeg|JPEG)$/;
  // const pat4 =/^(.+)( \(\d{1,3}\))?\.(jpg|JPG|jpeg|JPEG)$/;
  // const patterns = [pat1, pat2, pat3, pat4];

  // compare buffers of files? or should we just use the hash because the images
  // are the same? or verify that there wasn't a different-image hash collision?
  // for now, let's assume the images are the same if the hash is.
  if (file1 === file2) {
    // are they the same name but in different directories?
      // and the birthtime is the same?
      // might not want to delete, but flag.
    // same directory
      // check name patterns for candidates
  }

  if (file1 !== file2) {
    // image is the same but EXIF data varies?
  }

  if (parsed.length == 1) {
    return parsed;
  }

  let matches = [];
  for (const file of parsed) {
    const m = patterns.map(p => file.match(p)).filter(m => m);
    if (m.length > 0) {
      matches.push(m[0]);
    }
  }

}

//
// sorts the files by birthtime
//
// not really important unless the pattern matching has unexpected times
//
function sortBy(files, fileStats) {
  files.sort((a, b) => {
    const aStat = fileStats.get(a);
    const bStat = fileStats.get(b);
    if (aStat.birthtimeMs < bStat.birthtimeMs) {
      return -1;
    } else if (aStat.birthtimeMs > bStat.birthtimeMs) {
      return 1;
    }
    return 0;
  });
}
