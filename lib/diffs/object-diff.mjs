/**
 * Compares two objects and returns the differences, or null if they're the same
 * @param {Object} original - Original form data
 * @param {Object} current - Current form data
 * @returns {Object|null} Object containing only the changed fields, or null if no changes
 */
function getObjectDiff(original, current) {
  const changes = {};

  for (const [key, value] of Object.entries(current)) {
    // Handle case where original doesn't have the key
    if (!(key in original)) {
      changes[key] = {
        oldValue: undefined,
        newValue: value
      };
      continue;
    }

    const originalValue = original[key];
    const currentValue = value;

    if (
      originalValue !== currentValue &&
      String(originalValue) !== String(currentValue) &&
      JSON.stringify(originalValue) !== JSON.stringify(currentValue)
    ) {
      changes[key] = {
        old: originalValue,
        new: currentValue
      };
    }
  }

  // Check for keys that exist in original but not in current
  for (const key of Object.keys(original)) {
    if (!(key in current)) {
      changes[key] = {
        old: original[key],
        new: undefined
      };
    }
  }

  // Return null if no changes were found
  return Object.keys(changes).length === 0 ? null : changes;
}

function deepObjectDiff(left, right) {
  if (left === right) return null;

  // Handle non-object types (including null)
  if (
    typeof left !== 'object' ||
    typeof right !== 'object' ||
    left === null ||
    right === null
  ) {
    return {
      oldValue: left,
      newValue: right
    };
  }

  // Handle arrays
  if (Array.isArray(left) && Array.isArray(right)) {
    if (left.length !== right.length) {
      return {
        oldValue: left,
        newValue: right
      };
    }

    const arrayDiffs = {};
    let hasChanges = false;

    for (let i = 0; i < left.length; i++) {
      const diff = deepObjectDiff(left[i], right[i]);
      if (diff !== null) {
        arrayDiffs[i] = diff;
        hasChanges = true;
      }
    }

    return hasChanges ? arrayDiffs : null;
  }

  const changes = {};
  let hasChanges = false;

  // Check for changes in current object
  for (const key of Object.keys(right)) {
    if (!(key in left)) {
      changes[key] = {
        oldValue: undefined,
        newValue: right[key]
      };
      hasChanges = true;
      continue;
    }

    const diff = deepObjectDiff(left[key], right[key]);
    if (diff !== null) {
      changes[key] = diff;
      hasChanges = true;
    }
  }

  // Check for deleted keys
  for (const key of Object.keys(left)) {
    if (!(key in right)) {
      changes[key] = {
        oldValue: left[key],
        newValue: undefined
      };
      hasChanges = true;
    }
  }

  return hasChanges ? changes : null;
}

function countUndefineds(left, right) {
  const counts = {left: 0, right: 0};
  _countUndefineds(left, right, counts);

  if (counts.left === 0 && counts.right === 0) {
    return null;
  }
  return counts;
}

function _countUndefineds(original, current, counts) {
  if (original === current) return;

  // Handle non-object types (including null)
  if (
    typeof original !== 'object' ||
    typeof current !== 'object' ||
    original === null ||
    current === null
  ) {
    if (original === undefined || original === null) {
      counts.right += 1;
    } else if (current === undefined || current === null) {
      counts.left += 1;
    }
    return;
  }

  // Handle arrays. this doesn't do element by element analysis - add if needed
  if (Array.isArray(original) && Array.isArray(current)) {
    if (original.length !== current.length) {
      // if the data has changed we can't know how it changed.
      if (original.length === 0) {
        counts.right += 1;
      } else if (current.length === 0) {
        counts.left += 1;
      }
      return;
    }

    // check each element for changes
    for (let i = 0; i < original.length; i++) {
      _countUndefineds(original[i], current[i], counts);
    }

    return;
  }

  // Check for deleted keys in original object
  for (const key of Object.keys(current)) {
    if (!(key in original)) {
      counts.left += 1;
      continue;
    }

    // key wasn't deleted, check for changes
    _countUndefineds(original[key], current[key], counts);
  }

  // Check for deleted keys in current object
  for (const key of Object.keys(original)) {
    if (!(key in current)) {
    counts.right += 1;
    }
  }

}

export {getObjectDiff, deepObjectDiff, countUndefineds};
