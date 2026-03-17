# H5P-CLI improvements


## Background

### Initial problems
1. Want to make changes
    * Not sure where
    * No tests to give security
    * What are the types?
2. Structure
3. Documentation
    * Some commands are documented, others are not
    * Not necessarily easiest to read (my opinion)
    * No validation on input
4. I want commands to scaffold out new projects
5. I want to be able to replicate an environment (e.g. zeppelin)



### Inspiration

Used [shadcn](https://github.com/shadcn-ui/ui), [netlify](https://github.com/netlify/cli) and [vercel cli](https://github.com/vercel/vercel).

Also read a bit on how claude cli/code works, but didn't use anything there (yet).






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