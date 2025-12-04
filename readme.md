# nota

local clinical note annotation tool. all data stays on your machine.

## quick start

```bash
cd nota
bun install
bun dev
```

opens at http://localhost:3000

## features

- annotate: highlight text and tag with questions
- review: see annotations grouped by question
- format: clean up raw clinical notes with before/after preview
- share: export full session (notes + annotations) to share with others
- settings: customize questions, colors, hotkeys
- auto-save: state persists in browser storage

## keyboard shortcuts

| key | action |
|-----|--------|
| 1-0 | tag selection with question |
| left/right | prev/next note |
| tab | cycle modes |

## sharing sessions

to share your work with someone else:

1. export > share full session
2. send them the .json file
3. they import > load shared session
4. they get your exact notes, annotations, and question config

## desktop app

to build a standalone desktop app (requires rust):

```bash
# install rust if needed
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# install tauri cli
bun add -D @tauri-apps/cli

# build for your platform
bun run tauri:build
```

builds will be in `src-tauri/target/release/bundle/`

- windows: `.msi` or `.exe`
- macos: `.dmg` or `.app`
- linux: `.deb`, `.AppImage`, or `.rpm`

## data format

input: json, jsonl, or txt files

output:
- annotations.json: full data for code
- annotations.csv: flat table for analysis
- session.json: shareable bundle with notes + annotations

## privacy

all data stays in browser localstorage. nothing sent externally. safe for phi.

the desktop app is fully offline with no network access.
