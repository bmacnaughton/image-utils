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
  const fileBytes = files.map(file => fsp.readFile(file));
  const stats = await Promise.all(statPromises);
  const fileBuffers = await Promise.all(fileBytes);

  const fileStats = new Map();
  const fileBufs = new Map();
  for (let i = 0; i < files.length; i++) {
    fileStats.set(files[i], stats[i]);
    fileBufs.set(files[i], fileBuffers[i]);
  }


  // all files in this hash/line have the same image hash, so it is most likely
  // that they are the same image. do I need to verify that the images are the
  // same if the hashes are the same? I don't think so, but maybe a double
  // check is prudent.

  // in any case, put files with the same hash into multiple buckets:
  // 1. same file size - in theory can have different data, but these require
  // comparison of the buffers to determine if they are the same.
  // 1.5. if same file size but different EXIF data (unlikely) -
  // 2. diferent file size - need to compare image size and EXIF data (and maybe
  // image buffers) to determine if they are the same image. most likely it's
  // different EXIF data.

  // remove candidates that are not the same. they may become EXIF variants.
  // these could have the same image, but differ in EXIF data.
  const sizeBuckets = new Map();
  // these files are the same binary data (implicitly same length).
  const exactMatches = [];


  //
  // group files by size. if all the same then the an EXIF data change is most
  // likely (possibly image data if two diff images have the same hash).
  //
  for (const file of files) {
    let size = fileStats.get(file).size;
    let sizeBucket = sizeBuckets.get(size);
    if (!sizeBucket) {
      sizeBucket = [];
      sizeBuckets.set(size, sizeBucket);
    }
    sizeBucket.push(file);
  }

  // loop through each bucket? i don't think it matters that there might be
  // one or two or whatever.
  console.log(`(${sizeBuckets.size} different sizes):`);
  // show the files/lengths/birthtimes
  displayFileStats(fileStats);

  // if no delete candidates, check for BURST patterns?
  // how to ID - filename most likely, maybe EXIF BurstID and/or CameraBurstID
  // BurstPrimary?
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
      // because they are all jpg/jpeg. when handling .png, .raw, etc.
      // they will need to be filtered either here or before here.
      shortest[0] = p.name;
      shortest[1] = p.name.length;
    }
  }

  if (dirs.size > 1) {
    console.log('[multiple directories]', dirs);
    return;
  }
  const dir = dirs.values().next().value;

  // files are all in same directory.
  const nameDiffs = getNameExtensionDiffs(shortest, parsed);
  if (nameDiffs.length === 0) {
    console.log(`  => no delete candidates in ${dir}`);
    return;
  }

  console.log('  => same directory', dir);
  displayDeleteCandidates(nameDiffs, fileStats);
  //console.log('  ', ...parsed.values().map(p => p.base), extensions);


}

//
// find the portions of each name that is longer than the shortest name.
//
function getNameExtensionDiffs(shortest, parsed) {
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
      extras.push({file, extra});
    }
  }

  return extras; //counts;
}

// display the delete candidates.
//
// a file is a candidate if the extension part of the name (not the file
// extension but the part of the name that extends beyond the shortest name)
// matches one of the candidate patterns.
function displayDeleteCandidates(nameDiffs, fileStats) {
  const pats = [
    /^-\d{1,3}$/,
    /^_\d{1,3}$/,
    /^ \(\d{1,3}\)$/,
    /^\d{1,2}$/,
  ];
  for (const pat of pats) {
    const matches = nameDiffs.filter(e => e.extra.match(pat));
    if (matches.length > 0) {
      console.log(`  => delete candidates:`, matches.map(m => m.file.base));
    }
  }
}

function displayFileStats(fileStats) {
  for (const [file, stat] of fileStats.entries()) {
    const date = new Date(stat.birthtimeMs).toISOString();
    console.log(`  ${file}: ${stat.size} bytes ${date}`);
  }
}

/**
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
 */




  // const pat1 =/^(.+)(\d{1,3})?\.(jpg|JPG|jpeg|JPEG)$/;
  // const pat2 =/^(.+)(_\d{1,3})?\.(jpg|JPG|jpeg|JPEG)$/;
  // const pat3 =/^(.+)(-\d{1,3})?\.(jpg|JPG|jpeg|JPEG)$/;
  // const pat4 =/^(.+)( \(\d{1,3}\))?\.(jpg|JPG|jpeg|JPEG)$/;
  // const patterns = [pat1, pat2, pat3, pat4];

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
