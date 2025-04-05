
export default function findImageData(buf) {
  let i = 0;
  while (i < buf.length - 1) {
    if (buf[i] === 0xFF && buf[i + 1] === 0xDA) {
      // Found SOS marker
      const imageDataStart = i + 2;
      // Find EOI marker
      let j = imageDataStart;
      while (j < buf.length - 1) {
        if (buf[j] === 0xFF && buf[j + 1] === 0xD9) {
          const imageDataEnd = j;
          const imageData = buf.subarray(imageDataStart, imageDataEnd);
          // Process imageData
          return imageData;
        }
        j++;
      }
      break;
    }
    i++;
  }
}

export function findImageData2(buf) {
  let i = 0;
  let imageStart;
  let imageEnd;
  // should this not look at last 4 bytes? SOS-EOI with nothing between
  // is no image data.
  while (i < buf.length - 2) {
    if (buf[i] === 0xFF && buf[i + 1] === 0xDA) {
      // found SOS marker
      imageStart = i + 2;
      break;
    }
    i += 1;
  }

  if (!imageStart) {
    return undefined;
  }

  i = imageStart;
  // typically the last two bytes of file - consider quick check first?
  while (i <= buf.length - 2) {
    if (buf[i] === 0xFF && buf[i + 1] === 0xD9) {
      // found EOI marker
      imageEnd = i
      return buf.subarray(imageStart, imageEnd);
    }
    i += 1;
  }

  return undefined;
}
