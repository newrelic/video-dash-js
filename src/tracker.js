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

  setPlayer(player, tag) {
    nrvideo.VideoTracker.prototype.setPlayer.call(this, player, tag);
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
    this.sendResume();
    this.sendStart();
  }

  onAdaptation(e) {
    const oldBitrate = this.getBitrateByQualityIndex('video', e.oldQuality);
    const newBitrate = this.getBitrateByQualityIndex('video', e.newQuality);
    this.sendRenditionChanged({oldBitrate, newBitrate});
  }

  onBufferingStalled() {
    this.sendBufferStart();
  }

  onBufferingLoaded() {
    this.sendBufferEnd();
  }

  onPause() {
    this.sendPause();
  }

  onSeeking() {
    this.sendSeekStart();
  }

  onSeeked() {
    this.sendSeekEnd();
  }

  onError(e) {
    this.sendError({ errorCode: e.error.code, errorMessage: e.error.message });
  }

  onEnded() {
    this.sendEnd();
  }
}
