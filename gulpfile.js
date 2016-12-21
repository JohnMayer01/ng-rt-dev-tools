/**
 gulp tasks for running eslint and mocha tests
 module maybe used both:
 1. as regular gulpfile.js in the root of the project; used by `gulp` CLI
 2. as a module exported `defineGulpTasks` method
 require('./gulpfile').defineGulpTasks();
 */
'use strict';
const path = require('path');

const defineGulpTasks = (gulp, options) => {
  const _ = require('lodash');
  const path = require('path');
  const zip = require('gulp-zip');
  const del = require('del');
  const eslint = require('gulp-eslint');
  const mocha = require('gulp-mocha');

  if (!gulp)
    gulp = require("gulp");

  options = _.extend({
    name: path.basename(path.dirname(module.parent.filename)),
    baseDir: path.dirname(module.parent.filename)
  }, options);

  // ESLint tasks

  gulp.task('lint', () => {
    return gulp.src([
      '**/*.js',
      '!**/*.min.js',
      '!node_modules/**',
      '!**/bower_components/**',
      '!**/public/**',
      '!plugins/**',
      '!docs/**',
      '!dist/**'
    ])
      .pipe(eslint({fix: true}))
      .pipe(eslint.format())
      .pipe(gulp.dest(function(file) {
        return file.base;
      }));
    // .pipe(eslint.failAfterError());
  });

  // Build tasks

  gulp.task('clean', () =>
    del(['dist'])
  );

  gulp.task('copy', ['clean'], () =>
    gulp.src(['api/**/*', 'server/**/*', 'config/**/*', '*.json', '*.md', '*.js'], {base: options.baseDir})
      .pipe(gulp.dest('dist'))
  );

  gulp.task('zip', ['copy'], () => {
    gulp.src('dist/**/*')
      .pipe(zip(options.name + '.zip'))
      .pipe(gulp.dest('dist'));
  });

  gulp.task('dist', ['clean', 'copy', 'zip']);

  // Mocha tasks

  global.appBase = path.resolve(__dirname, '../..');

  const serverOptions = {
    timeout: 15000 // 15 seconds
  };
  const uiOptions = {
    timeout: 30000 // 30 seconds
  };
  const testError = err => {
    console.error(err.message);
    console.error(err.stack);
    process.exit(1);
  };
  const testEnd = () => {
    process.exit();
  };

  const defineMochaTask = (taskName, src, options) => {
    gulp.task(taskName, [], () => {
      gulp.src(src)
        .pipe(mocha(options))
        .once('error', testError)
        .once('end', testEnd);
    });
  };

  defineMochaTask('test.server', 'test/server/**/*_test.js', serverOptions);
  defineMochaTask('test.ui', 'test/ui/**/*_test.js', uiOptions);
};

// if it's a regular gulp run from command line
if (require.main && require.main.filename.substr(require.main.filename.length - 7) === 'gulp.js') {
  // just define gulp tasks
  defineGulpTasks();
} else {
  // used as a module in another script
  module.exports = {
    defineGulpTasks: defineGulpTasks,
    eslintrcPath: path.resolve(__dirname, '.eslintrc.js')
  };
}
