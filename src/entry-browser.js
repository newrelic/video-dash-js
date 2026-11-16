import DashTracker from './tracker';
import DaiTracker from './ads/dai';
import forwardDaiMetadata from './ads/forwardDaiMetadata';

/**
 * Browser-only entry for the `/browser` webpack build.
 *
 * Reaches `tracker.js` only — `vegaTracker.js` is unreachable from this
 * entry's import graph, so the connected-device chain is dropped at the
 * module-resolution layer. Combined with the webpack `resolve.alias` that
 * rewires `@newrelic/video-core` -> `@newrelic/video-core/browser` for this
 * build, the resulting bundle contains only the Browser pipeline.
 *
 * The DAI pieces belong here rather than only in `index.js` because
 * `ima3_dai.js` is browser-only. They are attached as statics for the same
 * reason as in `index.js`: the UMD build exports only the default.
 */
DashTracker.DaiTracker = DaiTracker;
DashTracker.forwardDaiMetadata = forwardDaiMetadata;

export { default as DashTracker } from './tracker';
export { DaiTracker, forwardDaiMetadata };
export default DashTracker;
