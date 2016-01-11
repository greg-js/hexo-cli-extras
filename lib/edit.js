'use strict';

var chalk = require('chalk');
var moment = require('moment');
var open = require('open');
var editor = process.env.EDITOR;
var spawn = require('child_process').spawn;
var path = require('path');
var inquirer = require('inquirer');

module.exports = function modExports(args) {
  var title  = args._ || '';

  var after  = args.a || args.after    ||                    null;
  var before = args.b || args.before   ||                    null;
  var cat    = args.c || args.category || args.categories || null;
  var draft  = args.d || args.draft    || args.drafts     || null;
  var folder = args.f || args.folder   ||                    null;
  var gui    = args.g || args.gui      || !editor;
  var layout = args.l || args.layout   ||                    null;
  var page   = args.p || args.page     || args.pages      || null;
  var tag    = args.t || args.tag      ||                    null;

  // load in the posts before processing them
  this.load().then(function loadDB() {
    var sourceDir = this.source_dir;
    var searchDir = sourceDir;

    var selected;
    var entries;

    var query = (page) ? 'pages' : 'posts';

    Promise.resolve(this.locals.get(query).sort('-date').toArray()).then(function loadArticles(posts) {
      var filtered = posts.slice();

      // allow omission of leading underscore or trailing s for the common _drafts and _posts folders;
      if (/post|draft/.test(folder)) {
        folder = (/^_/.test(folder)) ? folder : '_' + folder;
        folder = (/s$/.test(folder)) ? folder : folder + 's';
      }

      filtered = filterTitle(filtered);

      filtered = (!!draft)  ? filterDrafts(filtered)   : filtered;
      filtered = (!!layout) ? filterLayout(filtered)   : filtered;
      filtered = (!!folder) ? filterFolder(filtered)   : filtered;
      filtered = (!!tag)    ? filterTag(filtered)      : filtered;
      filtered = (!!cat)    ? filterCategory(filtered) : filtered;
      filtered = (!!before) ? filterBefore(filtered)   : filtered;
      filtered = (!!after)  ? filterAfter(filtered)    : filtered;

      if (filtered.length === 0) {
        console.log(chalk.red('Sorry, no filtered matched your query. Exiting.'));
        process.exit();
      } else if (filtered.length === 1) {

        // no menu necessary if there is only one matching file
        selected = path.join(searchDir, filtered[0].source);
        openFile(selected);
      } else {

        // get a list of entries to put in the menu -- slugs are easy because it shows the subfolder and can easily be put back together with the searchDir to open it
        entries = filtered.map(function makeEntries(post) {
          var entry = '';
          var loc = post.source.substr(0, post.source.lastIndexOf(path.sep));
          if (!post.published) {
            entry = ['[', chalk.yellow.bgBlack('draft'), '] ', post.title].join('');
          } else {
            entry = ['[', chalk.gray(post.date.format('MM-DD-YYYY')), '] ', post.title, ' (', chalk.green(loc), ')'].join('');
          }

          return entry;
        });

        inquirer.prompt([
          {
            type: 'list',
            name: 'file',
            message: 'Select the file you wish to edit.',
            choices: entries,
          },
        ], function getAnswer(answer) {
          var pos = entries.indexOf(answer.file);
          selected = path.join(sourceDir, filtered[pos].source);
          openFile(selected);
        });
      }

    });

    // filter the posts with the supplied regular expression
    function filterTitle(posts) {
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
    function filterFolder(posts) {
      var reFolder = new RegExp(folder);
      return posts.filter(function filterPosts(post) {
        return reFolder.test(post.source.substr(0, post.source.lastIndexOf(path.sep)));
      });
    }

    // filter the posts using a tag if supplied
    function filterTag(posts) {
      var reTag = new RegExp(tag);
      return posts.filter(function filterPosts(post) {
        return post.tags.data.some(function checkRe(postTag) {
          return reTag.test(postTag.name);
        });
      });
    }

    // filter the posts using a category if supplied
    function filterCategory(posts) {
      var reCat = new RegExp(cat);
      return posts.filter(function filterPosts(post) {
        return post.categories.data.some(function checkRe(postCat) {
          return reCat.test(postCat.name);
        });
      });
    }

    // filter the posts using a layout if supplied
    function filterLayout(posts) {
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
    function filterBefore(posts) {
      before = moment(before.replace(/\//g, '-'), 'MM-DD-YYYY', true);
      if (!before.isValid()) {
        console.log(chalk.red('Before date is not valid (expecting `MM-DD-YYYY`), ignoring argument.'));
        return posts;
      }

      return posts.filter(function filterPosts(post) {
        return moment(post.date).isBefore(before);
      });
    }

    // filter the posts using an after date if supplied
    function filterAfter(posts) {
      after = moment(after.replace(/\//g, '-'), 'MM-DD-YYYY', true);
      if (!after.isValid()) {
        console.log(chalk.red('After date is not valid (expecting `MM-DD-YYYY`), ignoring argument.'));
        return posts;
      }

      return posts.filter(function filterPosts(post) {
        return moment(post.date).isAfter(after);
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
  }.bind(this));
};
