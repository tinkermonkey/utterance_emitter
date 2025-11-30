# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.2.0] - 2025-11-30

### Added
- **Voice Activity Detection (VAD)**: Integrated `@ricky0123/vad-web` (Silero VAD) for machine-learning-based speech detection, significantly improving accuracy over the previous amplitude-based method.
- **Performance Monitoring**: Added `PerformanceMonitor` class to track frame processing times, CPU usage, and memory metrics.
- **Testing Utilities**: Added `AccuracyTester` for comparing VAD vs. amplitude detection and `BrowserCompatibilityTester` for verifying environment support.
- **Configuration Options**: Added `vadWorkletPath` and `enablePerformanceMonitoring` to `EmitterConfig`.
- **E2E Testing**: Added Cypress test suite for performance validation and headless browser support.

### Changed
- **Architecture**: Refactored `UtteranceEmitter` to support modular detection strategies and better extensibility.
- **Documentation**: Comprehensive updates to `README.md` and `TESTING_GUIDE.md` reflecting the new VAD capabilities.
- **Build System**: Updated build scripts and bundle size measurement tools to support ESM modules.

### Fixed
- Fixed `measure-bundle-size.js` compatibility with ESM.
- Fixed Cypress configuration for headless Chrome audio testing.
