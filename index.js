#! /usr/bin/env node

/**
 * Main file for ng-rt platform development.
 * This nodejs module should be available globally or locally.
 */

'use strict';
const path = require('path');
module.exports = {
  defineGulpTasks: require('./gulp_tasks.js'),
  eslintrcPath: path.resolve(__dirname, '.eslintrc.js')
};
