import nrvideo from '@newrelic/video-core';
import { version } from '../../package.json';

/**
 * Tracks Google IMA DAI (server-side stitched) ad breaks for a dash.js stream.
 *
 * Attach it to the content tracker with `dashTracker.setAdsTracker(daiTracker)` —
 * that sets isAd()/parentTracker and funnels these events into the content
 * session as VideoAdAction. Never register this tracker with Core directly.
 *
 * This tracker contains NO dash.js plumbing. It talks only to the
 * StreamManager; feeding the SDK the MPD's EventStream events is the
 * application's job, and `forwardDaiMetadata` is provided for it.
 */
export default class DaiTracker extends nrvideo.VideoTracker {
  constructor(streamManager, options) {
    super(streamManager, options);
    this.streamManager = streamManager;
    this.contentTracker = options?.contentTracker || null;
    this.currentAdData = null;
    // The ad clock, cached from AD_PROGRESS — the only event that carries it.
    // There is deliberately NO adStartStreamTime here: unlike hls.js, adPlayhead
    // comes straight from the SDK, so there is no offset to capture or rebase
    // (spec 7.7).
    this.adProgressData = null;
    this.adBreakData = null;
    this.adBreakFromPeriod = false;
    this.streamData = null;
    this.cuePoints = [];
  }

  /**
   * Drops the in-flight ad. The cached progress has to go with it, or the next
   * ad reports the previous one's playhead until its first progress tick lands.
   */
  clearCurrentAd() {
    this.currentAdData = null;
    this.adProgressData = null;
  }

  registerListeners() {
    // `typeof` first: optional chaining still throws a ReferenceError on an
    // identifier that was never declared, which is exactly the case when the
    // IMA DAI SDK script has not loaded.
    const sdk =
      typeof google === 'undefined' ? undefined : google?.ima?.dai?.api;

    if (!this.player || !sdk?.StreamEvent) {
      nrvideo.Log.warn('DaiTracker: StreamManager or DAI API not available');
      return;
    }

    const StreamEvent = sdk.StreamEvent.Type;

    this.eventHandlers = {
      [StreamEvent.LOADED]: this.onStreamLoaded.bind(this),
      [StreamEvent.STREAM_INITIALIZED]: this.onStreamInitialized.bind(this),
      [StreamEvent.ERROR]: this.onStreamError.bind(this),

      [StreamEvent.AD_BREAK_STARTED]: this.onAdBreakStarted.bind(this),
      [StreamEvent.AD_BREAK_ENDED]: this.onAdBreakEnded.bind(this),
      [StreamEvent.AD_PERIOD_STARTED]: this.onAdPeriodStarted.bind(this),
      [StreamEvent.AD_PERIOD_ENDED]: this.onAdPeriodEnded.bind(this),

      [StreamEvent.STARTED]: this.onAdStarted.bind(this),
      [StreamEvent.FIRST_QUARTILE]: this.onAdFirstQuartile.bind(this),
      [StreamEvent.MIDPOINT]: this.onAdMidpoint.bind(this),
      [StreamEvent.THIRD_QUARTILE]: this.onAdThirdQuartile.bind(this),
      [StreamEvent.COMPLETE]: this.onAdComplete.bind(this),
      [StreamEvent.SKIPPED]: this.onAdSkipped.bind(this),
      [StreamEvent.PAUSED]: this.onAdPaused.bind(this),
      [StreamEvent.RESUMED]: this.onAdResumed.bind(this),
      [StreamEvent.CLICK]: this.onAdClicked.bind(this),
      [StreamEvent.VIDEO_CLICKED]: this.onAdClicked.bind(this),

      // Cache only — see onAdProgress. Registered because it is the sole
      // carrier of StreamData.adProgressData, which is where adPlayhead comes
      // from. hls.js does not register it.
      [StreamEvent.AD_PROGRESS]: this.onAdProgress.bind(this),

      [StreamEvent.CUEPOINTS_CHANGED]: this.onCuePointsChanged.bind(this),
    };

    Object.entries(this.eventHandlers).forEach(([type, handler]) => {
      this.player.addEventListener(type, handler);
    });
  }

  unregisterListeners() {
    if (this.player && this.eventHandlers) {
      Object.entries(this.eventHandlers).forEach(([type, handler]) => {
        this.player.removeEventListener(type, handler);
      });
    }
    this.eventHandlers = null;
  }

