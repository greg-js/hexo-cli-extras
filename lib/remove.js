'use strict';

var Promise = require('bluebird');
var chalk = require('chalk');
var inquirer = require('inquirer');
var fsStat = Promise.promisify(require('fs').stat);
var fsUnlink = Promise.promisify(require('fs').unlink);
var fsRmdir = Promise.promisify(require('rimraf'));

module.exports = function modExports(args) {
  var searchTerms;

  if (!args._.join('')) {
    console.log(chalk.red('You need to search for a specific post before you can remove it. Check `hexo help remove` for usage details.'));
    process.exit();
  } else {
    // every whitespace-separated word in the input search is a case-insensitive regular expression
    searchTerms = args._.map(function mapSearchTerms(arg) {
      return new RegExp(arg, 'i');
    });
  }

  // load database
  this.load().then(function loadDb() {
    var locals = this.locals;

    // load posts and pages
    getArticles(locals).then(function loadArticles(articles) {
      return selectArticle(articles);
    }).then(function processSelected(selected) {
      return confirmRemove(selected);
    }).catch(function failProcessSelected(err) {
      console.log(err.stack ? chalk.red(err.stack) : chalk.gray(err));
      process.exit();
    });

    function getArticles(data) {
      return Promise.resolve(data.get('posts').toArray().concat(locals.get('pages').toArray()));
    }

    function filterOnName(articles, terms) {
      return articles.filter(function filterArticles(article) {
        return terms.every(function checkRE(term) {
          return term.test(article.title) || term.test(article.slug);
        });
      });
    }

    function selectArticle(items) {
      var filtered = filterOnName(items, searchTerms);

      if (filtered.length === 0) {
        return Promise.reject(chalk.red('No posts or pages found using your query.'));
      }

      if (filtered.length === 1) {
        return Promise.resolve(filtered[0]);
      }

      var entries = filtered.map(function mapEntries(article) {
        return [article.title, ' (', chalk.green(article.source), ')'].join('');
      });

      return inquirer.prompt([
        {
          type: 'list',
          name: 'selected',
          message: 'Select the post or page you wish to rename.',
          choices: entries,
        },
      ]).then(function getAnswer(answer) {
        var pos = entries.indexOf(answer.selected);
        return filtered[pos];
      });
    }

    function confirmRemove(post) {
      var message = '\n - Remove ' + chalk.green.underline(post.title) + '?\n' + chalk.red.bgBlack('Warning: this action is irreversible!');
      var del = chalk.red('Delete it!');
      var can = chalk.green('Cancel');

      return inquirer.prompt([
        {
          type: 'list',
          message: message,
          name: 'answer',
          choices: [
            del,
            can,
          ],
        },
      ]).then(function getResponse(response) {
        var ans = response.answer;

        switch (ans) {
        case del:
          remove(post);
          break;
        case can:
          console.log(chalk.gray('OK. See you later.'));
          process.exit();
          break;
        default:
          console.log(chalk.red('This shouldn\'t happen, please file a bug report.'));
          process.exit();
        }
        return chalk.gray('Done.');
      });
    }

    function remove(post) {
      var src = post.full_source;

      // first check if the file exists
      fsStat(src).then(function getStats(stats) {
        if (stats.isFile()) {

          // delete the file
          fsUnlink(src).then(function unlinkFile() {
            var assetDir = src.substr(0, src.lastIndexOf('.'));
            console.log(chalk.red.underline(src + ' deleted.'));

            // check for the asset directory
            fsStat(assetDir).then(function getAssetDirStats(adStats) {
              if (adStats.isDirectory()) {

                // delete the asset dir
                fsRmdir(assetDir).then(function unlinkAssetDir() {
                  console.log(chalk.red.underline(assetDir + ' (asset directory) deleted.'));
                });
              }
            }).catch(function failAssetDir() {
              console.log(chalk.gray('No asset dir found.'));
            });
          });
        }
      }).catch(function failRemove(err) {
        console.log(chalk.red('Problem deleting article :', err));
        process.exit();
      });
    }

  }.bind(this));
};

