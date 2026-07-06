import { version } from '../package.json';
import { getRegisteredHarvester } from '@newrelic/video-core';
import DashTracker from './tracker';

/**
 * VegaTracker — Dash.js tracker for the Amazon Vega SDK
 * (Kepler / Fire TV class devices).
 *
 * Structurally identical to DashTracker with one extra step: injects
 * `src: 'Vega'` via the `super` spread. That single field flows through:
 *   (a) `VideoTracker.setOptions` -> `this._src` -> `getAttributes`
 *       -> `att.src = 'Vega'` on every event.
 *   (b) `Core.addTracker` -> `setVideoConfig(info, config, 'Vega')`
 *       -> Vega-side global setup in `@newrelic/video-core`.
 *
 * The harvester is owned by `@newrelic/video-core/connectedDeviceAgent.js` as a
 * module singleton — this class never constructs or touches a harvester directly.
 * Routing decisions happen inside `recordEvent.js` based on `att.src`.
 *
 * @example
 * import { VegaTracker } from '@newrelic/video-dash/vega';
 *
 * const tracker = new VegaTracker(dashPlayer, {
 *   info: {
 *     accountId: '<NR account id>',
 *     applicationToken: '<NR app token>',
 *     endpoint: 'US' // 'US' | 'EU' | 'staging'
 *   },
 *   config: {
 *     qoeAggregate: true,
 *     qoeIntervalFactor: 5
 *   }
 * });
 */
export default class VegaTracker extends DashTracker {
  constructor(player, options) {
    super(player, { ...options, src: 'Vega' });
  }

  /**
   * Override the inherited `getHarvester()` (which returns the Browser
   * harvester) with the Vega harvester. Drives `videotracker.js`'s QoE-drain
   * wiring through the connected-device pipeline.
   */
  getHarvester() {
    return getRegisteredHarvester('Vega');
  }

  getTrackerName() {
    return 'dash';
  }

  getTrackerVersion() {
    return version;
  }

  getAttributes(att, eventType) {
    att = super.getAttributes(att, eventType);
    delete att.pageUrl;
    delete att.isBackgroundEvent;
    return att;
  }
}
