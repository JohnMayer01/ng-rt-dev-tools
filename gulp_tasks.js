/**
 * Common gulp tasks for
 *  + build
 *    - browserify shared code for client side (UI)
 *    - build pure client code
 *    - distribution package build
 *  + run mocha tests
 *  + run eslint
 */
'use strict';
const path = require('path');
const fs = require('fs');
const _ = require('lodash');

module.exports = (gulp, options) => {
  const zip = require('gulp-zip');
  const del = require('del');

  if (!gulp)
    gulp = require("gulp");

  options = _.extend({
    name: path.basename(path.dirname(module.parent.parent.filename)),
    baseDir: path.dirname(module.parent.parent.filename),
    browserify: {},
    vulcanize: {}
  }, options);

  const sharedDir = path.join(options.baseDir, 'shared');
  const clientDir = path.join(options.baseDir, 'client');
  const clientPublicDir = path.join(clientDir, 'public');


  // Browserify shared (server & UI) code

  const sourcemaps = require('gulp-sourcemaps');
  const source = require('vinyl-source-stream');
  const buffer = require('vinyl-buffer');
  const browserify = require('browserify');
  const babel = require('babelify');

  gulp.task('buildShared', function () {
    const indexPath = path.join(sharedDir, 'index.js');
    if (!fs.existsSync(indexPath))
      return;
    browserify(indexPath, {
      debug: true,
      noParse: options.browserify.noParse || []
    })
      .transform(babel, {presets: ["es2015"]})
      .bundle()
      .pipe(source('build.js'))
      .pipe(buffer())
      .pipe(sourcemaps.init({loadMaps: true}))
      .pipe(sourcemaps.write('./'))
      .pipe(gulp.dest(clientPublicDir));
  });


  // Build client code (UI)

  const vulcanize = require('gulp-vulcanize');
  const bower = require('gulp-bower');
  const less = require('gulp-less');
  const concat = require('gulp-concat');
  const cleanCSS = require('gulp-clean-css');
  const rename = require('gulp-rename');

  gulp.task('cleanClient', () =>
    del([clientPublicDir])
  );

  gulp.task('copyRes', function() {
    gulp.src(clientDir + '/res/**/*')
      .pipe(gulp.dest(path.join(clientDir, 'public/res')));
  });

  gulp.task('bower', function() {
    if (!fs.existsSync(path.join(clientDir, 'bower.json')))
      return;
    return bower({cwd: clientDir});
  });

  gulp.task('less', function() {
    gulp.src(clientDir + '/styles/**/*.less')
      .pipe(less())
      .pipe(concat('_common.css'))
      .pipe(cleanCSS({processImport: false}))
      .pipe(rename({suffix: ".min"}))
      .pipe(gulp.dest(path.join(clientDir, 'styles')));
  });

  gulp.task('vulcanize', ['bower', 'less'], function() {
    return gulp.src(path.join(clientDir, 'index.html'))
      .pipe(vulcanize({
        abspath: '',
        inlineScripts: true,
        inlineCss: true,
        implicitStrip: true,
        stripComments: true,
        excludes: Array.concat(['build.js'], options.vulcanize.excludes || []),
        stripExcludes: false,
        strip: true
      }))
      .on("error", function(err) {
        console.log("gulp error: " + err);
      })
      .pipe(gulp.dest(clientPublicDir))
      ;
  });

  gulp.task('customBuildClient');

  gulp.task('buildClient', ['cleanClient', 'buildShared', 'vulcanize', 'copyRes', 'customBuildClient']);


  // Build distribution

  const distDir = path.join(options.baseDir, 'dist');

  gulp.task('cleanDist', () =>
    del([distDir])
  );

  gulp.task('copyToDist', ['cleanDist'], () =>
    gulp.src(['server/**/*', 'client/public/**/*', 'shared/**/*', 'config/**/*', '*.json', '*.md', '*.js'], {base: options.baseDir})
      .pipe(gulp.dest(distDir))
  );

  gulp.task('zip', ['copyToDist'], () => {
    gulp.src('dist/**/*')
      .pipe(zip(options.name + '.zip'))
      .pipe(gulp.dest(distDir));
  });

  gulp.task('clean', ['cleanDist', 'cleanClient']);
  gulp.task('dist', ['clean', 'buildClient', 'zip']);

  // by default, it creates zip package for distribution
  gulp.task('default', ['dist']);


  // Mocha tests run

  const mocha = require('gulp-mocha');

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


  // ESLint run
  const eslint = require('gulp-eslint');

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
};
