## GitHub Discussions Fetcher

This package was created to call GitHub to fetch all discussions, every comment in each discussion, and every reply of those comments from any GitHub repository.

### Development

This project was written using [Deno](https://deno.com/).

To start the querying workflow, run the following comand:

```sh
deno task dev
```

> This package requires that you have [`GITHUB_TOKEN`](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens) configured in your local environment to authenticate with GitHub.
