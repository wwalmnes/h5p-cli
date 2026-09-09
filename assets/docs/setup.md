# Folder structure

Running commands listed in [commands.md](commands.md) results in the creation of 4 folders. The folders are created in the current working directory (the folder where you ran the command).  
- `content` holds actual content types and their assets.  
- `libraries` holds the libraries that have been set up.  
- `temp` caches the library metadata used when computing dependencies, under `temp/.metadata`. Only pinned versions are cached there: a release tag cannot change, so it is kept indefinitely. `master` and other branches are never written to disk, so `h5p setup <library>` with no version always resolves against the current state of the branch. `temp` also holds local copies of git repositories, for the repositories that cannot be read over plain HTTP (private ones, for instance); a branch checkout there is fetched forward before it is read.
- `uploads` is a temporary location used by the import and export commands.  

> [!NOTE]
> You no longer need to delete `temp` to pick up a library's new or updated dependencies — a setup that tracks `master` never reads a cached graph. Deleting it is still harmless, and reclaims the cached repositories.

# Updating libraries that are already installed

`h5p setup <library>` with no ref tracks `master`, so it also refreshes the libraries already in your `libraries` folder. It will not disturb one you are working in: a library with uncommitted changes, or one checked out on a branch other than `master`, is reported and left alone. When a pull does bring new commits, the library is rebuilt, so its build output cannot be left behind by the update.

Set `H5P_NO_UPDATES=1` to skip refreshing installed libraries entirely.

# Setup a library from a git branch

`h5p setup <library> feat/my-pr` clones **that** library at the given branch or tag. Dependencies
are taken from that ref's `library.json`.
Use this to test a pull-request branch. A release pin (`1.14` / `1.14.3`) is the other shape of the
same argument — it is not a separate flag.

# Setup a local library

1 - Create a folder for it in the `libraries` directory.  
1.1 - Remember to run `npm install` and `npm run build` from within that library folder if your library has a build flow.  
2 - Library dependencies need to be present in the `libraries` folder. Otherwise they need to be set up separately.  
Please [find a library development tutorial](https://h5p.org/library-development) for details on that topic.  
An example library which corresponds to the "Hello World" tutorial can be found in [libraries/H5P.GreetingCard-1.0](../../libraries/H5P.GreetingCard-1.0).  

# Setup a library from github

Libraries that can be automatically installed are stored in the local library registry. The registry is a json file `libraryRegistry.json`.  
Running `h5p setup <library>` may return the `unregistered library` error. This means that the local library registry is missing this library. We have to find its repository url and register it.  
As an example, run `h5p register https://github.com/otacke/h5p-portfolio` to register the `h5p-portfolio` library in the local registry.  
Run `h5p missing h5p-portfolio` to list the unregistered dependencies for `h5p-portfolio`. Then find their repository urls and register them.  
```
h5p register https://github.com/otacke/h5p-portfolio-placeholder
h5p register https://github.com/otacke/h5p-portfolio-chapter
h5p register https://github.com/otacke/h5p-editor-portfolio
```
Run `h5p missing h5p-portfolio` again to list any unregistered dependencies for the newly registered ones. And register them.  
```
h5p register https://github.com/otacke/h5p-file-for-download
h5p register https://github.com/otacke/h5p-editor-portfolio-placeholder
h5p register https://github.com/otacke/h5p-editor-portfolio-chapter
```
Run `h5p missing h5p-portfolio` again to make sure there are no other unregistered dependencies.  
Finally, run `h5p setup h5p-portfolio` to install the library and its dependencies.  
You can use the `git@github.com:otacke/h5p-portfolio.git` url format when dealing with private repositories.  

# GIT and your SSH-AGENT

If you have to setup libraries from private repositories or if you encounter the `Permission denied (publickey)` error make sure you add your public ssh key to your local ssh agent.  
It's as easy as running the two commands below.  
```
eval `ssh-agent -t 8h`
ssh-add
```
All git related commands should now work in the current session for at least 8h. Feel free to change the duration to better suit your needs. :)  
Here are some guides on how to add an ssh key to the ssh agent on [Linux](https://docs.github.com/en/enterprise-cloud@latest/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent#adding-your-ssh-key-to-the-ssh-agent), [Mac](https://docs.github.com/en/enterprise-cloud@latest/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=mac#adding-your-ssh-key-to-the-ssh-agent), [Windows](https://docs.github.com/en/enterprise-cloud@latest/authentication/connecting-to-github-with-ssh/generating-a-new-ssh-key-and-adding-it-to-the-ssh-agent?platform=windows#adding-your-ssh-key-to-the-ssh-agent).  
