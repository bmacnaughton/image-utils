import {inspect} from 'node:util';

import {getObjectDiff, deepObjectDiff} from './object-diff.mjs';

// Test Cases
console.log("Test 1: Identical objects");
console.log(getObjectDiff(
  {name: "John", age: 30},
  {name: "John", age: 30}
));
// Output: null

console.log("Test 2: Different objects");
console.log(getObjectDiff(
  {name: "John", age: 30},
  {name: "Jane", age: 30}
));
// Output: { name: { oldValue: "John", newValue: "Jane" } }

console.log("Test 3: Nested objects");
const original = {
  name: "John",
  age: 30,
  address: {
    street: "123 Main St",
    city: "Boston"
  },
  hobbies: ["reading", {type: "sports", name: "basketball"}]
};

const current = {
  name: "John",
  age: 30,
  address: {
    street: "123 Main St",
    city: "New York"  // Changed city
  },
  hobbies: ["reading", {type: "sports", name: "football"}]  // Changed sport
};

console.log("Shallow comparison result:", getObjectDiff(original, current));
const shallowOutput = {
  address: {
    oldValue: {
      street: "123 Main St",
      city: "Boston"
    },
    newValue: {
      street: "123 Main St",
      city: "New York"
    }
  },
  hobbies: {
    oldValue: ["reading", { type: "sports", name: "basketball" }],
    newValue: ["reading", { type: "sports", name: "football" }]
  }
}

const diff = deepObjectDiff(original, current);
const diffText = inspect(diff, {colors: true, depth: Infinity});

console.log("Deep comparison result:", diffText);
// const deepOutput = {
//   address: {
//     city: {
//       oldValue: "Boston",
//       newValue: "New York"
//     }
//   },
//   hobbies: {
//     "1": {
//       name: {
//         oldValue: "basketball",
//         newValue: "football"
//       }
//     }
//   }
// }
