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

    /**
     * Every handler runs inside the IMA DAI SDK's own event dispatch, so an
     * exception escaping one does not just lose an event — it reaches the SDK,
     * which aborts the stream request and emits an empty ERROR. Observed
     * against the live asset: nothing played at all.
     *
     * The specific cause found was a dash.js getter throwing a bare string
     * before a source was attached, and that is fixed in DashTracker. This
     * contains the whole class: the thrown value came from a third-party player
     * via video-core's attribute collection, so the next such throw would break
     * the customer's playback the same way. A telemetry library must never take
     * the stream down with it.
     */
    const guard = (type, handler) => (event) => {
      try {
        handler(event);
      } catch (error) {
        nrvideo.Log.error(`DaiTracker: handler for '${type}' failed`, error);
      }
    };

    const handlers = {
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

    // Store the GUARDED references, so unregisterListeners removes the same
    // functions that were registered.
    this.eventHandlers = Object.fromEntries(
      Object.entries(handlers).map(([type, handler]) => [
        type,
        guard(type, handler),
      ])
    );

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

  onAdStarted(event) {
    this.currentAdData = this.extractAdData(event);
    // No stream-time capture here. adPlayhead comes from the SDK's own
    // adProgressData (spec 7.7), so unlike hls.js there is no offset to take.

    // AD_BREAK_STARTED carries no break information at all, so backfill it from
    // the first ad's pod info now that one exists.
    if (this.adBreakData) {
      if (this.adBreakData.position == null) {
        this.adBreakData.position = this.currentAdData.position;
      }
      if (
        this.adBreakData.adCount === undefined &&
        this.currentAdData.adCount !== undefined
      ) {
        this.adBreakData.adCount = this.currentAdData.adCount;
      }
    }

    // Each ad needs its own request: video-core gates AD_START on
    // state.isRequested and clears it on both AD_END and AD_BREAK_END, so
    // without this only the session's first ad would ever report a start.
    this.sendRequest();
    this.sendStart();
  }

  /**
   * Quartiles and clicks only mean something for an ad we are tracking. Joining
   * a live stream mid-break, the SDK reports quartiles for an ad whose STARTED
   * never reached us — measured on the live asset, this is the FIRST thing that
   * happens on a live join: midpoint, thirdquartile and complete arrived with
   * no started at all (spec 7.3). Those carry no ad identity, and counting them
   * makes quartiles outnumber ad starts, which breaks completion-rate funnels.
   */
  hasAdInFlight() {
    return this.currentAdData != null;
  }

  onAdFirstQuartile() {
    if (!this.hasAdInFlight()) return;
    this.sendAdQuartile({ quartile: 1 });
  }

  onAdMidpoint() {
    if (!this.hasAdInFlight()) return;
    this.sendAdQuartile({ quartile: 2 });
  }

  onAdThirdQuartile() {
    if (!this.hasAdInFlight()) return;
    this.sendAdQuartile({ quartile: 3 });
  }

  onAdComplete() {
    this.sendEnd();
    this.clearCurrentAd();
  }

  onAdSkipped() {
    this.sendEnd({ skipped: true });
    this.clearCurrentAd();
  }

  onAdPaused() {
    this.sendPause();
  }

  onAdResumed() {
    this.sendResume();
  }

  onAdClicked() {
    if (!this.hasAdInFlight()) return;
    // Omit url rather than send a known null: video-core warns when the key is
    // absent-or-falsy, and the DAI Ad object exposes no clickthrough accessor,
    // so a null would log that warning on every click.
    const url = this.getClickThroughUrl();
    this.sendAdClick(url ? { url } : {});
  }

  /**
   * Cache only — this handler must contain no `send*` of any kind.
   *
   * AD_PROGRESS fires ~4 times a second (measured: 42 events in one 50s live
   * break, 274 in five minutes), so emitting it would flood NRDB. But it is the
   * only event carrying StreamData.adProgressData, which is where adPlayhead
   * comes from, so it has to be registered and stored (spec 6.6, 7.7).
   */
  onAdProgress(event) {
    try {
      const data = event?.getStreamData?.()?.adProgressData;
      if (data) this.adProgressData = data;
    } catch (error) {
      nrvideo.Log.warn('DaiTracker: Failed to read ad progress', error);
    }
  }

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

  extractAdData(event) {
    let ad;
    try {
      ad = event.getAd();
    } catch (error) {
      nrvideo.Log.warn('DaiTracker: Failed to extract ad data', error);
      return {};
    }

    // Read each accessor independently. The IMA Ad surface varies by creative
    // and SDK version — notably it defines no getClickThroughUrl at all — and
    // one missing method must not discard the attributes that did resolve.
    const read = (name) => {
      try {
        return typeof ad?.[name] === 'function' ? ad[name]() : undefined;
      } catch (error) {
        nrvideo.Log.warn(`DaiTracker: ad.${name}() failed`, error);
        return undefined;
      }
    };

    return {
      adId: read('getAdId'),
      creativeId: read('getCreativeId'),
      duration: read('getDuration'),
      title: read('getTitle'),
      description: read('getDescription'),
      advertiserName: read('getAdvertiserName'),
      dealId: read('getDealId'),
      wrapperAdIds: read('getWrapperAdIds'),
      // Absent from today's DAI Ad object; read defensively so a future SDK
      // that adds it is picked up without another change here.
      clickThroughUrl: read('getClickThroughUrl'),
      position: this.extractAdPosition(ad),
      adCount: this.extractPodTotalAds(ad),
    };
  }

  extractPodTotalAds(ad) {
    try {
      const total = ad?.getAdPodInfo?.()?.getTotalAds?.();
      return typeof total === 'number' ? total : undefined;
    } catch (error) {
      nrvideo.Log.warn('DaiTracker: Failed to read ad pod size', error);
      return undefined;
    }
  }

  /**
   * Ad position from IMA's pod index, which is authoritative: podIndex 0 is a
   * pre-roll, -1 a post-roll, anything else a mid-roll. Playback time cannot be
   * used — under SSAI the ad itself advances the stitched stream's clock, so a
   * time-based guess reclassifies a long pre-roll as a mid-roll partway in.
   *
   * Never `adProgressData.adPosition` or `AdPodInfo.getAdPosition()`: both are
   * the 1-based index of the ad WITHIN its pod and are a different quantity.
   * Measured, a numeric mapping fails in both directions — live one break of 3
   * ads gives 1,2,3 where ours must be mid,mid,mid; VOD 5 breaks of 1 ad give
   * 1,1,1,1,1 where ours must be pre,mid,mid,mid,post (spec 7.7.1).
   *
   * On live, podIndex is a large monotonic identifier (measured 2969997), so
   * podIndex === 0 never matches and every live ad maps to 'mid'. Correct for
   * this customer, who serves mid-rolls only on live (spec 6.7).
   */
  extractAdPosition(ad) {
    try {
      const podIndex = ad?.getAdPodInfo?.()?.getPodIndex?.();
      if (podIndex === 0) return 'pre';
      if (podIndex === -1) return 'post';
      if (typeof podIndex === 'number') return 'mid';
    } catch (error) {
      nrvideo.Log.warn('DaiTracker: Failed to read ad pod info', error);
    }
    return null;
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

  /**
   * Under SSAI the player rendering the ad IS dash.js, and the content tracker
   * already derives its version from `player.getVersion()`, so reporting
   * 'unknown' would throw away information we hold.
   *
   * This is a deliberate divergence from hls.js, which hardcodes 'unknown'
   * because the DAI SDK exposes no version of its own. It is a better value in
   * the same attribute, not a data-model change (spec 7.8). Do not "restore
   * parity" by reverting it.
   */
  getPlayerVersion() {
    return this.contentTracker?.getPlayerVersion?.() ?? 'unknown';
  }

  getSrc() {
    return this.streamData?.url ?? null;
  }

  getVideoId() {
    return this.currentAdData?.adId ?? null;
  }

  getAdCreativeId() {
    return this.currentAdData?.creativeId ?? null;
  }

  getTitle() {
    return this.currentAdData?.title ?? null;
  }

  /**
   * The ad's length in ms, from `ad.getDuration()` — NOT
   * `adProgressData.duration` (spec 7.7.2).
   *
   * Both are available: measured 10 and 9.976 for the same ad. This one wins
   * because it is known from AD_START, before any progress tick, and stays
   * constant for the whole ad. A duration that changes mid-ad invites distrust
   * of the whole dataset.
   *
   * Accepted consequence: adPlayhead tops out near 9.976s while this reports
   * 10000ms, so adPlayhead / adDuration caps at about 99.76% and a condition
   * written `adPlayhead >= adDuration` never fires. Measure ad completion from
   * AD_END or the third quartile.
   */
  getDuration() {
    const duration = this.currentAdData?.duration;
    return duration === undefined || duration === null ? null : duration * 1000;
  }

  getClickThroughUrl() {
    return this.currentAdData?.clickThroughUrl ?? null;
  }

  /**
   * 'live', 'vod', or null when unknown.
   *
   * Comes from the content tracker, which reads dash.js's `isDynamic()`. A DAI
   * live stream's duration is a finite DVR window rather than Infinity
   * (measured: 60), so a duration-based test reported every live stream as VOD.
   * StreamData carries no stream type of its own to consult.
   */
  getStreamType() {
    const live = this.contentTracker?.isLive?.();
    if (typeof live === 'boolean') return live ? 'live' : 'vod';
    return null;
  }

  isLiveStream() {
    return this.getStreamType() === 'live';
  }

  isMuted() {
    return this.tag?.muted;
  }

  // The stitched stream is decoded by the same dash.js instance during ads, so
  // all quality data lives on the content tracker, not the StreamManager. This
  // also inherits DashTracker's existing dash.js 4-vs-5 branching for free.
  getBitrate() {
    return this.contentTracker?.getBitrate?.() ?? null;
  }

  getRenditionBitrate() {
    return this.contentTracker?.getBitrate?.() ?? null;
  }

  getRenditionHeight() {
    return this.contentTracker?.getRenditionHeight?.() ?? null;
  }

  getRenditionWidth() {
    return this.contentTracker?.getRenditionWidth?.() ?? null;
  }

  getRenditionName() {
    return this.contentTracker?.getRenditionName?.() ?? null;
  }

  /**
   * adPlayhead, in ms: the SDK's own ad-relative clock while an ad is on
   * screen, and the stitched stream clock otherwise.
   *
   * `adProgressData.currentTime` is ad-relative and starts at 0 — measured
   * climbing 0.267 -> 0.531 -> 0.797 across one ad — which is exactly what
   * adPlayhead means. There is no offset field and no per-ad rebasing: unlike
   * hls.js, nothing is subtracted (spec 7.7).
   *
   * Returns 0 for an ad in flight whose first progress tick has not arrived,
   * which is the correct value at that moment and, crucially, not the stitched
   * stream position.
   */
  getPlayhead() {
    if (this.hasAdInFlight()) {
      const currentTime = this.adProgressData?.currentTime;
      return typeof currentTime === 'number' ? currentTime * 1000 : 0;
    }
    return this.getStreamTimeMs();
  }

  /**
   * The stitched stream's own clock, in ms — the timeline cue points and the
   * SDK's time conversions are expressed in. Anything comparing against DAI
   * stream positions wants this, NOT getPlayhead(), which is ad-relative while
   * an ad is on screen.
   *
   * Reads the video element rather than `player.time()`. Measured, the two are
   * identical on both VOD and live, but the element is the source that exists
   * earliest: at the first CUEPOINTS_CHANGED, which precedes attachSource,
   * `player.time()` throws while `video.currentTime` reads 0.
   *
   * tag is null on a disposed tracker, and this runs from the content tracker's
   * event handlers, so it must not throw.
   */
  getStreamTimeMs() {
    return (this.tag?.currentTime ?? 0) * 1000;
  }

  /**
   * Stream time to content time, for the content tracker's playhead and
   * duration. Returns undefined when the SDK cannot convert — including on a
   * disposed tracker — so the caller keeps reporting stream time rather than a
   * wrong number.
   *
   * Measured behaviour: on VOD it subtracts the ad time played so far (gap
   * exactly 10.010 after a 10.01s pre-roll, and 0 during it); on live it
   * returns the input unchanged, for both the playhead and the DVR duration.
   */
  contentTimeForStreamTime(streamTime) {
    try {
      const contentTime = this.player?.contentTimeForStreamTime?.(streamTime);
      return typeof contentTime === 'number' ? contentTime : undefined;
    } catch (error) {
      nrvideo.Log.warn('DaiTracker: Failed to convert stream time', error);
      return undefined;
    }
  }

  /**
   * True while an ad is on screen. Checked by DashTracker so content QoE stands
   * down during breaks.
   *
   * AD_BREAK_STARTED arrives only after playback has already entered the ad —
   * expected SSAI behaviour, since on live the SDK cannot know about a break
   * before its metadata arrives — so the break object alone misses the first
   * moments of a pre-roll. The cue points, known ahead of playback, cover that
   * window.
   *
   * Known limitation: cue points are a VOD facility in DAI. The live asset
   * reported none, so on live this degrades to the break object alone and a
   * live pre-roll can still report CONTENT_START a moment early. That single
   * arm is therefore the entire content guard on live.
   */
  isAdPlaying() {
    // video-core's disposeAdsTracker() calls dispose(), which nulls this
    // tracker's player and tag, but never clears the PARENT's adsTracker
    // reference — verified in 5.1.1 source. So the content guard keeps calling
    // in after setAdsTracker(null). A disposed tracker is not playing anything.
    if (!this.player && !this.tag) return false;

    if (this.adBreakData) return true;

    const cuePoints = this.cuePoints;
    if (!cuePoints?.length) return false;

    // Stream time, not getPlayhead(): cue point windows are stream times, and
    // the ad-relative value would never fall inside a mid-roll's window.
    const streamTime = this.getStreamTimeMs() / 1000;
    if (!Number.isFinite(streamTime)) return false;

    // Skip windows already played: seeking back into a watched pre-roll gets no
    // fresh ad telemetry, so suppressing content there would lose it outright.
    return cuePoints.some(
      (cue) =>
        cue?.played !== true &&
        typeof cue?.start === 'number' &&
        typeof cue?.end === 'number' &&
        cue.end > cue.start &&
        streamTime >= cue.start &&
        streamTime < cue.end
    );
  }

  /**
   * Captured when the ad started, so it stays constant across every event of
   * that ad instead of drifting as playback advances, and is identical for
   * every ad in one pod. Always 'pre' / 'mid' / 'post' / null — never a number.
   */
  getAdPosition() {
    return this.currentAdData?.position ?? this.adBreakData?.position ?? null;
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
