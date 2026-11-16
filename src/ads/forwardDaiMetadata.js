import nrvideo from '@newrelic/video-core';

/**
 * The scheme URI Google DAI declares in the MPD's `<EventStream>`.
 *
 * Live DASH ad signalling is carried at MPD/Period level and parsed from the
 * manifest — there are no `<InbandEventStream>` tags and no in-band `emsg`
 * boxes at all. dash.js dispatches these using the scheme URI as the event
 * name.
 */
const DAI_SCHEME_ID_URI = 'urn:google:dai:2018';

/**
 * The measured value of `EVENT_MODE_ON_RECEIVE`. Used only as a fallback when
 * the dash.js global is not reachable — this file must not import dash.js,
 * which stays consumer-provided.
 */
const EVENT_MODE_ON_RECEIVE = 'eventModeOnReceive';

function resolveOnReceiveMode() {
  // `typeof` first: optional chaining still throws a ReferenceError on an
  // identifier that was never declared, which is the case when dash.js is
  // loaded as a module rather than a global.
  const mode =
    typeof dashjs === 'undefined'
      ? undefined
      : dashjs?.MediaPlayer?.events?.EVENT_MODE_ON_RECEIVE;

  return typeof mode === 'string' && mode ? mode : EVENT_MODE_ON_RECEIVE;
}

/**
 * Forwards the MPD's DAI `EventStream` events into the IMA DAI SDK.
 *
 * **Live DASH reports no ad events at all without this.** Measured: the same
 * stream with nothing forwarded produced `streamInitialized` and `loaded` and
 * no ad events across 55s; with forwarding it produced three full ad breaks.
 * On VOD it is harmless — cue points carry the breaks — so register it
 * unconditionally and keep one integration snippet rather than two.
 *
 * Forwarding is the application's responsibility, not the library's: the
 * tracker never calls this and does not depend on it. But three things on that
 * one line are easy to get wrong and silently wrong, which is why it ships:
 *
 *  1. Registering **both** event modes. That hands the SDK every event twice
 *     and doubles every `AD_QUARTILE` reaching New Relic — measured at 126
 *     events per mode, with all 14 distinct ids in both. `video-core`'s
 *     `sendAdQuartile` does no de-duplication, and the tracker's in-flight gate
 *     cannot catch it because an ad genuinely *is* in flight both times. This
 *     helper subscribes in exactly one mode, so an integrator using it cannot
 *     hit the problem.
 *  2. The payload is **wrapped**. dash.js hands the handler `{ event, type }`,
 *     so `e.messageData` is `undefined`. Forwarding that calls
 *     `processMetadata` with no data and not one ad event ever fires, which
 *     looks exactly like not forwarding at all.
 *  3. `presentationTimeDelta` was `null` on every event measured. The usable
 *     timestamp is `calculatedPresentationTime`.
 *
 * `ON_RECEIVE` rather than `ON_START` because `processMetadata` takes an
 * explicit timestamp and can schedule the event itself, so the SDK does not
 * need delivery at the moment the event applies. The SDK announces
 * `AD_BREAK_STARTED` only once playback has entered the ad — expected SSAI
 * behaviour, since on live it cannot know about a break before its metadata
 * arrives — so handing it data as early as possible is the only lever
 * available.
 *
 * @param {object} player        A dash.js MediaPlayer, already initialized.
 * @param {object} streamManager A google.ima.dai.api.StreamManager.
 * @returns {() => void} Removes the subscription. Safe to call more than once.
 */
export default function forwardDaiMetadata(player, streamManager) {
  const noop = () => {};

  if (typeof player?.on !== 'function') {
    nrvideo.Log.warn(
      'forwardDaiMetadata: no dash.js player to subscribe to; DAI ad events will not be reported on live streams'
    );
    return noop;
  }

  if (typeof streamManager?.processMetadata !== 'function') {
    nrvideo.Log.warn(
      'forwardDaiMetadata: no StreamManager to forward to; DAI ad events will not be reported on live streams'
    );
    return noop;
  }

  const mode = resolveOnReceiveMode();
  // dash.js matches type, listener AND scope when removing a listener, so the
  // scope passed here has to be the same value the disposer passes back.
  const scope = null;

  const handler = (event) => {
    // See (2) above: the payload is on `.event`. The `?? event` arm costs one
    // expression and keeps this working against a dash.js that does not wrap.
    const payload = event?.event ?? event;

    try {
      streamManager.processMetadata(
        DAI_SCHEME_ID_URI,
        payload?.messageData,
        payload?.calculatedPresentationTime
      );
    } catch (error) {
      // This runs inside dash.js's event dispatch, so it must not throw into
      // the host page.
      nrvideo.Log.warn('forwardDaiMetadata: processMetadata failed', error);
    }
  };

  player.on(DAI_SCHEME_ID_URI, handler, scope, { mode });

  return () => {
    try {
      player.off(DAI_SCHEME_ID_URI, handler, scope);
    } catch (error) {
      nrvideo.Log.warn('forwardDaiMetadata: failed to remove listener', error);
    }
  };
}

export { DAI_SCHEME_ID_URI, EVENT_MODE_ON_RECEIVE };
