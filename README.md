# hexo-cli-extras

This is a simple plugin for [Hexo](https://github.com/hexojs/hexo), a Node.js-based static site generator/blog framework.

The plugin adds a handful of useful commands to the Hexo command-line interface: `edit`, `rename`, `remove`, `isolate` and `integrate`.

Basic terminal editing:

![example](./docs/basic.gif)

Basic GUI editing and selection on tag (sorry for the bad resolution):

![example](./docs/gui.gif)

A more detailed explanation of the commands and their options is included below, but remember that you can run `hexo help` followed by any command in your terminal to get a handy overview (for example: `hexo help edit`). Also, at the very bottom of this README, you'll find some tips and notes which may be useful to you.

## Installation

```
npm install --save hexo-cli-extras
```

Note that the plugin *must* be installed locally. So if you have multiple blogs, you have to install it separately for each of them.

## edit command

Select a post, page or draft using search terms and/or filters and open it in your favorite terminal $EDITOR or associated GUI text editor. If multiple items match your query, a menu will be displayed. By the way, if you're a vim-user with a distaste for arrow-keys, the menu supports vim-style keybindings (yay).

```
hexo edit [title] [-a | --after MM-DD-YYYY] [-b | --before MM-DD-YYYY] [-c | --category | --categories CATEGORY] [-f | --folder SUBFOLDER] [-l | --layout] [-t | --tag | --tags TAG] [--draft | --drafts] [-g | --gui] [-p | --page | --pages]
```

### quick examples

```
hexo edit
```
--> gives you a menu with *all* your posts in descending chronological order, select one to edit using the  arrow keys or `j`/`k`

```
hexo edit search term
```
--> uses the regular expressions `search` and `term` to filter the titles (or slugs) of your articles and displays a menu with all matches -- if only one article matches, it will open automatically in your editor

```
hexo edit -a 11-11-2015 -g
```
--> gives you a menu with all posts published after 11/11/2015 -- the selected article will open in gui mode

```
hexo edit neovim -c vim
```
--> looks in the database for articles in the "vim" category which match the regular expression "neovim" in their titles or slugs

### detailed information (get this info on the command line with `hexo help edit`)

- `title` is a regular expression (case insensitive and spaces are allowed) for matching the title of a post
- `-a` or `--after` (optional) filters out all posts that were made before the given date. A little parsing is done to help you, but use `MM-DD-YYYY` for best results
- `-b` or `--before` (optional) filters out all posts that were made after the given date. A little parsing is done to help you, but use `MM-DD-YYYY` for best results
- `-c` or `--category` (optional) filters posts on category
- `-f` or `--folder` (optional) is (part of) the name of a subfolder in `hexo_dir/source` to narrow down your search in case you have multiple folders (for filtering on drafts, prefer to use `-d`)
- `-l` or `--layout` (optional) filters posts/pages with a specific layout
- `-t` or `--tag` (optional) filters posts on tag
- `--draft` or `--drafts` (optional) excludes all published posts
- `-g` or `--gui` (optional) causes selected files to open using an associated GUI editor, rather than a terminal editor set in the $EDITOR environment variable
- `-p` or `--page` (optional) selects pages instead of posts


*Note: boolean options can be combined (for example `hexo edit -dp` to search for drafts that are pages)*

*Note: Drafts only appear in searches without the `--drafts` option if you have `render_drafts` set to true in `_config.yml`. If set to false, you **must** use the `--draft` option to filter on drafts. Also, drafts are excluded automatically when you use any of the date filters, because dates makes little sense with drafts.*

*Note: Filter on title first and use boolean options last or you may get unexpected results. For example, `hexo edit -g my post` will filter just on "post" whereas `hexo edit my draft -g` will correctly filter on "my draft".*

*Note: By default, files open in your current terminal window using your `$EDITOR` environment variable. Set it in your dotfiles (`.bashrc` or `.zshrc` are good examples, and don't forget to source the file before testing). The `gui` option (or the lack of an `$EDITOR` variable) will cause files to open with `xdg-open` (linux, osx) or `start` (windows) instead.*

## rename command

Rename a post, page or draft. The title and the filename can be renamed independently or both at the same time.

![example](./docs/rename.png)

```
hexo rename <old title/slug> <-n | --new "new title">
```

`old title/slug` is one or more regular expressions to find a post or page. If more match your regex, a selection menu will be displayed.

`new title` is the new title for your post. In case you just want to rename the file, it will be `slugize`d automatically (ie it will get converted to lower case, and all special characters and spaces will be made url-friendly).

After selecting a file, you will be presented with another menu. From there you can choose whether to rename the filename, the title of the post, both, or cancel altogether.

*Note: if you have set `render_drafts` to false in `_config.yml`, you won't be able to rename drafts from the command line. It works only with that setting set to true or if you publish the post first.*

*Note: wrap the new title in single or double quotes! If you forget, the presence of spaces or special characters may cause strange behavior.*


## remove command

Delete a post.

![example](./docs/remove.png)

```
hexo remove <search terms>
```

Search for a post and delete it after confirmation. This will cause the irreversible removal of the selected post *and* its associated asset folder (if it exists), along with all its contents.

## isolate command

Isolate a post by temporarily removing all others from the build process.

```
hexo isolate <search terms> [-a | --all]
```

This command was inspired by Octopress. For testing purposes, you may want to isolate a post so you can work on it and test it in isolation from all others. This accomplishes that aim by moving all posts and asset directories (pages are not supported right now) to an `_exile` subfolder, where they will be ignored.

The `-a` or `--all` option will cause *all* posts to be moved, and your search terms to be ignored.

Run `hexo integrate` to restore the posts to their previous location.

## integrate command

Restores all exiled posts.

```
hexo integrate
```

## Info

- It doesn't matter where in the hexo directory you are on the command line. As long as you are inside a hexo directory somewhere, the commands should work.

- Installing this plugin will also cause any new post you create with `hexo new ...` to open automatically in your text editor.

- The terminal menu may not work as expected in the default Windows command shell (`cmd.exe`), but it should work just fine in more powerful shells.

- If you don't like the command-line centric workflow this plugin encourages, you may want to consider using an administration plugin instead - check out [hexo-admin](https://github.com/jaredly/hexo-admin) or [hexo-hey](https://github.com/nihgwu/hexo-hey).

- Filter on title first and use boolean options last or you may get unexpected results. For example, `hexo edit -g my post` will filter just on "post" whereas `hexo edit my draft -g` will correctly filter on "my draft".

- By default, files open in your current terminal window using your `EDITOR` environment variable. Set it somewhere in your dotfiles (`.bashrc` or `.zshrc` are good locations, and don't forget to source the file or reboot before testing). If `$EDITOR` doesn't exist, or if you use the `gui` option, files will open with `xdg-open` (linux, osx) or `start` (windows) instead.
