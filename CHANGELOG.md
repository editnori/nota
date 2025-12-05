# Changelog

All notable changes to Nota are documented in this file.

## [0.5.60] - 2025-12-05

### Polish: Windows Installer Icons
- **Fixed NSIS installer images** - Proper dimensions for header and sidebar
  - `nsis-header.png`: 150×57 pixels (was using wrong 128x128)
  - `nsis-sidebar.png`: 164×314 pixels (was using wrong 128x128)
  - This fixes the horizontal scroll issue in the Windows installer wizard
- **Generated all missing PNG icons** - Full icon set from SVG source
  - 16×16, 32×32, 48×48, 64×64, 128×128, 256×256, 512×512
  - 128×128@2x (Retina)
  - All icons now consistent from single SVG source
- **Added icon generation script** - `scripts/generate-icons.mjs`
  - Regenerate icons anytime with `node scripts/generate-icons.mjs`
  - Uses sharp for high-quality SVG→PNG conversion
- **NSIS config improvements**:
  - `installMode: "currentUser"` - No admin required
  - `displayLanguageSelector: false` - Cleaner install experience

## [0.5.59] - 2025-12-05

### UX Improvement: Consistent Drag-Drop Behavior
- **Drag-drop now works the same everywhere** - Always auto-formats and imports
  - No more confusion about different behaviors in different tabs
  - Drop files anywhere → auto-format → import with loading spinner
- **Format tab simplified** - Now purely a comparison tool
  - Renamed to "Format Comparison"
  - Primary purpose: "Compare Notes" to see original vs formatted side-by-side
  - Secondary: "Format & Preview Files" for batch download workflow
  - Removed redundant drag-drop handling (global handler covers all)
- **Fixed: Format tab preserves rawText** - Notes loaded via "Load to Annotator" now keep original text for comparison

## [0.5.58] - 2025-12-05

### Bug Fixes (Clear & Import State Issues)
- **Fixed: Empty state after "Clear Everything"** - UI now shows loading state during async clear operation
  - `clearSession` sets `isLoaded: false` before clearing, then `true` after
  - Added small delay (50ms) to ensure storage is fully cleared before state reset
  - React now properly detects state change and re-renders
- **Fixed: Empty state after file import in Tauri** - Improved state synchronization
  - Added `requestAnimationFrame` before timeout to ensure React has re-rendered
  - Increased timeout from 600ms to 800ms for state to fully settle
  - Fixed in both drag-drop import (`App.tsx`) and button import (`Header.tsx`)
- **Fixed: `setNotes` not clearing filters** - Now resets `filteredNoteIds` and `highlightedAnnotation`
- **Fixed: NotesList stale state** - Effect now watches full `notes` array, not just length

### Technical Details
- `clearSession`: Now properly sequences `isLoaded` → storage clear → state reset → `isLoaded`
- Import handlers: Use `requestAnimationFrame(() => setTimeout(...))` pattern for reliable UI sync
- All session import paths fixed with consistent timing

## [0.5.43] - 2025-12-04

### Performance (Instant Annotations)
- **Incremental index updates** - O(1) instead of O(n) for annotation changes
  - `addToIndexes()` - adds single annotation without rebuilding
  - `removeFromIndexes()` - removes without full rebuild
  - `updateInIndexes()` - updates in place
- **Annotation creation now instant** - no more 200ms delay between highlights
- **Non-blocking save** - `JSON.stringify` now runs in microtask via `setTimeout(0)`
- **Dynamic debounce** - rapid annotation (< 1s apart) delays save to 2s, preventing lag
  - Normal annotation uses 500ms debounce
  - `requestIdleCallback` timeout increased to 5s for smoother background saves

### Bug Fixes
- **Fixed: Drag-drop not working** - Now uses window-level drag events for reliable capture
  - Shows overlay immediately when dragging files/folders over window
  - Works regardless of which component is focused
- **Fixed: Clear all weird state** - NotesList now resets all local state when notes cleared
  - Resets page, search, filters when notes.length === 0
  - Fixed useMemo side effect bug (was using useMemo to call setPage)
- **Fixed: Need refresh after clear** - Proper state cleanup now triggers re-render

## [0.5.42] - 2025-12-04

### Bug Fixes & Polish
- **Fixed: Clear all blank screen** - Now resets `filteredNoteIds` and `highlightedAnnotation`
- **Fixed: Import lag** - Shows loading indicator immediately, small delay for UI update
- **Custom confirm dialogs** - Beautiful modal instead of ugly browser `confirm()`
  - Danger variant (red) for destructive actions
  - Warning variant (amber) for clearing actions
