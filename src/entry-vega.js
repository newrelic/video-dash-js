import VegaTracker from './vegaTracker';

/**
 * Vega-only entry for the `/vega` webpack build.
 *
 * Reaches `vegaTracker.js` (and its parent `tracker.js`) only. Combined with
 * the webpack `resolve.alias` that rewires `@newrelic/video-core` ->
 * `@newrelic/video-core/vega` for this build, the resulting bundle contains
 * only the Vega pipeline — the Browser harvester chain is not reachable.
 */
export { default as VegaTracker } from './vegaTracker';
export default VegaTracker;
