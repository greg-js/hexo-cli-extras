'use strict';

var Promise = require('bluebird');
var chalk = require('chalk');
var inquirer = require('inquirer');
var fsStat = Promise.promisify(require('fs').stat);
var fsRename = Promise.promisify(require('fs').rename);
var fsMkdir = Promise.promisify(require('fs').mkdir);
var path = require('path');

module.exports = function modExports(args) {
  // set up -a/--all option and searchTerms
  var doWholeFolder = !!args.a || !!args.all;
  var searchTerms = [];

  if (!doWholeFolder) {
    searchTerms = args._.map(function makeRE(arg) {
      return new RegExp(arg, 'i');
    });
  }

  this.load().then(function loadDB() {

    var locals = this.locals;
    var exileDir = path.join(this.source_dir, '_posts', '_exile');
    var allPosts;

    // if the _exile dir doesn't exist yet, make it
    isDir(exileDir).then(function checkExileDir(exists) {
      if (!exists) {
        makeDir(exileDir);
      }
    }).then(function loadArticles() {
      return getArticles(locals);
    }).then(function selectArticle(arts) {
      allPosts = arts;
      return selectIsolated(arts, doWholeFolder);
    }).then(function splitPosts(isolated) {
      // split into { isolated, articlesToStash }
      return makeIsoObject(allPosts, isolated);
    }).then(function isolateArticles(articlesObject) {
      return doIsolate(articlesObject);
    }).then(function allDone(isolated) {
      console.log(chalk.gray(isolated), 'successfully isolated.\nTo restore the exiled posts, run', chalk.yellow('hexo integrate'));
    });

    function isDir(dir) {
      return fsStat(dir).then(function doCheckDir(stats) {
        if (stats.isFile() && /_exile/.test(dir)) {
          console.log(chalk.gray(dir), 'seems to be a file on your filesystem! It needs to be either non-existent or a directory, so please rename your _exile post before using this command.');
          process.exit();
        } else if (stats.isDirectory()) {
          // console.log('%s is a directory', dir);
          return true;
        } else {
          console.log(chalk.gray(dir), 'seems to be neither a file nor a directory! This really shouldn\'t be happening, please issue a bug report.');
          process.exit();
        }
      }).catch(function catchCheckDir() {
        // The directory doesn't exist (which is not a bad thing)
        // console.log('%s doesn\'t exist', dir);
        return false;
      });
    }

    function makeDir(dir) {
      return fsMkdir(dir).then(function doMakeDir() {
        console.log(chalk.gray(dir), 'created');
      }).catch(function catchMakeDir(err) {
        console.log(chalk.gray(dir), 'could not be created: ', chalk.red(err));
      });
    }

    function getArticles(data) {
      return Promise.resolve(data.get('posts').sort('-date').toArray());
    }

    function filterOnName(arts, terms) {
      return arts.filter(function filterArts(article) {
        return terms.every(function testRE(term) {
          return term.test(article.title) || term.test(article.slug);
        });
      });
    }

    function selectIsolated(items, doAll) {
      return new Promise(function makePromise(resolve) {
        var entries;

        // narrow down the post to isolate based on the user's inputted search terms (if available)
        var isolated = filterOnName(items, searchTerms);

        // stash everything if run with the -a/--all option
        if (doAll) {
          return resolve(isolated);
        } else if (isolated.length === 0) {
          console.log(chalk.red('No posts matched. Exiting.'));
          process.exit();
        } else if (isolated.length === 1) {
          return resolve(isolated[0].full_source);
        } else {

          // set up menu for selecting a post in case multiple match the search terms
          entries = isolated.map(function mapTitles(article) {
            return [article.title, ' (', chalk.green(article.updated.format('YYYY-MM-DD')), ')'].join('');
          });

          inquirer.prompt([
            {
              type: 'list',
              name: 'selected',
              message: 'Select the post you want to isolate.',
              choices: entries,
            },
          ], function getAnswer(answer) {
            var pos = entries.indexOf(answer.selected);
            return resolve(isolated[pos].full_source);
          });
        }
      });
    }

    function makeIsoObject(items, iso) {
      var toStash = items.map(function mapSource(item) {
        return item.full_source;
      }).filter(function filterOutIsolated(item) {
        return item !== iso;
      });

      return {
        isolated: iso,
        articlesToStash: toStash,
      };
    }

    function doIsolate(itemObj) {
      var newName;
      var isolated = itemObj.isolated;
      var toStash = itemObj.articlesToStash;

      var movePromises = toStash.map(function makePromise(article) {
        newName = path.join(exileDir, article.substr(article.lastIndexOf(path.sep)));
        return new Promise(function returnPromise(resolve) {
          resolve(move(article, newName));
        });
      });

      // just for outputting a completed message
      var thePost = (isolated) ? isolated : 'All posts';

      return Promise.all(movePromises).then(function allDone() {
        return thePost;
      });
    }

    function move(origin, destination) {
      // setting up the moving of the asset dirs in case they exist
      var assetDir = path.join(path.parse(origin).dir, path.parse(origin).name);
      var assetDirDestination = path.join(path.parse(destination).dir, path.parse(destination).name);
      Promise.resolve(isDir(assetDir)).then(function checkAssetDir(exists) {
        if (exists) {
          fsRename(assetDir, assetDirDestination).then(function doAssetDirMove() {
            // console.log('%s moved to %s', assetDir, assetDirDestination);
          }).catch(function catchAssetDirMove(err) {
            console.log('%s could not be moved to %s: %s', assetDir, assetDirDestination, err);
          });
        }
      });
      return fsRename(origin, destination).then(function doMove() {
        // console.log('%s moved to %s', origin, destination);
      }).catch(function catchMove(err) {
        console.log('%s could not be moved to %s: %s', origin, destination, err);
      });
    }

  }.bind(this));
};

