# Changelog

All notable changes to Nota are documented in this file.

## [0.0.21] - 2025-12-04

### Fixed
- **Auto-tag now includes question**: Annotations created by auto-tag now have the correct question assigned (not empty)
  - Each match tracks which question pattern found it
  - Annotation created with `questions: [m.questionId]`
  
### Added
- **Smart Filter state persistence**: Selected questions, excludes, and min length now persist to localStorage
  - Reopening Smart Filter restores your previous selections
  - Separate from pattern edits (which were already persisted)

## [0.0.20] - 2025-12-04

### Fixed
- Auto-tag crash (questionIds vs questions)
- AnnotationList null check for missing questions array

## [0.0.19] - 2025-12-04

### Fixed
- Import progress shows count only (no file names)
- Removed laggy animations

### Improved
- Smart Filter fully editable per question

## [0.0.18] - 2025-12-04

### Improved
- Smart Filter matches QuestionPicker styling
- Intelligent regex patterns for measurements (mm, cm, Fr, dimensions)
- Exclude presets for irrelevant note types

## [0.0.17] - 2025-12-04

### Fixed
- Consolidated import logic, unified progress format

## [0.0.16] - 2025-12-04

### Fixed
- Smart Filter feature completeness, auto-tag progress overlay, import progress counts

## [0.0.15] - 2025-12-04

### Improved
- **Smart Filter complete rework** - directly mapped to Ryan's 10 questions:
  - Q1: Symptoms (flank pain, hematuria, gross hematuria, bloody urine)
  - Q2: Stone Growth (interval stone growth, stones are growing)
  - Q3: Rare Disease (cystinuria, cystine, primary hyperoxaluria)
  - Q4: SDOH (social determinants of health)
  - Q5: Equipment/Devices (Fr, french, percuflex, nitinol, basket)
  - Q6: Radiology (3 mm, 3mm, 4 mm, 5mm, hydronephrosis, hydroureter)
  - Q7: Dietary Advice (water, soda, protein, salt, sodium, oxalate, spinach)
  - Q8: ER Visit (emergency department, passing a stone, renal colic)
  - Q9: Complications (post-surgery 0-30 days, readmit, infection)
  - Q10: Stone Passage (passed a stone, saw a stone pass)
- **Editable presets**: Click pencil icon to modify terms for any preset
- **Reset options**: Reset individual preset or all to defaults
- Cleaner checkbox-based selection UI
- Shows description + terms for each preset

## [0.0.14] - 2025-12-04

### Improved
- Smart Filter UI with preset chips and auto-tag option

## [0.0.13] - 2025-12-04

### Added
- **Smart Filter**: Pre-filter notes before annotating
  - 10 preset filters based on Ryan's research questions
  - Include/exclude terms, min length filter
  - Live match count preview
  - Custom preset saving

## [0.0.12] - 2025-12-04

### Improved
- **Highlight animation**: Simple border pulse indicator
  - Clean outline that pulses in opacity (like Windows taskbar attention flash)
  - No shadows or glow - just a subtle border
  - Warm terracotta color, runs until hover
  - Much cleaner and less distracting

## [0.0.11] - 2025-12-04

### Improved
- **Breathing animation**: Completely reworked highlight animation
  - Uses `filter: drop-shadow()` for GPU-accelerated smoothness
  - Continuous breathing effect until user hovers over it
  - Warm terracotta color (`rgb(194, 120, 80)`) for better visibility
  - Stops cleanly on hover, clears animation state

### Fixed
- All TypeScript errors resolved
- Removed unused variables and imports
- Fixed type issues with Tauri store API

## [0.0.10] - 2025-12-04

### Fixed
- **Clear Everything confirmation order**: Confirm dialogs now appear BEFORE any data is cleared
- **Folder drag-drop**: Now properly reads all directory entries (not just first batch)
- **Desktop app icon**: Regenerated PNG icons with proper sizes for Windows/Mac/Linux installers

### Added
- **Drop indicator overlay**: Visual feedback when dragging files over the app
- **Import progress with counts**: Shows "Processing: filename (X files)" during import
- **Comment filter in Review**: Filter annotations by "All / Has Comment / No Comment"
- **Glow animation**: Highlighted annotations now show a prominent pulsing glow effect (like Windows Ctrl+Click)
- **Smooth scroll to annotation**: When navigating from Review, document scrolls smoothly and centers the target

### Improved
- **Multi-question popup**: Now stays open until user clicks "Done", allowing multiple question additions
- **Search includes comments**: Review text search now searches annotation comments too
- **Comment indicator**: Annotations with comments show a message icon in Review mode

## [0.0.9] - 2025-12-03

### Fixed
- Auto annotations now show dashed underline in document view
- Highlight animation properly triggers when navigating from Review

### Added
- Manual/Auto filter in Review mode sidebar
- Unit test suite with 70+ organized tests covering all features
- Vitest for running tests (`bun run test`)

## [0.0.8] - 2025-12-03

### Fixed
- Search performance with 5k+ notes (debouncing + indexing)

### Improved
- Renamed "suggested" to "auto" for brevity
- Styling of auto annotations (subtle dashed borders, maple theme colors)

## [0.0.7] - 2025-12-02

### Added
- Drag-drop folder import with auto-formatting
- Note type filters in sidebar
- Pagination for notes list (50 per page)
- Search indexing for large datasets
- "Search & Tag" bulk annotation tool with preview
- Bulk match selection/deselection before tagging

### Improved
- Review mode layout simplified
- "Next" button for jumping to unannotated notes

## [0.0.6] - 2025-12-02

### Added
- Multi-question span visualization (colored dots, gradient underlines)
- Click-to-add-questions popup on existing highlights
- Explicit "Save" button for comments (no auto-save)
- "Clear suggested only" option in clear menu
- Undo/Redo support (Ctrl+Z)
- Escape key to clear selection

### Fixed
- Dark mode toggle wasn't working
- Pagination overflow on narrow windows

## [0.0.5] - 2025-12-01

### Added
- Desktop app with Tauri (Windows, macOS, Linux)
- GitHub Actions for automated builds
- Custom app icon (Nota "N" logo)
- Native file save dialogs for export
- Persistent session storage for desktop app

### Fixed
- Export in desktop app now shows file picker instead of auto-downloading

## [0.0.4] - 2025-12-01

### Added
- Share Session feature (export/import full state)
- Before/After preview in Format tab
- Settings page for customizing questions
- Auto-save indicator in header

## [0.0.3] - 2025-11-30

### Added
- Format tab for bulk note processing
- Question hotkeys (1-0 keys)
- Keyboard navigation (arrow keys, Tab)
- Note type detection from folder names

### Improved
- Color contrast for question highlights
- Persistent question selection

## [0.0.2] - 2025-11-30

### Added
- Review mode with question grouping
- Export to JSON and CSV
- Import from JSON, JSONL, TXT files
- Dark mode support

## [0.0.1] - 2025-11-29

### Initial Release
- Basic annotation interface
- 10 research questions for kidney stone disease
- Text highlighting with question tagging
- Local storage persistence
- Maple theme styling
