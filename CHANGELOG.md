# Changelog

All notable changes to Nota will be documented in this file.

## [0.5.81] - 2025-12-19

### Added
- **BiLSTM Formatter v2**: New multi-task formatter model trained on 28k notes
  - 98.8% structure accuracy (vs 95.7% in v1)
  - 92.2% break accuracy (vs 88.1% in v1)
  - 11-class structure detection (headers, lists, vitals, labs, signatures, etc.)
  - 3-class break prediction (space, newline, blank_line)
  - 99,733 token vocabulary (2.6x larger than v1)

### Changed
- Updated formatter model paths to v2 (`bilstm-formatter-v2.onnx`, `bilstm-vocab-v2.json`)
- Improved vocabulary encoding with lowercase normalization
- Model now outputs both structure type and break predictions

### Technical
- Formatter model trained with LLM-annotated data (Kimi K2)
- 6 note types: Admission, Discharge, ED, Inpatient, Outpatient, Radiology

## [0.5.80] - 2025-12-18

### Added
- 4-class radiology span labeling model (POSITIVE, ANATOMY, DOSE)
- Multi-class entity detection for kidney stone findings

## [0.5.x] - Previous releases

- Initial BiLSTM formatter implementation
- Radiology span detection
- Session management and annotation UI

