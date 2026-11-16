import nrvideo from '@newrelic/video-core';
import { version } from '../package.json';

export default class DashTracker extends nrvideo.VideoTracker {
  constructor(player, options) {
    super(player, options);
    this.versionString = player.getVersion();
    this.lastDownloadBitrate = null;
    nrvideo.Core.addTracker(this, options);

    if (this.versionString) {
      this.majorVersion = parseInt(this.versionString.split('.')[0]);
    } else {
      console.error('player.getVersion is not supported by dash js');
    }
  }

  /**
   * Resolves the video element from the player when the application did not
   * pass one.
   *
   * `getVideoElement` exists in both dash.js 4.7.4 and 5.3.0 (verified against
   * the bundles). Resolving it here removes the ordering trap that bit the
   * hls.js sample, where the tracker had to be constructed *after* the media
   * element was attached. `options.tag` stays supported and takes precedence,
   * so an app that already passes one is unaffected (spec 7.6).
   */
  setPlayer(player, tag) {
    const resolved = tag || this.resolveVideoElement(player);
    nrvideo.VideoTracker.prototype.setPlayer.call(this, player, resolved);
  }

  resolveVideoElement(player) {
    try {
      return typeof player?.getVideoElement === 'function'
        ? player.getVideoElement()
        : null;
    } catch (error) {
      // The element may not exist yet; the base class falls back to the player.
      return null;
    }
  }

  /**
   * True while an ad is actually on screen, so content QoE events can stand
   * down. Scoped to the current ad break rather than the ad tracker's permanent
   * isAd() flag — under SSAI the ad tracker stays attached for the whole
   * session, and content pause/seek/buffer must keep reporting between breaks.
   */
  isAdsTrackerActive() {
    if (!this.adsTracker || !this.adsTracker.isAd || !this.adsTracker.isAd()) {
      return false;
    }
    // Preferred: covers the start of a pre-roll, before the ad SDK has
    // announced the break. A disposed DaiTracker answers false here rather
    // than throwing — video-core's disposeAdsTracker() nulls its player and tag
    // but leaves this reference in place.
    if (typeof this.adsTracker.isAdPlaying === 'function') {
      return this.adsTracker.isAdPlaying();
    }
    if (typeof this.adsTracker.getCurrentAdBreak === 'function') {
      return this.adsTracker.getCurrentAdBreak() != null;
    }
    return true;
  }

  /**
   * Whether a content transition that is ALREADY OPEN may be closed during an
   * ad break. It always may: video-core bills (stopTime - startTime) to
   * totalRebufferingTime and pairs goSeekEnd with isSeeking, so holding a
   * transition open across a break charges the whole pod to content. A stall
   * that begins just before an ad boundary is a common SSAI case.
   */
  canCloseContentTransition(flag) {
    return !this.isAdsTrackerActive() || !!this.state?.[flag];
  }

  getTrackerName() {
    return 'dash';
  }

  getTrackerVersion() {
    return version;
  }

  getPlayerName() {
    return 'Dash';
  }

  getInstrumentationName() {
    return this.getPlayerName();
  }

  getInstrumentationVersion() {
    return this.getPlayerVersion();
  }

  getInstrumentationProvider() {
    return 'New Relic';
  }

  /**
   * Reads a value from the dash.js player, tolerating the sourceless state.
   *
   * dash.js throws — a bare STRING, not an Error, so `err.message` is
   * undefined — out of `time()`, `duration()`, `isDynamic()` and `getSource()`
   * until a source has been attached. Under DAI that state is routine rather
   * than exceptional: `STREAM_INITIALIZED` arrives before the stitched
   * manifest exists, so telemetry is collected while the player still has
   * nothing loaded.
   *
   * This matters far more than a missing attribute. The ad tracker's handlers
   * run inside the IMA DAI SDK's own event dispatch, so an exception escaping
   * attribute collection reaches the SDK, which aborts the stream request and
   * emits an empty ERROR — observed against the live asset, where nothing
   * played at all. A telemetry library must not take the stream down with it.
   */
  readFromPlayer(read, fallback = null) {
    try {
      const value = read();
      return value === undefined ? fallback : value;
    } catch (error) {
      // Routine before attachSource, so this is not worth logging on every
      // event; the absent attribute is the signal.
      return fallback;
    }
  }

