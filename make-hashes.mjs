
import fsp from 'node:fs/promises';
import path from 'node:path';
import ExifReader from 'exifreader';

import make, {dirTreeReader} from './async-dir-tree-reader.mjs';

const record = {
  randomFiles: [],
  hashCollisions: 0,
  hashCollisions2: 0,
};
const hashes = new Map();
const hashes2 = new Map();

// maybe use '/mnt/z/xiaoxin-bruce/pictures'?
let dirsToRead = ['.'];
if (process.argv.length > 2) {
  dirsToRead = process.argv.slice(2);
}

const filesByDir = {};

for (const dir of dirsToRead) {
  const fullpath = path.resolve(dir);

  filesByDir[fullpath] = (await dirTreeReader(dir))
    .map(relativePath => path.join(dir, relativePath));
}

const kMaxFiles = 1000;
let fileCount = 0;


for (const fullpath in filesByDir) {
  for (let i = 0; i < filesByDir[fullpath].length; i++) {
    const file = filesByDir[fullpath][i];
    // skip and don't count files that aren't jpeg
    if (!file.match(/(.jpg|.jpeg)$/i)) {
      // move the name to the randomFiles array.
      const items = filesByDir[fullpath].splice(i, 1);
      record.randomFiles.push(...items);
      // have to look at this index again after removing this item
      i -= 1;
      continue;
    }

    fileCount += 1;

    let newHash = false;
    let newHash2 = false;

    const {hash, details} = await getHash(file);
    if (!hashes[hash]) {
      hashes[hash] = [details];
      newHash = true;
    } else {
      record.hashCollisions += 1;
      hashes[hash].push(details);
    }

    const image = details.Thumbnail?.image;

    if (image?.byteLength) {
      if (!hashes2[image.byteLength]) {
        hashes2[image.byteLength] = [details];
        newHash2 = true;
      } else {
        record.hashCollisions2 += 1;
        hashes2[image.byteLength].push(details);
      }
    }

    // prevent it from taking forever until it's working as i want
    if (fileCount > kMaxFiles) {
      break;
    }
  }
  console.log(`found ${fileCount} jpg/jpeg files`);
  console.log(`found ${filesByDir[fullpath].length} jpegs in ${fullpath}`);
  record.randomFiles && console.log(`found ${record.randomFiles.length} random files`);
}

for (const hash in hashes) {
  if (hashes[hash].length > 1) {
    console.log(`hashes[${hash}] count = ${hashes[hash].length}`);
  }
}


for (const hash in hashes2) {
  if (hashes2[hash].length > 1) {
    console.log(`hashes2[${hash}] count = ${hashes2[hash].length}`);
  }
}

// let's get the dirs that have the defaults (because the fields we
// really want to use to hash are not present).

if (hashes.default) {
  const defaultDirs = new Set();
  for (const details of hashes.default) {
    const dir = details.file.split('/')[0];
    if (dir === 'bbq') {
      console.log(details)
    }
    defaultDirs.add(dir);
  }
  console.log('defaultDirs', defaultDirs);
} else {
  console.log('no default hashes');
}


/**
defaultDirs Set(12) {
  'puzzle',
  'hendrix-grave',
  'gsb',
  'bbq',
  'Wagon Wheel',
  'My Avatars',
  'Music',
  'Chloe-Birthday-Gift',
  '2018-11-21',
  '2018-01-18',
  '2016-10-14',
  '2016-10-13'
}
 */


//
// helpers
//
async function getHash(file) {
  const tags = await ExifReader.load(file);

  if (tags.CreatorTool?.description.startsWith('Adobe')) {
    //
  }

  // let's start with just DateTimeOriginal and see how it works
  let hash = tags.DateTimeOriginal?.description || tags.CreateDate?.description;
  if (!hash) {
    hash = tags.DateTime?.description || 'default';
  }
  const details = hash === 'default' ? tags : extractDetails(tags);
  return {
    hash,
    details: {file,  ...details},
  };
}

function extractDetails(tags) {
  return {
    // when adobe modifies a photo, it fiddles with standard tags
    DateTime: tags.DateTime,
    DateTimeOriginal: tags.DateTimeOriginal,
    DateTimeDigitized: tags.DateTimeDigitized,
    CreateDate: tags.createDate,
    //
    YCbCrPositioning: tags.YCbCrPositioning,
    ExposureTime: tags.ExposureTime,
    FNumber: tags.FNumber,
    ISOSpeedRatings: tags.ISOSpeedRatings,
    ExifVersion: tags.ExifVersion,
    Thumbnail: tags.Thumbnail,
  };
}

// now filesByDir should have only jpg files.

// const allDirs = await fsp.readdir('/mnt/z/xiaoxin-bruce/pictures');

