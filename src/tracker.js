import nrvideo from '@newrelic/video-core';
import { version } from '../package.json';

export default class DashTracker extends nrvideo.VideoTracker {
  constructor(player, options) {
    super(player, options);
    this.versionString = player.getVersion();
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
      console.log('error', error.message);
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
        const bitrtaeAbsoluteIndex =
          this.player.getCurrentRepresentationForType(type).absoluteIndex;

        return this.player.getCurrentRepresentationForType(type).mediaInfo
          ?.bitrateList[bitrtaeAbsoluteIndex];
      } else {
        const videoBitrate = this.player.getQualityFor(type);
        return this.player.getBitrateInfoListFor(type)[videoBitrate];
      }
    } catch (error) {
      /* do nothing */
    }
  }

  getRenditionBitrate() {
    try {
      const currentBitrate = this.getDashBitrate('video');

      if (this.majorVersion >= 5) {
        return currentBitrate?.bandwidth;
      }

      return currentBitrate?.bitrate;
    } catch (error) {
      /*  do nothing */
    }
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

  getPlayhead() {
    return this.player.time() * 1000; // in milliseconds
  }

  isMuted() {
    return this.player.isMuted();
  }

  isAutoplayed() {
    return this.player.getAutoPlay();
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

    this.player.on('streamInitialized', this.onReady.bind(this));
    this.player.on('playbackMetaDataLoaded', this.onDownload.bind(this));
    this.player.on('playbackLoadedData', this.onDownload.bind(this));
    this.player.on('canPlay', this.onPlay.bind(this));
    this.player.on('playbackPlaying', this.onPlaying.bind(this));
    this.player.on('playbackPaused', this.onPause.bind(this));
    this.player.on('playbackSeeking', this.onSeeking.bind(this));
    this.player.on('playbackSeeked', this.onSeeked.bind(this));
    this.player.on('error', this.onError.bind(this));
    this.player.on('playbackError', this.onError.bind(this));
    this.player.on('playbackEnded', this.onEnded.bind(this));
    this.player.on('bufferStalled', this.onBufferingStalled.bind(this));
    this.player.on('bufferLoaded', this.onBufferingLoaded.bind(this));
    this.player.on('qualityChangeRendered', this.onAdaptation.bind(this));
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
  }

  onReady() {
    this.sendPlayerReady();
  }

  onDownload(e) {
    this.sendDownload({ state: e.type });
  }

  onPlay() {
    this.sendRequest();
  }

  onPlaying() {
    this.sendResume();
    this.sendStart();
  }

  onAdaptation() {
    this.sendRenditionChanged();
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
