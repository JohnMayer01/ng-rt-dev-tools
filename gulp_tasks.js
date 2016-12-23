/**
 * Common gulp tasks for
 *  run eslint
 *  build the plugin
 *    UI
 *    server
 *    common (server & UI)
 *  run mocha tests
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
    name: path.basename(path.dirname(module.parent.filename)),
    baseDir: path.dirname(module.parent.filename),
    browserify: {}
  }, options);

  const uiDir = path.join(options.baseDir, 'ui');
  const uiPublicDir = path.join(uiDir, 'public');


  // Common (server & UI) building

  // modules for build
  const sourcemaps = require('gulp-sourcemaps');
  const source = require('vinyl-source-stream');
  const buffer = require('vinyl-buffer');
  const browserify = require('browserify');
  const watchify = require('watchify');
  const babel = require('babelify');

  /*
   [
   require.resolve('ed25519')
   ]
   */
  // functions for build
  function compileCommon(watch) {
    var bundler = watchify(browserify(path.join(options.baseDir, 'common/index.js'), {
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

  gulp.task('buildCommon', function () {
    return compileCommon();
  });

  gulp.task('watchCommon', function () {
    return compileCommon(true);
  });


  // Build UI

  gulp.task('cleanUi', () =>
    del([uiPublicDir])
  );

  gulp.task('copy-res', function() {
    gulp.src(uiDir + '/res/**/*')
      .pipe(gulp.dest(path.join(uiDir, 'public/res')));
  });

  gulp.task('copy-res-jsoneditor', function() {
    gulp.src(uiDir + '/bower_components/jsoneditor/dist/**/*')
      .pipe(gulp.dest(path.join(uiDir, 'public/jsoneditor/dist')));
  });

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
        excludes: ['bs58.js', 'keys.js'],
        stripExcludes: false,
        strip: true
      }))
      .on("error", function(err) {
        // TODO: avoid console.log()
        console.log("gulp error: " + err);
      })
      .pipe(gulp.dest(uiPublicDir))
      ;
  });

  gulp.task('buildUi', ['cleanUi', 'buildCommon', 'vulcanize', 'copy-res', 'copy-res-jsoneditor']);


  // Build distribution tasks
  const distDir = path.join(options.baseDir, 'dist');

  gulp.task('cleanDist', () =>
    del([distDir])
  );

  gulp.task('copyToDist', ['cleanDist'], () =>
    gulp.src(['server/**/*', 'ui/**/*', 'common/**/*', 'config/**/*', '*.json', '*.md', '*.js'], {base: options.baseDir})
      .pipe(gulp.dest(distDir))
  );

  gulp.task('zip', ['copyToDist'], () => {
    gulp.src('dist/**/*')
      .pipe(zip(options.name + '.zip'))
      .pipe(gulp.dest(distDir));
  });

  gulp.task('clean', ['cleanDist', 'cleanUi']);
  gulp.task('dist', ['clean', 'buildUi', 'zip']);


  // Mocha tasks
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


  // ESLint tasks
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