  onStreamLoaded(event) {
    // Capture the stitched stream only. This is not an ad request: emitting one
    // here would also consume video-core's isRequested flag, which AD_START
    // depends on, and the flag is per-ad (see onAdStarted).
    this.streamData = this.extractStreamData(event);
  }

  /**
   * The only safe place to drop per-stream state. Verified live event order,
   * per stream request:
   *
   *   STREAM_INITIALIZED -> CUEPOINTS_CHANGED -> LOADED -> ... -> CUEPOINTS_CHANGED
   *
   * Cue points arrive before their own LOADED, so resetting at LOADED discards
   * the list for the stream being loaded; and they arrive again mid-stream, so
   * a "did any arrive" flag cannot tell a fresh list from a stale one either.
   * This event precedes a stream's cue points and nothing else does.
   */
  onStreamInitialized() {
    this.clearCurrentAd();
    this.adBreakData = null;
    this.adBreakFromPeriod = false;
    this.cuePoints = [];
    this.streamData = null;

    this.sendDownload({ state: 'stream-initialized' });
  }

  /**
   * StreamEvent.ERROR is predominantly stream-level — a failed stream request
   * means nothing plays at all. Because isAd() is true here, reporting it only
   * on this tracker routes it to AD_ERROR, and video-core sets
   * hadStartupError/hadPlaybackError only for non-ad trackers, so the most
   * severe failure the integration can see would never reach content error or
   * startup-failure analysis. It therefore goes to the content tracker, and
   * additionally to this one when a break is open, since the ad failed too.
   */
  onStreamError(event) {
    const errorData = this.extractErrorData(event);
    const contentTracker = this.parentTracker ?? this.contentTracker;

    if (this.adBreakData) this.sendError(errorData);

    if (contentTracker?.sendError) {
      contentTracker.sendError(errorData);
    } else if (!this.adBreakData) {
      // Nothing else to report on — better an ad error than a lost error.
      this.sendError(errorData);
    }
  }

  onAdBreakStarted(event) {
    this.adBreakData = this.extractAdBreakData(event);
    this.sendAdBreakStart(this.adBreakAttributes());
  }

  /**
   * The break's reportable attributes, built fresh each time. Never the live
   * adBreakData: video-core's getAttributes() fills and returns the very object
   * it is handed, which would turn adBreakData — and so the public
   * getCurrentAdBreak() — into the whole telemetry payload. `position` is
   * deliberately excluded; it is already published as adPosition via
   * getAdPosition().
   */
  adBreakAttributes() {
    const { adCount } = this.adBreakData ?? {};
    return adCount === undefined ? {} : { adCount };
  }

  onAdBreakEnded() {
    // An ad still in flight has to be ended first. video-core's goAdBreakEnd()
    // clears isRequested but not isStarted, and only sendEnd() resets that, so
    // leaving a started ad unfinished here blocks AD_START for every later ad
    // in the session. Happens whenever a break ends mid-ad: a seek out of a
    // mid-roll, an ad error, a source switch.
    if (this.currentAdData) {
      this.sendEnd();
      this.clearCurrentAd();
    }

    // Attributes go out here rather than at AD_BREAK_STARTED: the break's
    // details are only known once its first ad has been seen (see onAdStarted).
    this.sendAdBreakEnd(this.adBreakAttributes());
    this.adBreakData = null;
    this.adBreakFromPeriod = false;
  }

  onAdPeriodStarted(event) {
    // Bumpers and some live breaks fire only a period start, with no
    // AD_BREAK_STARTED to open the break.
    if (!this.adBreakData) {
      this.adBreakFromPeriod = true;
      this.onAdBreakStarted(event);
    }
  }

  onAdPeriodEnded() {
    // A break this tracker opened from a period event gets no AD_BREAK_ENDED —
    // that is the premise of the fallback above — so the period end is its only
    // closing path. Without this the break stays open for the rest of the
    // session and the content guard suppresses all content telemetry.
    //
    // Periods nested inside an SDK-announced break are left alone: that break
    // may still have more ads, and its own AD_BREAK_ENDED will close it.
    // Measured live ordering under ON_RECEIVE is
    // adPeriodStarted -> adBreakStarted -> ... -> adBreakEnded -> adPeriodEnded,
    // and because AD_BREAK_ENDED clears adBreakFromPeriod the trailing period
    // end finds the flag false and does not close the break a second time.
    if (this.adBreakFromPeriod) {
      this.onAdBreakEnded();
    }
  }

