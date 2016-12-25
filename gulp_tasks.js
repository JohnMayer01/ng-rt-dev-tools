/**
 * Common gulp tasks for
 *  + build
 *    - browserify shared code for UI
 *    - build pure client code
 *    - distribution package build
 *  + run mocha tests
 *  + run eslint
 */
'use strict';
const path = require('path');
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
  const uiDir = path.join(options.baseDir, 'client');
  const uiPublicDir = path.join(uiDir, 'public');


  // Browserify shared (server & UI) code

  const sourcemaps = require('gulp-sourcemaps');
  const source = require('vinyl-source-stream');
  const buffer = require('vinyl-buffer');
  const browserify = require('browserify');
  const watchify = require('watchify');
  const babel = require('babelify');

  /*
  function compileShared(watch) {
    var bundler = watchify(browserify(path.join(sharedDir, 'index.js'), {
      debug: true,
      noParse: options.browserify.noParse || []
    }).transform(babel));

    function rebundle() {
      bundler.bundle()
        .on('error', function (err) {
          console.error(err);
          this.emit('end');
        })
        .pipe(source('build.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest(uiPublicDir));
    }

    if (watch) {
      bundler.on('update', function () {
        console.log('-> bundling...');
        rebundle();
      });
    }

    rebundle();
  }

  gulp.task('watchShared', function () {
    return compileShared(true);
  });
  */

  gulp.task('buildShared', function () {
    browserify(path.join(sharedDir, 'index.js'), {
      debug: true,
      noParse: options.browserify.noParse || []
    })
      .transform(babel)
      .bundle()
      .pipe(source('build.js'))
      .pipe(buffer())
      .pipe(sourcemaps.init({loadMaps: true}))
      .pipe(sourcemaps.write('./'))
      .pipe(gulp.dest(uiPublicDir));
  });


  // Build client code (UI)
  var vulcanize = require('gulp-vulcanize');
  var less = require('gulp-less');
  var concat = require('gulp-concat');
  var cleanCSS = require('gulp-clean-css');
  var rename = require('gulp-rename');

  gulp.task('cleanClient', () =>
    del([uiPublicDir])
  );

  gulp.task('copyRes', function() {
    gulp.src(uiDir + '/res/**/*')
      .pipe(gulp.dest(path.join(uiDir, 'public/res')));
  });

  // TODO
  // gulp.task('copy-res-jsoneditor', function() {
  //   gulp.src(uiDir + '/bower_components/jsoneditor/dist/**/*')
  //     .pipe(gulp.dest(path.join(uiDir, 'public/jsoneditor/dist')));
  // });

  gulp.task('less', function() {
    gulp.src(uiDir + '/styles/**/*.less')
      .pipe(less())
      .pipe(concat('_common.css'))
      .pipe(cleanCSS({processImport: false}))
      .pipe(rename({suffix: ".min"}))
      .pipe(gulp.dest(path.join(uiDir, 'styles')));
  });

  gulp.task('vulcanize', ['less'], function() {
    return gulp.src(path.join(uiDir, 'index.html'))
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
      .pipe(gulp.dest(uiPublicDir))
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
    gulp.src(['server/**/*', 'client/**/*', 'shared/**/*', 'config/**/*', '*.json', '*.md', '*.js'], {base: options.baseDir})
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
  defineMochaTask('test.ui', 'test/client/**/*_test.js', uiOptions);


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
