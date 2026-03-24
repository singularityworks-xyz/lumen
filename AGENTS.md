# Project guidelines:

- use bun for the package manager
- when installing new packages, use bun add instead of manually editing the package.json file
- avoid as any at all costs, try to infer types from functions as much as possible
- use tailwindcss for styling whenever possible, only resort to custom css if needed
- run bun run check to check for linting & formatting errors, and bun run check-types to check for errors after making changes