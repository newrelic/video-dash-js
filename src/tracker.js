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

  isLive() {
    return this.player.isDynamic();
  }

  getSrc() {
    return this.player.getSource();
  }

  getPlayrate() {
    return this.player.getPlaybackRate();
  }

  getPlayhead() {
    return this.player.time() * 1000; // in milliseconds
  }

  getDuration() {
    // Returns the duration of the MPD in seconds
    return this.player.duration();
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

  getDashBitrate(type) {
    try {
      if (this.majorVersion >= 5) {
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
      if (this.majorVersion >= 5) {
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
      if (this.majorVersion >= 5) {
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

      if (this.majorVersion >= 5) {
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
    // Content is not resuming during an ad. sendStart() deliberately does NOT
    // live here any more — see onTimeUpdated.
    if (this.isAdsTrackerActive()) return;
    this.sendResume();
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
   * `playbackTimeUpdated` keeps firing, so the guard defers the start to the
   * first tick after the break ends. Verified present in both dash.js 4.7.4
   * and 5.3.0 (spec 9.2.1). This mirrors hls.js, which gets the same behaviour
   * by accident of placement — its sendStart lives in onTimeupdate.
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
    const payload = e || {};
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

  onError(e) {
    this.sendError({ errorCode: e.error.code, errorMessage: e.error.message });
  }

  onEnded() {
    this.sendEnd();
  }
}