// const spacedDirs = allDirs.filter(filename => filename.match(/^(\d{4}) (\d{2}) (\d{2})/));

// console.log('#allDirs', allDirs.length, 'spacedDirs', spacedDirs.length);
// let noConflicts = 0;
// let conflicts = 0;
// let totalRealConflicts = 0;
// let same = 0;
// let different = 0;
// let left = 0;
// let right = 0;

// for (const spacedDir of spacedDirs) {
//   const [, y, m, d, x] = spacedDir.match(/^(\d{4}) (\d{2}) (\d{2})(.*)/);

//   if (x) {
//     // there is a suffix - handle separately
//     continue;
//   }

//   const dashedDir = `${y}-${m}-${d}`;

//   // does the possible match exist?
//   if (allDirs.includes(dashedDir)) {
//     console.log('# DUPLICATED DATE directory', dashedDir);
//     conflicts += 1;
//   } else {
//     throw new Error('these should have been renamed by now');

//     console.log(spacedDir, '=>', dashedDir);
//     noConflicts += 1;

//     await fsp.rename(spacedDir, dashedDir);
//   }

//   const spacedFiles = await fsp.readdir(spacedDir);
//   const dashedFiles = await fsp.readdir(dashedDir);
//   console.log('#  spaced', spacedFiles.length, 'dashed', dashedFiles.length);

//   const nameConflicts = getNameConflicts(spacedFiles, dashedFiles);
//   if (!nameConflicts.length) {
//     // const msg = `found no-conflict dirs: ${spacedDir} <> ${dashedDir}`;
//     // throw new Error(msg);
//     // there are no conflicts, move all the files then delete the dir
//     if (spacedFiles.length) {
//       console.log(`mv -n "${spacedDir}"/* "${dashedDir}" # no conflicts, move all`);
//     }
//     console.log(`rmdir "${spacedDir}" # now delete empty dir`);
//     continue;
//   }
//   // let's clean up the no-conflict situations first. the !nameConflicts.length
//   // block has been executed, so the following line is commented out.
//   //continue;

//   let realConflicts = [];

//   for (const conflict of nameConflicts) {
//     const match = await findMatch(spacedDir, dashedDir, conflict);

//     if (conflict.endsWith('.MOV') || conflict.endsWith('.mov')) {
//       // there should be no MOV conflicts now because they've been resolved.
//       throw new Error('found a MOV file conflict!')
//       console.log('# checked', dashedDir, conflict, match);
//     } else {
//       // skip all but .MOV files - they're big and take a long time to diff.
//       //continue;
//     }

//     if (match === 'same') {
//       // nothing needs to be done except to delete the duplicate
//       console.log(`rm "${spacedDir}/${conflict}"  # same as in ${dashedDir}`);
//       same += 1;
//     } else if (match === 'different') {
//       // the timestamps match (somehow) but the files are different.
//       different += 1;
//       console.log(`# conflict: ${spacedDir}/${conflict} ${dashedDir}`);
//       realConflicts.push(conflict);
//     } else if (match === 'left') {
//       // need to move left to the right
//       console.log('MOVE LEFT TO RIGHT')
//       left += 1;
//     } else if (match === 'right') {
//       // dashedDir already has the correct file so don't copy, just delete.
//       console.log(`rm "${spacedDir}/${conflict}" # dashedDir matches creation time`);
//       right += 1;
//     } else {
//       throw new Error(`invalid match type ${match}`);
//     }
//   }

//   totalRealConflicts += realConflicts.length;

// }

// console.log('# total noConflicts', noConflicts, 'conflicts', conflicts, 'realConflicts', totalRealConflicts);
// console.log('# same', same, 'different', different, 'left', left, 'right', right);


// function getNameConflicts(a, b) {
//   let fewer;
//   let more;
//   if (a.length < b.length) {
//     fewer = a;
//     more = b;
//   } else {
//     fewer = b;
//     more = a;
//   }

//   const conflicts = [];

//   for (const first of fewer) {
//     if (more.includes(first)) {
//       conflicts.push(first);
//     }
//   }

//   return conflicts;
// }

// async function findMatch(spacedDir, dashedDir, filename) {
//   // check length first - can avoid diff...
//   let buf;
//   let leftPath = `${spacedDir}/${filename}`;
//   let rightPath = `${dashedDir}/${filename}`

//   const left = await fsp.stat(leftPath);
//   const right = await fsp.stat(rightPath);

//   try {
//     if (left.size === right.size) {
//       buf = cp.execSync(`diff "${leftPath}" "${rightPath}"`);
//       return 'same';
//     }
//   } catch (e) {
//     const text = e.stdout.toString();
//     if (!(text.startsWith('Binary files ') && text.endsWith(' differ\n'))) {
//       console.log(e.stdout.toString());
//     }
//   }