  // --- ad playback handlers: implemented in Task 3 -------------------------
  // Declared here so the registration map above is complete and the 19
  // subscriptions are real. Deliberate stubs, not oversights.

  onAdStarted() {}

  onAdFirstQuartile() {}

  onAdMidpoint() {}

  onAdThirdQuartile() {}

  onAdComplete() {}

  onAdSkipped() {}

  onAdPaused() {}

  onAdResumed() {}

  onAdClicked() {}

  onAdProgress() {}

  /**
   * Cue points live on StreamData — the StreamEvent has no getCuepoints(). Only
   * CUEPOINTS_CHANGED actually carries them; other events report null, so a
   * missing list leaves the known one untouched rather than clearing it.
   */
  onCuePointsChanged(event) {
    const cuePoints = this.extractCuePoints(event);
    if (cuePoints) this.cuePoints = cuePoints;
  }

  extractStreamData(event) {
    try {
      const streamData = event.getStreamData();
      // No streamType snapshot here: it is derived from the content tracker's
      // live flag, which is not reliable this early, and getStreamType() reads
      // it fresh anyway.
      return {
        streamId: streamData?.streamId,
        url: streamData?.url,
      };
    } catch (error) {
      nrvideo.Log.warn('DaiTracker: Failed to extract stream data', error);
      return {};
    }
  }

  /**
   * The DAI StreamEvent exposes no ad-break accessor (verified against the live
   * SDK: StreamEvent.prototype is only getAd / getAdUi / getCustomAdUi /
   * getStreamData), so nothing about the break is knowable at
   * AD_BREAK_STARTED. Both fields are filled from the first ad's pod info in
   * onAdStarted. Must stay non-null — DashTracker's content guard treats this
   * object as "a break is in progress".
   */
  extractAdBreakData() {
    return { adCount: undefined, position: null };
  }

  /**
   * The DAI StreamEvent has no getError(); the only diagnostic the SDK provides
   * is StreamData.errorMessage, which carries the cause and HTTP status (e.g.
   * "Stream initialization failed... HTTP status code: 404"). There is no
   * numeric code field, so none is reported rather than inventing one.
   */
  extractErrorData(event) {
    try {
      const message = event.getStreamData?.()?.errorMessage;
      if (message) return { errorMessage: this.sanitizeErrorMessage(message) };
    } catch (error) {
      nrvideo.Log.warn('DaiTracker: Failed to extract error data', error);
    }
    return { errorMessage: 'Unknown DAI error' };
  }

  /**
   * The SDK's errorMessage embeds the full DAI request URL, whose query string
   * carries identifiers — ua, uach, sid, and in real integrations ppid and
   * cust_params (observed on DASH, spec 6.9). video-core's obfuscation rules
   * are opt-in per integrator, so verbatim this would put user identifiers in
   * NRDB by default. Keep scheme, host and path, which is what makes the error
   * diagnosable, and drop the query. Capped as a backstop against an unbounded
   * message.
   *
   * The query/fragment group is optional on purpose. Requiring it made every
   * 'http://' in the message start a scan to the end of the token that then
   * failed and backtracked, which is quadratic in the message length
   * (CodeQL js/polynomial-redos). Optional, the match always succeeds at the
   * first attempt and never backtracks, so this is linear — and the output is
   * unchanged, since a URL with no query is replaced by itself.
   */
  sanitizeErrorMessage(message) {
    const MAX_LENGTH = 512;
    const stripped = String(message).replace(
      /(https?:\/\/[^\s?#]*)(?:[?#]\S*)?/g,
      '$1'
    );
    return stripped.length > MAX_LENGTH
      ? `${stripped.slice(0, MAX_LENGTH - 1)}…`
      : stripped;
  }

  extractCuePoints(event) {
    try {
      const cuepoints = event.getStreamData?.()?.cuepoints;
      if (Array.isArray(cuepoints)) return cuepoints;
    } catch (error) {
      nrvideo.Log.warn('DaiTracker: Failed to extract cue points', error);
    }
    return null;
  }

  getTrackerName() {
    return 'dai-ads';
  }

  getTrackerVersion() {
    return version;
  }

  getPlayerName() {
    return 'dash-dai';
  }

  getAdPartner() {
    return 'google-dai';
  }

  getCurrentAdBreak() {
    return this.adBreakData;
  }

  getCurrentAd() {
    return this.currentAdData;
  }

  getAdCuePoints() {
    return this.cuePoints;
  }

  getStreamData() {
    return this.streamData;
  }
}
