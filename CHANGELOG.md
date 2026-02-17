# CHANGELOG

### Update

## [4.0.1] - 2026-02-17

### Bug Fixes

- **contentBitrate Calculation:** Updated `contentBitrate` to use measured average throughput via `getAverageThroughput()` instead of manifest bandwidth. This provides more accurate real-time bitrate measurements representing actual content consumption rate during playback. Falls back to manifest bitrate if throughput measurement is unavailable.

## [4.0.0] - 2025-07-28

### Changed

- **Standalone Agent:** This tracker now operates independently with its own authorization details, removing the dependency on a browser agent.

## [3.1.0] - 2025-05-27

### Enhancements

- **Publishing to npm:** The package can now be published to npm, making it easily accessible.

### Build

- **Distribution Formats:** Added `cjs`, `esm`, and `umd` builds to the `dist` folder, ensuring compatibility with CommonJS, ES Modules, and UMD module formats.

## [3.0.0] - 2024/01/22

- Updated the Dash.js Tracker to support new event types: VideoAction, VideoAdAction, VideoErrorAction, and VideoCustomAction.

## [0.2.0] - 2024/12/02

### Update

- attributes added [playerName, playerVersion, instrumntaionProvider,instrumntaionVersion, instrumntaionName]

## [0.1.0] -

- First Version
