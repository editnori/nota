# nota

local clinical note annotation tool. all data stays on your machine.

## quick start

```bash
cd nota
bun install
bun dev
```

opens at http://localhost:3000

## download

pre-built executables available on the [releases page](https://github.com/editnori/nota/releases):

- Windows: `nota_0.1.0_x64-setup.exe` or `nota_0.1.0_x64_en-US.msi`
- macOS: `nota_0.1.0_x64.dmg` (Intel) or `nota_0.1.0_aarch64.dmg` (Apple Silicon)
- Linux: `nota_0.1.0_amd64.deb` or `nota_0.1.0_amd64.AppImage`

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

## building from source

```bash
# install rust if needed
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# install dependencies
bun install

# run dev
bun dev

# build desktop app for your platform
bun run tauri:build
```

## data format

input: json, jsonl, or txt files

output:
- annotations.json: full data for code
- annotations.csv: flat table for analysis
- session.json: shareable bundle with notes + annotations

## privacy

all data stays in browser localstorage. nothing sent externally. safe for phi.

the desktop app is fully offline with no network access.

## citation

if you use nota in your research, please cite:

```bibtex
@software{nota2025,
  author = {Qassem, Layth M},
  title = {nota: Local Clinical Note Annotation Tool},
  year = {2025},
  url = {https://github.com/editnori/nota}
}
```

or in text:

> Qassem, L. M. (2025). nota: Local Clinical Note Annotation Tool. https://github.com/editnori/nota

## license

MIT

## author

Dr. Layth M Qassem PharmD MSACI