  isLive() {
    const dynamic = this.readFromPlayer(() => this.player.isDynamic());
    // null, not false: 'unknown' is the honest answer before a manifest is
    // parsed, and DaiTracker.getStreamType() only accepts a boolean.
    return typeof dynamic === 'boolean' ? dynamic : null;
  }

  getSrc() {
    return this.readFromPlayer(() => this.player.getSource());
  }

  getPlayrate() {
    return this.player.getPlaybackRate();
  }

  getPlayhead() {
    const time = this.readFromPlayer(() => this.player.time());
    if (typeof time !== 'number' || !Number.isFinite(time)) return 0;
    return this.toContentTime(time) * 1000; // in milliseconds
  }

  /**
   * Stream time to content time.
   *
   * Under SSAI the stitched stream's clock includes every ad played so far, so
   * reporting it directly overstates content progress by the cumulative ad
   * duration. An ads tracker that can convert is asked to; anything else — no
   * ads, or an ad framework without a conversion — reports the clock as-is.
   *
   * Measured behaviour of the SDK's conversion: on VOD it subtracts ad time
   * correctly (content time reads 0 through a 10.01s pre-roll, then the gap
   * settles at exactly 10.010); on live it is an identity, for both the
   * playhead and the finite DVR duration. There is deliberately no isLive()
   * skip — an identity conversion is indistinguishable from no conversion, so a
   * skip would add a branch and diverge from hls.js for no measured reason
   * (spec 9.3.2).
   */
  toContentTime(streamTime) {
    const converted = this.adsTracker?.contentTimeForStreamTime?.(streamTime);
    return typeof converted === 'number' && Number.isFinite(converted)
      ? converted
      : streamTime;
  }

  getDuration() {
    // Same stream-vs-content distinction as getPlayhead: a stitched VOD's
    // duration includes every inserted ad.
    //
    // Still SECONDS, deliberately. dash.js reports duration in seconds while
    // the data model and every other tracker use ms — a real pre-existing
    // defect, but fixing it multiplies contentDuration by 1000 for every
    // existing DASH customer, so it is blocked on a release decision and
    // tracked separately (spec 10.2). Do not add `* 1000` here.
    const duration = this.readFromPlayer(() => this.player.duration());
    if (typeof duration !== 'number' || !Number.isFinite(duration)) return null;
    return this.toContentTime(duration);
  }

  getTrack() {
    try {
      const track = this.player?.getCurrentTrackFor('audio');
      return track;
    } catch (error) {
      /* do nothing */
    }
  }

  getLanguage() {
    try {
      const activeTrack = this.getTrack();
      return activeTrack.lang ?? '';
    } catch (error) {
      /* do nothing */
    }
  }

  /**
   * Whether to use dash.js 5's quality APIs.
   *
   * Feature-detected BEFORE the version is consulted, because `majorVersion`
   * cannot be trusted on its own: `getVersion()` returning nothing leaves it
   * undefined, and a 'v5.3.0' string makes `parseInt('v5')` NaN — in both
   * cases `>= 5` is false, so a real dash.js 5 player would take the v4 branch,
   * find `getQualityFor` missing, and report null quality for the whole
   * session. With 'v5.3.0' not even the constructor's console.error fires,
   * because the version string is truthy (Global Constraints, spec 13.5).
   */
  usesV5QualityApi() {
    if (typeof this.player?.getRepresentationsByType === 'function') return true;
    if (typeof this.player?.getCurrentRepresentationForType === 'function') return true;
    // A player with the v4 API and no v5 API is v4, whatever it claims.
    if (typeof this.player?.getQualityFor === 'function') return false;
    return this.majorVersion >= 5;
  }