- **Session import fixed** - Now properly rebuilds annotation indexes
- **No more browser alerts** - All feedback uses the import overlay

### Testing
- Updated test suite with 141 tests covering:
  - Performance optimizations
  - Smart Filter
  - Span editing
  - Overlap handling
  - Confirm dialogs
  - Clear session
  - Import UX
  - Annotation navigation

### New Component
- `ConfirmModal` - Reusable confirmation dialog with variants

## [0.5.41] - 2025-12-04

### Performance (save optimization)
- **Fixed stale state bug**: Save was using old state reference from 500ms ago
  - Now gets fresh state when actually saving
- **Added change detection**: Only saves when data actually changed
  - Uses quick hash to detect changes
  - Navigating between notes no longer triggers full 30k note save
- **Reduced unnecessary saves**: Skip save if hash matches last saved state

## [0.5.40] - 2025-12-04

### Performance (critical rendering fix)
- **DocumentView optimization**: 
  - Was re-rendering on ANY annotation change across all notes
  - Now uses `useMemo` with note-specific dependencies
  - Only re-renders when current note's annotations change
- **hasUnannotated O(1)**: Simple size comparison instead of O(30k) iteration
- **Fixed loading screen hang**: Changed from `useCallback` inside `useStore()` to stable `useMemo` pattern
- **All components optimized**: NotesList, AnnotationList, Header use individual selectors

This is the **KEY FIX** for 30k+ note performance - components no longer re-render 
on every annotation change. Annotation should now be instant.

## [0.0.38] - 2025-12-04

### Performance (final unbiased audit)
- annotationsById index: O(1) lookup by annotation ID
- Single set() calls: Combined state + lastSaved updates
- exportJSON optimized: Single pass through annotations
- buildAnnotationIndexes: Builds both byNote and byId in one pass

## [0.0.37] - 2025-12-04

### Performance (comprehensive audit)
- ReviewView counts memoized
- NotesList jumpToCurrent O(1)
- Questions cached with Map lookups
- Storage saves non-blocking

## [0.0.36] - 2025-12-04

### Performance (DocumentView optimization)
- DocumentView uses indexed lookups
- Memoized segment building
- All handlers use Map.get()

## [0.0.35] - 2025-12-04

### Performance (continued 30k+ optimization)
- Annotation index by note: `annotationsByNote` Map
- `getAnnotationsForNote(noteId)` for instant access
- Index auto-maintained on CRUD
- AnnotationList uses indexed data

## [0.0.34] - 2025-12-04

### Performance (30k+ notes optimization)
- O(1) note lookups via `noteIndexMap`
- Memoized NoteItem component
- Precomputed type counts
- Bulk operation flag for imports
- Increased save debounce to 500ms
- Single-loop annotation counting
- ReviewView uses noteIndexMap

## [0.0.33] - 2025-12-04

### Fixed
- Drag-drop folders
- Delete non-matching in Smart Filter

## [0.0.32] - 2025-12-04

### Fixed
- Windows installer icon (all PNG sizes + NSIS config)

## [0.0.31] - 2025-12-04

### Added
- Delete button in question popup

## [0.0.30] - 2025-12-04

### Fixed
- Overlap popup works (justOpenedPopupRef flag)
- Question toggle buttons stable size

## [0.0.29] - 2025-12-04

### Fixed
- (Attempted overlap fix - didn't fully work)

## [0.0.28] - 2025-12-04

### Added
- Merge option (extend + add question)
- Adjacent span detection

## [0.0.27] - 2025-12-04

### Fixed
- Question toggle popup position stable (uses ref)

## [0.0.26] - 2025-12-04

### Improved
- Three-way overlap handling (Extend/Overlap/Cancel)
- Styled popup instead of browser confirm()

## [0.0.25] - 2025-12-04

### Added
- Click-and-drag span editing (select text while editor open)
- Overlap detection with extend option
- -5/+5 buttons in span editor

## [0.0.24] - 2025-12-04

### Added
- Toggle questions on span popup (add/remove with click)
- Span editor via double-click

## [0.0.23] - 2025-12-04

### Added
- Annotation navigation in sidebar (click to jump, prev/next buttons)

## [0.0.22] - 2025-12-04

### Fixed
- Smart Filter persists across tabs

## [0.0.21] - 2025-12-04

### Fixed
- Auto-tag now includes question (not empty array)
- Smart Filter selections persist in localStorage

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
