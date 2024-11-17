## Backstage GitHub Discussions Fetcher

This package was created to convert the output of [`github-discussions-fetcher`](../github-discussions-fetcher/README.md) into an async interable so that it can be used in a [Backstage search collator](https://backstage.io/docs/features/search/collators).

### Development

This project was written using [Deno](https://deno.com/).

To start the querying workflow, run the following comand:

```sh
deno task dev
```

> This package requires that you have [`GITHUB_TOKEN`](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) configured in your local environment to authenticate with GitHub.