  getDashBitrate(type) {
    try {
      if (this.usesV5QualityApi()) {
        return this.player.getCurrentRepresentationForType(type) || null;
      } else {
        const qualityIndex = this.player.getQualityFor(type);
        return this.player.getBitrateInfoListFor(type)[qualityIndex];
      }
    } catch (error) {
      return null;
    }
  }                                                                                                                                         

  // contentBitrate: Video-only bitrate from the active track (excludes audio)
  getBitrate() {
    try {
      const currentBitrate = this.getDashBitrate('video');
      if (this.usesV5QualityApi()) {
        return currentBitrate?.bandwidth ?? null;
      }
      return currentBitrate?.bitrate ?? null;
    } catch (error) {
      /* do nothing */
    }
    return null;
  }

  // contentManifestBitrate: Max combined (video + audio) bitrate defined in the MPD
  getManifestBitrate() {
    try {
      if (this.usesV5QualityApi()) {
        if (typeof this.player.getRepresentationsByType === 'function') {
          const videoReps = this.player.getRepresentationsByType('video');
          const audioReps = this.player.getRepresentationsByType('audio');
          let maxVideo = 0;
          if (videoReps && videoReps.length > 0) {
            for (const rep of videoReps) {
              const br = rep.bandwidth || 0;
              if (br > maxVideo) maxVideo = br;
            }
          }
          let maxAudio = 0;
          if (audioReps && audioReps.length > 0) {
            for (const rep of audioReps) {
              const br = rep.bandwidth || 0;
              if (br > maxAudio) maxAudio = br;
            }
          }
          const total = maxVideo + maxAudio;
          return total > 0 ? total : null;
        }
      } else {
        const videoBitrateList = this.player.getBitrateInfoListFor('video');
        const audioBitrateList = this.player.getBitrateInfoListFor('audio');
        let maxVideo = 0;
        if (videoBitrateList && videoBitrateList.length > 0) {
          for (const info of videoBitrateList) {
            const br = info.bitrate || 0;
            if (br > maxVideo) maxVideo = br;
          }
        }
        let maxAudio = 0;
        if (audioBitrateList && audioBitrateList.length > 0) {
          for (const info of audioBitrateList) {
            const br = info.bitrate || 0;
            if (br > maxAudio) maxAudio = br;
          }
        }
        const total = maxVideo + maxAudio;
        return total > 0 ? total : null;
      }
    } catch (error) {
      /* do nothing */
    }
    return null;
  }

  // contentSegmentDownloadBitrate: Network bandwidth estimated by the ABR algorithm
  getSegmentDownloadBitrate() {
    try {
      if (typeof this.player.getAverageThroughput === 'function') {
        const throughput = this.player.getAverageThroughput('video');
        if (throughput && throughput > 0) {
          return throughput * 1000; // convert kbps to bps
        }
      }
    } catch (error) {
      /* do nothing */
    }
    return null;
  }

  // contentNetworkDownloadBitrate: Effective download throughput (bytesDownloaded × 8 / time)
  getNetworkDownloadBitrate() {
    return this.lastDownloadBitrate;
  }

  /*
  Not able to find any field to show renditionName
  getRenditionName() {
    let qlty = this.getDashBitrate('video');
    console.log('qlty', qlty);
    // return qlty?.label;
  }
  */

  /** Override to return renidtion actual width (before re-scaling). */
  getRenditionWidth() {
    return this.getDashBitrate('video')?.width;
  }

  /** Override to return renidtion actual height (before re-scaling). */
  getRenditionHeight() {
    return this.getDashBitrate('video')?.height;
  }

  getPlayerVersion() {
    return this.player.getVersion();
  }

  getPreload() {
    return this.player.preload();
  }

  isMuted() {
    return this.player.isMuted();
  }

  isAutoplayed() {
    return this.player.getAutoPlay();
  }


