'use strict';
module.exports = {
  "extends": "google",
  "installedESLint": true,
  parserOptions: {
    sourceType: 'script',
  },
  rules: {
    camelcase: [2, {properties: "never"}],
    eqeqeq: [0],
    "strict": 2,
    "max-len": [1, {code: 120}]
  },
  env: {
    "node": true,
    "mocha": true,
    "chai": true
  }
};
