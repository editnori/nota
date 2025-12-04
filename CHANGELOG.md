# Changelog

All notable changes to Nota are documented in this file.

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
