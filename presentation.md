# H5P-CLI improvements


## Background

### Initial problems
1. Want to make changes
    * Not sure where
    * No tests to give security
    * What are the types?
2. Structure
3. Documentation
    * Are all commands documented?
    * Not necessarily easiest to read (my opinion)
    * No validation on input
4. I want commands to scaffold out new projects
5. I want to be able to replicate an environment (e.g. zeppelin)
6. I want commands I can use for h5pcom, but is not open for everyone



### Inspiration

Used [shadcn](https://github.com/shadcn-ui/ui), [netlify](https://github.com/netlify/cli) and [vercel cli](https://github.com/vercel/vercel).

Also read a bit on how claude cli/code works, but didn't use anything there (yet). Read that they use Ink (react).. want to try it out :o.






## Implementation

### Groundwork for testing
Architecture change. Command -> Service -> Adapter (-> Logic). Split responsibilities, easier to test each part.

#### Responsibilities:

Command - CLI contract

Service - business logic

Adapter - Currently a weird boundary to logic/core

Logic/core - Domain logic (dependency graph traversal etc), but currently also other stuff.


### Testing
Command - Verify name and arguments/flags are passed correctly

Service - Flow control 

Adapter - (no tests, reviewing if this is necessary. Going to split up logic and then see if I should add tests)

Logic - Currently too many responsibilities: mix of pure computational functions, I/O (fs/git/http) and orchestration.

### @todo
- [WIP] Currently splitting up logic
- Rework adapter? (simplify)
    - Need to consider if we want adapters to be simple. I.e. adapter does not match 1-1 with services, it is instead GitAdapter (already have this), FileAdapter, S3Adapter etc. Note: The reason we have GitAdapter is because utils commands are basically just utility git commands.
    - Or, continue being roughly 1-1 with services so that we can do adapter replacements. This might be useful if an adapter does both e.g. uses network and file system, but you want to change one, or all, of these function calls.
- Can server be removed and be a plugin instead?
  - Rewrite assets/ (server) to typescript
- How to handle secrets?
- plugin/visual helpers for displaying information (like a table)