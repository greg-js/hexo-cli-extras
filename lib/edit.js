'use strict';

var chalk = require('chalk');
var moment = require('moment');
var open = require('open');
var editor = process.env.EDITOR;
var spawn = require('child_process').spawn;
var path = require('path');
var inquirer = require('inquirer');
var Promise = require('bluebird');

module.exports = function modExports(args) {
  var filters = {
    title: args._ || '',

    after: args.a  || args.after    ||                    null,
    before: args.b || args.before   ||                    null,
    cat: args.c    || args.category || args.categories || null,
    draft: args.draft               || args.drafts     || null,
    folder: args.f || args.folder   ||                    null,
    layout: args.l || args.layout   ||                    null,
    tag: args.t    || args.tag      ||                    null,
  };

  var gui  = args.g || args.gui  || !editor;
  var page = args.p || args.page || args.pages || null;

  // load in the posts before processing them
  this.load().then(function loadDB() {
    var sourceDir = this.source_dir;
    var searchDir = sourceDir;

    var query = (page) ? 'pages' : 'posts';

    // the following promise chain details the main functionality
    loadArticles(query, this.locals).then(function filter(articles) {
      return filterArticles(articles, filters);
    }).then(function select(filtered) {
      return selectArticle(filtered);
    }).then(function openFn(selected) {
      openFile(selected);
    }).catch(function catchAll(err) {
      console.log(chalk.red('Error: '), err);
    });

    function loadArticles(dataType, locals) {
      return Promise.resolve(locals.get(dataType).sort('-date').toArray());
    }

    function filterArticles(items, filterObj) {
      var results;
      // allow omission of leading underscore or trailing s for the common _drafts and _posts folders;
      if (/post|draft/.test(filterObj.folder)) {
        filterObj.folder = (/^_/.test(filterObj.folder)) ? filterObj.folder : '_' + filterObj.folder;
        filterObj.folder = (/s$/.test(filterObj.folder)) ? filterObj.folder : filterObj.folder + 's';
      }

      results = filterTitle(items, filterObj.title);

      results = (!!filterObj.draft)  ? filterDrafts(results) : results;
      results = (!!filterObj.layout) ? filterLayout(results, filterObj.layout) : results;
      results = (!!filterObj.folder) ? filterFolder(results, filterObj.folder) : results;
      results = (!!filterObj.tag)    ? filterTag(results, filterObj.tag) : results;
      results = (!!filterObj.cat)    ? filterCategory(results, filterObj.cat) : results;
      results = (!!filterObj.before) ? filterBefore(results, filterObj.before) : results;
      results = (!!filterObj.after)  ? filterAfter(results, filterObj.after) : results;

      return results;

      // filter the posts with the supplied regular expression
      function filterTitle(posts, title) {
        var reTitle = title.map(function makeRE(word) {
          return new RegExp(word, 'i');
        });

        return posts.filter(function filterPosts(post) {
          return reTitle.every(function checkRE(regex) {
            return regex.test(post.title) || regex.test(post.slug);
          });
        });
      }

      // filter the posts using a subfolder if supplied
      function filterFolder(posts, folder) {
        var reFolder = new RegExp(folder);
        return posts.filter(function filterPosts(post) {
          return reFolder.test(post.source.substr(0, post.source.lastIndexOf(path.sep)));
        });
      }

      // filter the posts using a tag if supplied
      function filterTag(posts, tag) {
        var reTag = new RegExp(tag);
        return posts.filter(function filterPosts(post) {
          return post.tags.data.some(function checkRe(postTag) {
            return reTag.test(postTag.name);
          });
        });
      }

      // filter the posts using a category if supplied
      function filterCategory(posts, cat) {
        var reCat = new RegExp(cat);
        return posts.filter(function filterPosts(post) {
          return post.categories.data.some(function checkRe(postCat) {
            return reCat.test(postCat.name);
          });
        });
      }

      // filter the posts using a layout if supplied
      function filterLayout(posts, layout) {
        var reLayout = new RegExp(layout, 'i');

        return posts.filter(function filterPosts(post) {
          return reLayout.test(post.layout);
        });
      }

      // filter out all non-published posts
      function filterDrafts(posts) {
        return posts.filter(function filterPosts(post) {
          return !post.published;
        });
      }

      // filter the posts using a before date if supplied
      function filterBefore(posts, before) {
        var momentBefore = moment(before.replace(/\//g, '-'), 'MM-DD-YYYY', true);
        if (!momentBefore.isValid()) {
          console.log(chalk.red('Before date is not valid (expecting `MM-DD-YYYY`), ignoring argument.'));
          return posts;
        }

        return posts.filter(function filterPosts(post) {
          return moment(post.date).isBefore(momentBefore);
        });
      }

      // filter the posts using an after date if supplied
      function filterAfter(posts, after) {
        var momentAfter = moment(after.replace(/\//g, '-'), 'MM-DD-YYYY', true);
        if (!momentAfter.isValid()) {
          console.log(chalk.red('After date is not valid (expecting `MM-DD-YYYY`), ignoring argument.'));
          return posts;
        }

        return posts.filter(function filterPosts(post) {
          return moment(post.date).isAfter(momentAfter);
        });
      }
    }

    function selectArticle(items) {
      return new Promise(function getSelected(resolve, reject) {
        var selected;
        var entries;

        if (items.length === 0) {
          return reject('Sorry, no articles match your query.');
        } else if (items.length === 1) {
          // no menu necessary if there is only one matching file
          selected = path.join(searchDir, items[0].source);
          return resolve(selected);
        } else {
          // populate a list of entries to use for the menu -- slugs are easy because they show the subfolder and can easily be put back together with the searchDir to open the file
          entries = items.map(function makeEntries(post) {
            var entry = '';
            var loc = post.source.substr(0, post.source.lastIndexOf(path.sep));
            if (!post.published) {
              entry = ['[', chalk.yellow.bgBlack('draft'), '] ', post.title].join('');
            } else {
              entry = ['[', chalk.gray(post.date.format('MM-DD-YYYY')), '] ', post.title, ' (', chalk.green(loc), ')'].join('');
            }

            return entry;
          });

          // display the menu
          inquirer.prompt([
            {
              type: 'list',
              name: 'file',
              message: 'Select the file you wish to edit.',
              choices: entries,
            },
          ], function getAnswer(answer) {
            var pos = entries.indexOf(answer.file);
            selected = path.join(sourceDir, items[pos].source);

            if (!selected) {
              return reject('Invalid choice.');
            }
            return resolve(selected);
          });
        }
      });
    }

    // spawn process and open with associated gui or terminal editor
    function openFile(file) {
      var edit;
      if (!editor || gui) {
        open(file);
      } else {
        edit = spawn(editor, [file], {stdio: 'inherit'});
        edit.on('exit', process.exit);
      }
    }
  }.bind(this)).catch(function catchLoadDb(err) {
    console.log(chalk.red('Error: '), err);
  });
};
