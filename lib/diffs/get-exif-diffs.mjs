
import Image from '../image.mjs';
import {getObjectDiff, deepObjectDiff} from './object-diff.mjs';
const [file1, file2] = process.argv.slice(2);



if (!file1 || !file2) {
  console.error('Usage: node get-exit-diffs.mjs <file1> <file2>');
  process.exit(1);
}

const image1 = new Image(file1);
const image2 = new Image(file2);

const exif1 = await image1.getExifData();
const exif2 = await image2.getExifData();

const diff = deepObjectDiff(exif1, exif2);

if (diff) {
  console.log('Differences found:', diff);
} else {
  console.log('No differences found');
}
