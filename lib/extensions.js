'use strict';

module.exports = function modExports(hexo) {
  var open = require('open');
  var editor = process.env.EDITOR;
  var spawn = require('child_process').spawn;

  // extend `hexo new` to open newly created post/draft
  hexo.on('new', function onNew(post) {
    var edit;
    var content = post.content;

    // only open a new empty post -- prevent opening on publishing an already written one
    if (content.substr(content.indexOf('\n---\n')).length === 5) {
      if (!editor) {
        open(post.path);
      } else {
        edit = spawn(editor, [post.path], {stdio: 'inherit'});
        edit.on('exit', process.exit);
      }
    }
  });
};
