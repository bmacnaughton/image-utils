import fsp from 'node:fs/promises';
import path from 'node:path';

const defaultOptions = {
  returnDirs: false,  // return the directories
  returnAll: false,   // returns all items other than directories
};
//
// creates and async generator that returns all the filenames in the directory.
// full paths are returned and it recurses into directories.
//
export default async function* makeDirTreeReader(dir, options = {}) {
  const {returnDirs, returnAll} = Object.assign({}, defaultOptions, options);
  const dirents = await fsp.readdir(dir, {withFileTypes: true});

  for await (const dirent of dirents) {
    const fullpath = path.join(dirent.parentPath, dirent.name);
    if (dirent.isDirectory()) {
      if (returnDirs) {
         yield dirent;
      }
      const reader = makeDirTreeReader(fullpath);
      yield* await reader;
    } else if (returnAll || dirent.isFile()) {
      // consider making the previous line test user-defined
      yield fullpath;
    }
  }
}

