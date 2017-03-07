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
  // we use gulp instance provided by a module via parameter
  // but if there is no ref. to gulp, then we use
  if (!gulp)
    gulp = require("gulp");

  const gulpsync = require('gulp-sync')(gulp);
  const zip = require('gulp-zip');
  const del = require('del');

  // from the lowest priority to the highest
  options = _.extend(
    // default options
    {
      name: path.basename(path.dirname(module.parent.parent.filename)),
      baseDir: path.dirname(module.parent.parent.filename),
      browserify: {},
      vulcanize: {}
    },

    // options from parameters
    options,

    // options provided via command line
    require('minimist')(process.argv.slice(2), {
      string: ['src']
    })
  );

  const sharedDir = path.join(options.baseDir, 'shared');
  const clientDir = path.join(options.baseDir, 'client');
  const clientPublicDir = path.join(clientDir, 'public');
  const clientBowerDir = path.join(clientDir, 'bower_components');

  // Browserify shared (server & UI) code

  const sourcemaps = require('gulp-sourcemaps');
  const source = require('vinyl-source-stream');
  const buffer = require('vinyl-buffer');
  const browserify = require('browserify');
  const babel = require('babelify');

  var weekOfYear = function(date){
    var d = new Date(+date);
    d.setHours(0,0,0);
    d.setDate(d.getDate()+4-(d.getDay()||7));
    return Math.ceil((((d-new Date(d.getFullYear(),0,1))/8.64e7)+1)/7);
  };

  gulp.task('buildShared', () => {
    const indexPath = path.join(sharedDir, 'index.js');

    // if there is no index.js, then skip
    if (!fs.existsSync(indexPath))
      return Promise.resolve();

    return browserify(indexPath, {
      debug: true,
      noParse: options.browserify.noParse || []
    })
      .transform(babel, {
        presets: [require('babel-preset-es2015')]
      })
      .bundle()
      .pipe(source('build.js'))
      .pipe(buffer())
      .pipe(sourcemaps.init({
        loadMaps: true
      }))
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

  gulp.task('cleanClient', callback => {
    del.sync([clientPublicDir, clientBowerDir]);
    callback();
  });

  gulp.task('copyRes', () =>
    gulp.src(clientDir + '/src/res/**/*')
      .pipe(gulp.dest(path.join(clientDir, 'public/res')))
  );

  gulp.task('bower', () => {
    if (!fs.existsSync(path.join(clientDir, 'bower.json')))
      return Promise.resolve();
    return bower({
      cwd: clientDir
    });
  });

  gulp.task('less', () =>
    gulp.src(clientDir + '/src/styles/**/*.less')
      .pipe(less())
      .pipe(concat('_common.css'))
      .pipe(cleanCSS({
        processImport: false
      }))
      .pipe(rename({
        suffix: ".min"
      }))
      .pipe(gulp.dest(path.join(clientDir, 'src', 'styles')))
  );

  gulp.task('vulcanize', gulpsync.sync(['bower', 'less']), () =>
    gulp.src(path.join(clientDir, 'src', 'index.html'))
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
  );

  gulp.task('customBuildClient');

  gulp.task('buildClient', gulpsync.sync(['buildShared', 'vulcanize', 'copyRes', 'customBuildClient']));

  // Build distribution

  const distDir = path.join(options.baseDir, 'dist');

  gulp.task('cleanDist', callback => {
    del.sync([distDir]);
    callback();
  });

  gulp.task('copyToDist', ['buildClient'], () =>
    gulp.src(['server/**/*', 'client/**/*', 'api/**/*', 'generators/**/*', 'ui/**/*', 'uiObject/**/*','scripts/**/*',
      'docs/**/*', 'state-machine/**/*','shared/**/*', 'config/**/*', '*.json', '*.md', '*.js'], {
      base: options.baseDir
    })
      .pipe(gulp.dest(distDir))
  );

  gulp.task('writeVersion', ['copyToDist'], callback => {
    fs.writeFileSync(path.join(distDir, 'ng-rt-version'), process.env.CI_PIPELINE_ID);
    callback();
  });

  gulp.task('zip', ['writeVersion'], () =>
    gulp.src('dist/**/*')
      .pipe(zip(options.name + '.zip'))
      .pipe(gulp.dest(distDir))
  );

  gulp.task('clean', ['cleanDist', 'cleanClient']);
  gulp.task('dist', gulpsync.sync(['clean', 'zip']));
  gulp.task('build', ['buildClient']);
  gulp.task('rebuild', gulpsync.sync(['clean', 'build']));

  // by default, it creates zip package for distribution
  gulp.task('default', ['dist']);

  // Mocha tests run

  const mocha = require('gulp-mocha');

  const serverOptions = {
    timeout: 600000 // 10 minutes
  };
  const uiOptions = {
    timeout: 600000 // 10 minutes
  };
  const testError = err => {
    console.error(err.message);
    console.error(err.stack);
    process.exit(1);
  };
  const testEnd = () => {
    process.exit();
  };

  const defineMochaTask = (taskName, src, mochaOptions) => {
    gulp.task(taskName, () =>
      gulp.src(src)
        .pipe(mocha(mochaOptions))
        .once('error', testError)
        .once('end', testEnd)
    );
  };

  defineMochaTask('test.server', 'test/server/**/*_test.js', serverOptions);
  defineMochaTask('test.ui', 'test/ui/**/*_test.js', uiOptions);
  defineMochaTask('test', options.src || 'test/server/**/*_test.js', {
    timeout: options.timeout || serverOptions.timeout
  });

  // ESLint run
  const eslint = require('gulp-eslint');

  gulp.task('lint', () =>
    gulp.src(options.src || [
        '**/*.js',
        '!**/*.min.js',
        '!node_modules/**',
        '!**/bower_components/**',
        '!**/public/**',
        '!plugins/**',
        '!docs/**',
        '!dist/**'
      ])
      .pipe(eslint({
        fix: true
      }))
      .pipe(eslint.format())
      .pipe(gulp.dest(function(file) {
        return file.base;
      }))
      .pipe(eslint.failAfterError())
  );

  const jsdoc = require('gulp-jsdoc3');

  gulp.task('doc', function(callback) {
    gulp.src(['server/**/*.js', 'client/public/**/*', 'shared/**/*', '*.js'], {
      read: false
    })
      .pipe(jsdoc(callback));
  });

};