//   // if the modification times are the same then they're just different
//   if (left.mtime === right.mtime) {
//     return 'different';
//   }

//   // but if not, then we want to choose the creation time that matches the
//   // target directory (both dirs have same date; target is just the right
//   // format). if neither image matches the date, then there's more to be done.
//   //let date = left.mtime.toISOString().split('T')[0];
//   let date = toLocaleDate(left.mtime);
//   if (date === dashedDir) {
//     return 'left';
//   }
//   //date = right.mtime.toISOString().split('T')[0];
//   date = toLocaleDate(right.mtime);
//   if (date === dashedDir) {
//     return 'right';
//   }

//   // maybe the file was moved or copied but is really the original.
//   date = (await ExifReader.load(leftPath)).DateTime.description.split(' ')[0].replaceAll(':', '-');
//   if (date === dashedDir) {
//     return 'left';
//   }

//   date = (await ExifReader.load(rightPath)).DateTime.description.split(' ')[0].replaceAll(':', '-');
//   if (date === dashedDir) {
//     return 'right';
//   }


//   return 'different';
// }

// function toLocaleDate(date) {
//   // convert to m/d/yyyy where m/d can be one or two chars. use toLocale
//   // so it's not adjusted to UTC.
//   const localDateTime = date.toLocaleDateString();
//   const [m, d, yyyy] = localDateTime.split('/');
//   let mm = `0${m}`.slice(-2);
//   let dd = `0${d}`.slice(-2);
//   return `${yyyy}-${mm}-${dd}`;
// }


