# h5p git Commands

Quick reference for all `h5p git` subcommands. These run git operations across every
H5P library repository in the working directory (or just the ones you name).
Run `h5p git --help` to print this list.

---

## Branches

---

## `h5p git checkout`

Change branch for the given or all libraries.

```
h5p git checkout <branch> [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `branch` | Yes | Branch name to check out. |
| `libraries...` | No | Library names. Omit to apply to all libraries. |

---

## `h5p git new-branch`

Create a new branch (local and remote) for the given or all libraries.

```
h5p git new-branch <branch> [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `branch` | Yes | Branch name. Must not start with `h5p-`. |
| `libraries...` | No | Library names. Omit to apply to all libraries. |

---

## `h5p git rm-branch`

Remove a branch (local and remote) for the given or all libraries.

```
h5p git rm-branch <branch> [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `branch` | Yes | Branch name. Must not start with `h5p-` and must not be `master`. |
| `libraries...` | No | Library names. Omit to apply to all libraries. |

---

## `h5p git merge`

Merge a branch into the given or all libraries.

```
h5p git merge <branch> [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `branch` | Yes | Branch name to merge in. |
| `libraries...` | No | Library names. Omit to apply to all libraries. |

---

## Inspecting

---

## `h5p git status`

Show git status for the given or all libraries.

```
h5p git status [options] [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `libraries...` | No | Library names. Omit to show all libraries. |

| Option | Description |
|--------|-------------|
| `-f` | Display which branch each library is on. |

---

## `h5p git diff`

Print the combined diff for all repos.

```
h5p git diff
```

No arguments.

---

## Publishing

---

## `h5p git commit`

Commit staged changes to the given or all repos with a message.

```
h5p git commit <message> [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `message` | Yes | Commit message. Must be at least two words. |
| `libraries...` | No | Library names. Omit to commit all repos. |

---

## `h5p git pull`

Pull the given or all repos.

```
h5p git pull [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `libraries...` | No | Library names. Omit to pull all repos. |

---

## `h5p git push`

Push the given or all repos.

```
h5p git push [options] [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `libraries...` | No | Library names. Omit to push all repos. |

| Option | Description |
|--------|-------------|
| `--tags` | Push tags in addition to commits. |

---

## `h5p git tag`

Create a tag for the given or all libraries.

```
h5p git tag <tagName> [libraries...]
```

| Argument | Required | Description |
|----------|----------|-------------|
| `tagName` | Yes | Tag name. |
| `libraries...` | No | Library names. Omit to apply to all libraries. |

---
