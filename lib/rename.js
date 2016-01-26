'use strict';

var Promise = require('bluebird');
var chalk = require('chalk');
var inquirer = require('inquirer');
var fsReadFile = Promise.promisify(require('fs').readFile);
var fsStat = Promise.promisify(require('fs').stat);
var fsWriteFile = Promise.promisify(require('fs').writeFile);
var fsRename = Promise.promisify(require('fs').rename);
var slugize = require('hexo-util').slugize;
var path = require('path');

module.exports = function modExports(args) {
  var oldName;
  var newName = args.n || args.new || '';

  if (!args._.join('') || !newName) {
    console.log(chalk.red('Both a new and an old filename/title are required. `hexo rename help` to display help.'));
    process.exit();
  } else {
    // every whitespace-separated word in the input search is a case-insensitive regular expression
    oldName = args._.map(function makeRE(arg) {
      return new RegExp(arg, 'i');
    });
  }

  // load database
  this.load().then(function loadDB() {
    var selectedPost;

    loadArticles(this.locals).then(function select(arts) {
      return selectArticle(arts);
    }).then(function selectRename(selected) {
      selectedPost = selected;
      return chooseRenameStyle(selectedPost);
    }).then(function process(renameStyle) {
      if (renameStyle === 'filename') {
        return renameFile(selectedPost, newName);
      } else if (renameStyle === 'title') {
        return renameTitle(selectedPost, newName);
      } else {
        return renameTitle(selectedPost, newName).then(function alsoFilename() {
          return renameFile(selectedPost, newName);
        });
      }
    }).catch(function catchAll(err) {
      console.log(chalk.red('Error: ') + err);
      process.exit();
    });

    function selectArticle(items) {
      return new Promise(function getSelected(resolve, reject) {

        var entries;
        var articles = filterOnName(items, oldName);

        if (articles.length === 0) {
          return reject('No posts or pages found using your query.');
        } else if (articles.length === 1) {
          // no menu if there is only one result
          return resolve(articles[0]);
        } else {

          entries = articles.map(function mapArts(article) {
            return [article.title, ' (', chalk.green(article.source), ')'].join('');
          });

          inquirer.prompt([
            {
              type: 'list',
              name: 'selected',
              message: 'Select the post or page you wish to rename.',
              choices: entries,
            },
          ], function getAnswer(answer) {
            var pos = entries.indexOf(answer.selected);
            return resolve(articles[pos]);
          });
        }
      });
    }

    function chooseRenameStyle(post) {
      return new Promise(function returnPromise(resolve, reject) {
        var message = '\n - Rename title (' + chalk.green.underline(post.title) + ') to ' + chalk.cyan.underline(newName) + ' ?\n - Rename filename (' + chalk.green.underline(post.source.substr(post.source.lastIndexOf(path.sep))) + ') to ' + chalk.cyan.underline(slugize(newName, {transform: 1}) + '.md') + ' ?';
        inquirer.prompt([
          {
            type: 'list',
            message: message,
            name: 'answer',
            choices: [
              'Yes, rename both',
              'Title only please (don\'t rename the file!)',
              'Filename only please (don\'t rename the title!)',
              'No, forget it, cancel everything.',
            ],
          },
        ], function processRes(response) {
          var ans = response.answer;

          switch (ans) {
          case 'Yes, rename both':
            return resolve('both');
          case 'Title only please (don\'t rename the file!)':
            return resolve('title');
          case 'Filename only please (don\'t rename the title!)':
            return resolve('filename');
          default:
            return reject('User cancelled rename operation');
          }

          return chalk.gray('Done.');
        });
      });
    }

    function renameFile(art, renamed) {

      var src = art.full_source;
      var newSrc = path.join(src.substr(0, src.lastIndexOf(path.sep)), slugize(renamed, {transform: 1}));

      // first the markdown file
      return fsRename(src, newSrc + '.md').then(function doRenameMd() {
        var fldr;

        console.log(chalk.red(src) + ' renamed to ' + chalk.green(newSrc) + '.md');

        fldr = src.substr(0, src.lastIndexOf('.'));

        // then the folder if it exists
        return fsStat(fldr).then(function doCheckDir(stats) {
          if (stats.isDirectory()) {
            return fsRename(fldr, newSrc).then(function doRenameDir() {
              console.log(chalk.underline('Asset folder renamed as well.'));
            });
          } else {
            return 'Done';
          }
        }).catch(function catchCheckDir() {
          return console.log(chalk.underline('No asset folder found.'));
        });
      });

    }

    function renameTitle(art, newTitle) {
      var oldTitle = art.title;
      var oldTitleString = new RegExp('title:.*');

      // change the title through the file system because changing it in the db caused issues
      return fsReadFile(art.full_source, 'utf8').then(function doReadArt(data) {
        var cont = data.replace(oldTitleString, 'title: "' + newTitle + '"');

        return fsWriteFile(art.full_source, cont, 'utf8').then(function doWriteArt() {
          console.log(chalk.red(oldTitle) + ' renamed to ' + chalk.green(newTitle));
        });
      });
    }

    function loadArticles(locals) {
      return Promise.resolve(locals.get('posts').toArray().concat(locals.get('pages').toArray()));
    }

    function filterOnName(articles, terms) {
      return articles.filter(function filterArts(article) {
        return terms.every(function testRE(term) {
          return term.test(article.title) || term.test(article.slug);
        });
      });
    }

  }.bind(this));
};

