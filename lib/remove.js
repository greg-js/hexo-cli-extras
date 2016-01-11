var Promise = require('bluebird');
var chalk = require('chalk');
var inquirer = require('inquirer');
var fsStat = Promise.promisify(require('fs').stat);
var fsUnlink = Promise.promisify(require('fs').unlink);
var fsRmdir = Promise.promisify(require('rimraf'));
var path = require('path');

module.exports = function(args) {
  var searchTerms;

  if (!args._.join('')) {
    console.log(chalk.red('You need to search for a specific post before you can remove it. Check `hexo help remove` for usage details.'));
    process.exit();
  } else {
    // every whitespace-separated word in the input search is a case-insensitive regular expression
    searchTerms = args._.map(function(arg) {
      return new RegExp(arg, 'i');
    });
  }

  // load database
  this.load().then(function() {
    var locals = this.locals;
    var sourceDir = this.source_dir;

    // load both posts and pages
    Promise.resolve(locals.get('posts').toArray().concat(locals.get('pages').toArray())).then(function(articles) {
      var getSelected = new Promise(function(resolve, reject) {

        articles = filterOnName(articles, searchTerms);
        var entries;

        if (articles.length == 0) {
          return reject(chalk.red('No posts or pages found using your query.'));
          process.exit();
        } else if (articles.length == 1) {
          return resolve(articles[0]);
        } else {

          entries = articles.map(function(article) {
            return [article.title, ' (', chalk.green(article.source), ')'].join('');
          });

          inquirer.prompt([
            {
              type: 'list',
              name: 'selected',
              message: 'Select the post or page you wish to rename.',
              choices: entries,
            },
          ], function(answer) {
            var pos = entries.indexOf(answer.selected);
            return resolve(articles[pos]);
          });
        }

      });

      getSelected.then(function(selected) {
        confirmRemove(selected);
      }).catch(function(e) {
        console.log(e);
        process.exit();
      });

    });

    function confirmRemove(post) {
      var message = '\n - Remove ' + chalk.green.underline(post.title) + '?\n' + chalk.red.bgBlack('Warning: this action is irreversible!');
      var del = chalk.red('Delete it!');
      var can = chalk.green('Cancel');

      inquirer.prompt([
        {
          type: 'list',
          message: message,
          name: 'answer',
          choices: [
            del,
            can,
          ],
        },
      ], function(response) {
        var ans = response.answer;

        switch (ans) {
          case del:
            remove(post);
            break;
          case can:
            console.log(chalk.gray('OK. See you later.'));
            process.exit();
        }
        return chalk.gray('Done.');
      });
    }

    function remove(post) {
      var src = post.full_source;

      // first check if the file exists
      fsStat(src).then(function(stats) {
        if (stats.isFile()) {

          // delete the file
          fsUnlink(src).then(function() {
            console.log(chalk.red.underline(src + ' deleted.'));
            var assetDir = src.substr(0, src.lastIndexOf('.'));

            // check for the asset directory
            fsStat(assetDir).then(function(stats) {
              if (stats.isDirectory()) {

                // delete the asset dir
                fsRmdir(assetDir).then(function() {
                  console.log(chalk.red.underline(assetDir + ' (asset directory) deleted.'));
                });
              }
            }).catch(function() {
              process.exit();
            });
          });
        }
      }).catch(function() {
        console.log('File not found. Exiting.');
        process.exit();
      });
    }

    function filterOnName(articles, terms) {
      return articles.filter(function(article) {
        return terms.every(function(term) {
          return term.test(article.title) || term.test(article.slug);
        });
      });
    }

  }.bind(this));
};