  updateDownloadBitrate(request) {
    if (!request || !request.requestStartDate || !request.requestEndDate) return;

    const bytes = request.bytesLoaded || 0;
    const downloadTimeMs = request.requestEndDate.getTime() - request.requestStartDate.getTime();
    if (bytes > 0 && downloadTimeMs > 0) {
      this.lastDownloadBitrate = (bytes * 8 * 1000) / downloadTimeMs;
    }
  }

  getBitrateByQualityIndex(type, qualityIndex) {
    try {
      if (qualityIndex == null || qualityIndex < 0) return null;

      if (this.usesV5QualityApi()) {
        const representations = this.player.getRepresentationsByType(type);
        if (representations && representations[qualityIndex]) {
          return representations[qualityIndex].bandwidth ?? null;
        }
      } else {
        const bitrateList = this.player.getBitrateInfoListFor(type);
        if (bitrateList && bitrateList[qualityIndex]) {
          return bitrateList[qualityIndex].bitrate ?? null;
        }
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  registerListeners() {
    nrvideo.Log.debugCommonVideoEvents(this.player, [
      null,
      'streamInitialized',
      'playbackMetaDataLoaded',
      'playbackLoadedData',
      'canPlay',
      'playbackPlaying',
      'playbackPaused',
      'playbackSeeking',
      'playbackSeeked',
      'error',
      'playbackEnded',
      'bufferStalled',
      'bufferLoaded',
      'qualityChangeRendered',
    ]);

    // BIND LISTENER METHODS
    this.onReady = this.onReady.bind(this);
    this.onDownload = this.onDownload.bind(this);
    this.onPlay = this.onPlay.bind(this);
    this.onPlaying = this.onPlaying.bind(this);
    this.onPause = this.onPause.bind(this);
    this.onSeeking = this.onSeeking.bind(this);
    this.onSeeked = this.onSeeked.bind(this);
    this.onError = this.onError.bind(this);
    this.onEnded = this.onEnded.bind(this);
    this.onBufferingStalled = this.onBufferingStalled.bind(this);
    this.onBufferingLoaded = this.onBufferingLoaded.bind(this);
    this.onAdaptation = this.onAdaptation.bind(this);
    this.onFragmentLoadingCompleted = this.onFragmentLoadingCompleted.bind(this);
    this.onTimeUpdated = this.onTimeUpdated.bind(this);

    this.player.on('streamInitialized', this.onReady);
    this.player.on('playbackMetaDataLoaded', this.onDownload);
    this.player.on('playbackLoadedData', this.onDownload);
    this.player.on('canPlay', this.onPlay);
    this.player.on('playbackPlaying', this.onPlaying);
    this.player.on('playbackPaused', this.onPause);
    this.player.on('playbackSeeking', this.onSeeking);
    this.player.on('playbackSeeked', this.onSeeked);
    this.player.on('error', this.onError);
    this.player.on('playbackError', this.onError);
    this.player.on('playbackEnded', this.onEnded);
    this.player.on('bufferStalled', this.onBufferingStalled);
    this.player.on('bufferLoaded', this.onBufferingLoaded);
    this.player.on('qualityChangeRendered', this.onAdaptation);
    this.player.on('fragmentLoadingCompleted', this.onFragmentLoadingCompleted);
    // CONTENT_START lives here, not in playbackPlaying — see onTimeUpdated.
    this.player.on('playbackTimeUpdated', this.onTimeUpdated);
  }

  unregisterListeners() {
    this.player.off('streamInitialized', this.onReady);
    this.player.off('playbackMetaDataLoaded', this.onDownload);
    this.player.off('playbackLoadedData', this.onDownload);
    this.player.off('canPlay', this.onPlay);
    this.player.off('playbackPlaying', this.onPlaying);
    this.player.off('playbackPaused', this.onPause);
    this.player.off('playbackSeeking', this.onSeeking);
    this.player.off('playbackSeeked', this.onSeeked);
    this.player.off('playbackError', this.onError);
    this.player.off('error', this.onError);
    this.player.off('playbackEnded', this.onEnded);
    this.player.off('bufferStalled', this.onBufferingStalled);
    this.player.off('bufferLoaded', this.onBufferingLoaded);
    this.player.off('qualityChangeRendered', this.onAdaptation);
    this.player.off('fragmentLoadingCompleted', this.onFragmentLoadingCompleted);
    this.player.off('playbackTimeUpdated', this.onTimeUpdated);
  }

  onReady() {
    this.sendPlayerReady();
  }

  onDownload(e) {
    this.sendDownload({ state: e.type });
  }

  onFragmentLoadingCompleted(e) {
    if (e.mediaType === 'video' && e.request.type === 'MediaSegment') {
      this.updateDownloadBitrate(e.request);
    }
  }

  onPlay() {
    this.sendRequest();
  }

  onPlaying() {
    // Content is not resuming during an ad.
    if (this.isAdsTrackerActive()) return;
    this.sendResume();
    // CONTENT_START stays here for sessions with no ad break in progress,
    // which keeps the existing timing — and therefore startupTime, which is
    // fixed at CONTENT_START — unchanged for every customer who shows no ads.
    // Moving it unconditionally to playbackTimeUpdated would have delayed it
    // by up to one timeupdate interval (~250ms) for all of them, a KPI shift
    // for people who get no benefit from the move. onTimeUpdated is the
    // recovery path that makes the DAI case work; see there.
    this.sendStart();
  }

  /**
   * Where CONTENT_START comes from, and the single most important correction in
   * this design.
   *
   * Suppressing sendStart() inside onPlaying alone would **lose**
   * CONTENT_START for the whole session rather than defer it. `playbackPlaying`
   * is dash.js relaying the media element's `playing` event, and under SSAI the
   * pre-roll -> content boundary is seamless inside one stitched stream: no
   * pause, no rebuffer, no second `playing`. video-core only sets content
   * isStarted from sendStart() and never retries, so nothing would recover it.
   *
   * `playbackTimeUpdated` keeps firing, so this recovers the start on the
   * first tick after the break ends. Verified present in both dash.js 4.7.4
   * and 5.3.0 (spec 9.2.1). This mirrors hls.js, which gets the same behaviour
   * by accident of placement — its sendStart lives in onTimeupdate.
   *
   * onPlaying still reports the start when no break is in progress, so this is
   * purely additive: video-core gates the second call on isStarted, and a
   * customer with no ads sees no change in timing.
   */
  onTimeUpdated() {
    if (this.isAdsTrackerActive()) return;
    if (this.getPlayhead() > 0.1) {
      this.sendStart();
    }
  }

  /**
   * `qualityChangeRendered` carries two different payload shapes.
   *
   * Measured verbatim against dash.js 5.3.0 (2026-11-09):
   *
   *   Object.keys(e)                -> ['mediaType', 'oldRepresentation',
   *                                     'newRepresentation', 'streamId', 'type']
   *   e.newRepresentation.bandwidth -> 274000   // directly on the object
   *   e.oldRepresentation           -> null     // on a stream's FIRST switch
   *
   * dash.js 4.7.4 instead sends integer `oldQuality` / `newQuality` indices
   * that have to be resolved against `getBitrateInfoListFor`. On v5 both of
   * those read `undefined`, so before this fix every v5 rendition change
   * reported `oldBitrate: null, newBitrate: null`.
   *
   * Reading `bandwidth` off the representation is not just simpler than an
   * index lookup, it is safer: a DAI stream is multi-period and an index
   * resolves against whichever period is active, while the value carried in
   * the payload cannot be attributed to the wrong period's list.
   *
   * The shape is feature-detected BEFORE falling back to `majorVersion`,
   * because a player whose `getVersion()` returns nothing leaves
   * `majorVersion` undefined and `undefined >= 5` is false — which would send
   * a real v5 player down the v4 path and null its quality data for the whole
   * session (spec 13.5).
   */
  onAdaptation(e) {
    // Treat a rendition change as a content transition *open* and suppress it
    // during a break, consistent with the open/close asymmetry above.
    //
    // This diverges from hls.js, where the equivalent handler is unguarded —
    // that parity argument was derived from single-period HLS. Measured on a
    // DAI DASH stream, qualityChangeRendered fires inside breaks carrying the
    // AD's representation: 274000 at a VOD pre-roll's start against 2142460
    // for the content either side of it. The number is accurate for what it
    // describes; the problem is that we would publish it as
    // CONTENT_RENDITION_CHANGE, telling a consumer the viewer's content
    // dropped to 274 kbps when it never did (spec 9.2.2).
    if (this.isAdsTrackerActive()) return;

    const payload = e || {};

    // dash.js fires this PER MEDIA TYPE. Measured, an audio switch arrives
    // alongside the video one (video 274000 / audio 130000 on VOD; video
    // 334000 / audio 130000 on live). CONTENT_RENDITION_CHANGE describes the
    // video rendition, and video-core derives `shift` and totalSwitchDowns
    // from the bitrates, so publishing an audio switch tells a consumer the
    // viewer's video dropped to 128 kbps when it never did.
    //
    // An event with no mediaType at all is still reported: dropping it would
    // silently remove rendition reporting for any player that omits the field.
    if (payload.mediaType && payload.mediaType !== 'video') return;
    const hasRepresentations =
      typeof payload.oldRepresentation !== 'undefined' ||
      typeof payload.newRepresentation !== 'undefined';
    const useRepresentations = hasRepresentations || this.majorVersion >= 5;

    const oldBitrate = useRepresentations
      ? payload.oldRepresentation?.bandwidth ?? null
      : this.getBitrateByQualityIndex('video', payload.oldQuality);
    const newBitrate = useRepresentations
      ? payload.newRepresentation?.bandwidth ?? null
      : this.getBitrateByQualityIndex('video', payload.newQuality);

    this.sendRenditionChanged({ oldBitrate, newBitrate });
  }

  onBufferingStalled() {
    if (this.isAdsTrackerActive()) return;
    this.sendBufferStart();
  }

  onBufferingLoaded() {
    // A stall that began before the break still has to be closed, at the real
    // recovery moment, or its whole duration is billed to content.
    if (!this.canCloseContentTransition('isBuffering')) return;
    this.sendBufferEnd();
  }

  onPause() {
    if (this.isAdsTrackerActive()) return;
    this.sendPause();
  }

  onSeeking() {
    if (this.isAdsTrackerActive()) return;
    this.sendSeekStart();
  }

  onSeeked() {
    if (!this.canCloseContentTransition('isSeeking')) return;
    this.sendSeekEnd();
  }

  /**
   * Registered for both `error` and `playbackError`.
   *
   * `e.error.code` used to be dereferenced unguarded, so an error event with no
   * `error` payload threw straight into dash.js's event dispatch.
   *
   * No fatality filter, deliberately. hls.js drops `data.fatal === false`
   * because it raises recoverable conditions on the same event as real
   * failures. dash.js has no equivalent: measured against 5.3.0, the payload is
   * `{ code, message, data }` with no `fatal` and no `severity`, none of its 87
   * events is a warning channel, and `MediaPlayer.errors` classifies what
   * failed rather than how badly. So every error is reported, which is correct
   * behaviour here rather than an oversight — and a code-number allowlist
   * invented to mimic hls.js would be a guess dressed as a filter (spec 9.4).
   */
  onError(e) {
    const error = e?.error;
    this.sendError({
      errorCode: error?.code,
      // Better a placeholder than a silent or empty error: an event reached us,
      // so something did fail.
      errorMessage: error?.message ?? 'Unknown dash.js error',
    });
  }

  onEnded() {
    this.sendEnd();
  }
}
