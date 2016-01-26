'use strict';

var Promise = require('bluebird');
var chalk = require('chalk');
var fsStat = Promise.promisify(require('fs').stat);
var fsRename = Promise.promisify(require('fs').rename);
var fsReaddir = Promise.promisify(require('fs').readdir);
var path = require('path');

module.exports = function modExports() {

  // load DB (kind of unnecessary here, but it does give easy access to source_dir)
  this.load().then(function loadDB() {
    var postsDir = path.join(this.source_dir, '_posts');
    var exileDir = path.join(postsDir, '_exile');

    isExileDir(exileDir).then(function checkExileDir(exists) {
      if (!exists) {
        process.exit();
      }
    }).then(function lsDir() {
      return getExiledPosts(exileDir);
    }).then(function checkExiledPosts(files) {
      if (!files) {
        console.log(chalk.red('No exiled posts detected. Exiting..'));
        process.exit();
      } else {
        return files;
      }
    }).then(function processFiles(files) {
      // set the exiled files up for restoration
      return files.map(function mapAbsolutePaths(file) {
        return {
          origin: path.join(exileDir, file),
          destination: path.join(postsDir, file),
        };
      });
    }).then(function doIntegrate(files) {
      var movePromises = files.map(function makePromise(file) {
        return new Promise(function returnPromise(resolve) {
          resolve(move(file.origin, file.destination));
        });
      });

      Promise.all(movePromises).then(function allDone() {
        console.log(chalk.gray('All exiled posts and asset directories restored.'));
      });
    });

    function move(origin, destination) {
      return fsRename(origin, destination).then(function doMove() {
        // console.log('%s moved to %s', origin, destination);
      }).catch(function catchMove(err) {
        console.log('%s could not be moved to %s: %s', origin, destination, err);
      });
    }

    function isExileDir(dir) {
      return fsStat(dir).then(function doCheckDir(stats) {
        if (stats.isFile()) {
          console.log(chalk.gray(dir), 'seems to be a file on your filesystem! It needs to be either non-existent or a directory, so please rename your _exile post and run', chalk.yellow('hexo isolate'), 'before using this command.');
          return false;
        } else if (stats.isDirectory()) {
          return true;
        } else {
          console.log(chalk.gray(dir), 'seems to be neither a file nor a directory! This really shouldn\'t be happening, please issue a bug report.');
          return false;
        }
      }).catch(function catchCheckDir() {
        // The directory doesn't exist
        console.log(chalk.red('No _exile dir detected. Have you run'), chalk.yellow('hexo isolate'), chalk.red('first?'));
        return false;
      });
    }

    function getExiledPosts(dir) {
      return fsReaddir(dir).then(function doReadDir(contents) {
        return contents;
      }).catch(function catchCheckDir(err) {
        console.log(chalk.red('Error: '), err);
      });
    }
  }.bind(this));
};

