# [4.2.0](https://github.com/newrelic/video-dash-js/compare/v4.1.2...v4.2.0) (2026-07-28)


### Bug Fixes

* Update Read Me ([cfcf7b2](https://github.com/newrelic/video-dash-js/commit/cfcf7b2ff302f93504130f443f44d549aa1ee625))
* Update terser plugin ([9f46253](https://github.com/newrelic/video-dash-js/commit/9f46253ef658fcf01345af93a751291298c5571b))
* Updated ReadME ([91b34ca](https://github.com/newrelic/video-dash-js/commit/91b34ca69363141fadb03a720894446f0c6fe56f))


### Features

* Update semantic version ([2ff734e](https://github.com/newrelic/video-dash-js/commit/2ff734ee7ecf8a296da8ee89714ecc30021d1926))
* Vega Video Monitoring support ([e621c72](https://github.com/newrelic/video-dash-js/commit/e621c7248282713efd90ba0987440dcec6a43644))

# CHANGELOG

### Update

## [4.1.2] - 2026-06-18

### Added

- **getBitrateByQualityIndex():** New method to retrieve bitrate information by quality index for both dash.js v4 and v5.

### Changed

- **onAdaptation():** Enhanced to extract and pass old and new bitrate values to `sendRenditionChanged()` for better rendition change tracking.

## [4.1.0] - 2026-03-11

### Added

- **contentManifestBitrate:** Maximum combined (video + audio) bitrate from the MPD manifest.
- **contentMeasuredBitrate:** Network bandwidth estimated by the player's ABR algorithm.
- **contentDownloadBitrate:** Effective download throughput calculated from video segment request data.

### Changed

- **contentBitrate:** Now returns video-only bitrate from the active track (excludes audio).
- **contentRenditionBitrate:** Now returns combined video + audio bandwidth of the active rendition.
- **getDashBitrate():** Fixed v4 compatibility — version check now happens before calling v5-only APIs.
- **getManifestBitrate():** Uses `getRepresentationsByType()` on v5+ and `getBitrateInfoListFor()` on v4.

### Fixed

- Removed duplicate `getPlayhead()` method definition.
- Removed `console.log` from `getTrack()` error handler.

### Documentation

- Updated DATAMODEL.md with all five bitrate attribute definitions.
- Updated README.md with QoE configuration options and bitrate metrics table.

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