// can use to determine if the images are basically the same.
// await ER.load('/mnt/z/xiaoxin-bruce/pictures/2010-08-01/2010-08-01 08.57.20.jpg')
//
// create hashes of each file based on:
// DateTime (changes)
// DateTimeOriginal & DateTimeDigitized (seems more stable)
// ExposureTime
// FNumber
// ISO Speed
// ShutterSpeed
const exampleTags = {
  'Bits Per Sample': {value: 8, description: '8'},
  'Image Height': {value: 1920, description: '1920px'},
  'Image Width': {value: 2560, description: '2560px'},
  'Color Components': {value: 3, description: '3'},
  Subsampling: {
    value: [[Array], [Array], [Array]],
    description: 'YCbCr4:2:2 (2 1)'
  },
  Thumbnail: {
    Compression: {id: 259, value: 6, description: 6},
    Orientation: {id: 274, value: 1, description: 'top-left'},
    XResolution: {id: 282, value: [Array], description: '72'},
    YResolution: {id: 283, value: [Array], description: '72'},
    ResolutionUnit: {id: 296, value: 2, description: 'inches'},
    JPEGInterchangeFormat: {id: 513, value: 1260, description: 1260},
    JPEGInterchangeFormatLength: {id: 514, value: 9031, description: 9031},
    type: 'image/jpeg',
    image: ['ff d8 ff db 00 c5 00 02 01 02 02 02 01 02 02 02 02 03 03 02 03 04 07 04 04 03 03 04 08 06 06 05 07 0a 09 0a 0a 0a 09 0a 09 0b 0c 10 0e 0b 0c 0f 0c 09 0a 0e 13 0e 0f 11 11 12 12 12 0b 0d 14 15 14 11 15 10 12 12 11 01 03 03 03 04 03 04 08 04 04 08 11 0b 0a 0b 11 11 11 11 11 11 11 11 11 11 11 11 11 11', '... 8931 more bytes'] ,
    base64: ['Getter']
  },
  ImageDescription: {
    id: 270,
      value: ['SAMSUNG            '],
        description: 'SAMSUNG            '
  },
  Make: {
    id: 271,
      value: ['SAMSUNG            '],
        description: 'SAMSUNG            '
  },
  Model: {id: 272, value: ['SGH-I897'], description: 'SGH-I897'},
  Orientation: {id: 274, value: 1, description: 'top-left'},
  XResolution: {id: 282, value: [72, 1], description: '72'},
  YResolution: {id: 283, value: [72, 1], description: '72'},
  ResolutionUnit: {id: 296, value: 2, description: 'inches'},
  Software: {
    id: 305,
      value: ['fw 05.15 prm 07.54 '],
        description: 'fw 05.15 prm 07.54 '
  },
  DateTime: {
    id: 306,
    value: ['2010:08:01 08:57:19'],
    description: '2010:08:01 08:57:19'
  },
  YCbCrPositioning: {id: 531, value: 1, description: 'centered'},
  'Exif IFD Pointer': {id: 34665, value: 262, description: 262},
  'GPS Info IFD Pointer': {id: 34853, value: 978, description: 978},
  ExposureTime: {id: 33434, value: [1024, 251520], description: '1/246'},
  FNumber: {id: 33437, value: [2702, 1024], description: 'f/2.638671875'},
  ExposureProgram: {id: 34850, value: 2, description: 'Normal program'},
  ISOSpeedRatings: {id: 34855, value: 50, description: 50},
  ExifVersion: {id: 36864, value: [48, 50, 50, 48], description: '0220'},
  DateTimeOriginal: {
    id: 36867,
    value: ['2010:08:01 08:57:19'],
    description: '2010:08:01 08:57:19'
  },
  DateTimeDigitized: {
    id: 36868,
    value: ['2010:08:01 08:57:19'],
    description: '2010:08:01 08:57:19'
  },
  ComponentsConfiguration: {id: 37121, value: [1, 2, 3, 0], description: ''},
  ShutterSpeedValue: {id: 37377, value: [794, 100], description: '1/246'},
  ApertureValue: {id: 37378, value: [281, 100], description: '2.65'},
  BrightnessValue: {id: 37379, value: [685, 100], description: '6.85'},
  ExposureBiasValue: {id: 37380, value: [0, 100], description: '0'},
  MaxApertureValue: {id: 37381, value: [281, 100], description: '2.65'},
  MeteringMode: {id: 37383, value: 2, description: 'CenterWeightedAverage'},
  LightSource: {id: 37384, value: 0, description: 'Unknown'},
  Flash: {id: 37385, value: 32, description: 'No flash function'},
  FocalLength: {id: 37386, value: [379, 100], description: '3.79 mm'},
  MakerNote: {
    id: 37500,
    value: [
      5, 15, 7, 54, 65, 76, 65, 87, 66, 76, 79, 71,
      112, 0, 1, 213, 1, 0, 0, 0, 1, 0, 197, 118,
      1, 0, 56, 91, 2, 0, 201, 158, 254, 255, 254, 5,
      0, 0, 239, 175, 255, 255, 67, 171, 1, 0, 205, 164,
      255, 255, 49, 242, 255, 255, 39, 104, 255, 255, 168, 165,
      1, 0, 53, 84, 0, 0, 107, 87, 0, 0, 53, 84,
      0, 0, 107, 87, 0, 0, 1, 1, 18, 0, 157, 15,
      7, 0, 17, 25, 210, 113, 0, 0, 0, 0, 157, 15,
      7, 0, 0, 0,
      '... 102 more items'
    ],
    description: '[Raw maker note data]'
  },
  FlashpixVersion: {id: 40960, value: [48, 49, 48, 48], description: '0100'},
  ColorSpace: {id: 40961, value: 1, description: 'sRGB'},
  PixelXDimension: {id: 40962, value: 2560, description: 2560},
  PixelYDimension: {id: 40963, value: 1920, description: 1920},
  'Interoperability IFD Pointer': {id: 40965, value: 1124, description: 1124},
  SensingMethod: {id: 41495, value: 2, description: 'One-chip color area sensor'},
  SceneType: {id: 41729, value: 1, description: 'A directly photographed image'},
  ExposureMode: {id: 41986, value: 0, description: 'Auto exposure'},
  WhiteBalance: {id: 41987, value: 0, description: 'Auto white balance'},
  DigitalZoomRatio: {
    id: 41988,
      value: [0, 0],
        description: 'Digital zoom was not used'
  },
  FocalLengthIn35mmFilm: {id: 41989, value: 0, description: 'Unknown'},
  SceneCaptureType: {id: 41990, value: 0, description: 'Standard'},
  Contrast: {id: 41992, value: 0, description: 'Normal'},
  Saturation: {id: 41993, value: 0, description: 'Normal'},
  Sharpness: {id: 41994, value: 0, description: 'Normal'},
  GPSVersionID: {id: 0, value: [2, 2, 0, 0], description: 'Version 2.2'},
  GPSLatitudeRef: {id: 1, value: ['N'], description: 'North latitude'},
  GPSLatitude: {id: 2, value: [[Array], [Array], [Array]], description: 0},
  GPSLongitudeRef: {id: 3, value: ['E'], description: 'East longitude'},
  GPSLongitude: {id: 4, value: [[Array], [Array], [Array]], description: 0},
  GPSAltitudeRef: {id: 5, value: 0, description: 'Sea level'},
  GPSAltitude: {id: 6, value: [0, 100], description: '0 m'},
  InteroperabilityIndex: {id: 1, value: ['R98'], description: 'R98'},
  InteroperabilityVersion: {id: 2, value: [48, 49, 48, 48], description: '0100'},
  FileType: {value: 'jpeg', description: 'JPEG'}
}
