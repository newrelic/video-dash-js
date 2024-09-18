import * as nrvideo from "newrelic-video-core";
import { version } from "../package.json";

export default class DashTracker extends nrvideo.VideoTracker {
  setPlayer(player, tag) {
    if (tag && player.getVideoElement) tag = player.getVideoElement();
    nrvideo.VideoTracker.prototype.setPlayer.call(this, player, tag);
  }

  getTrackerName() {
    return "dash";
  }

  getTrackerVersion() {
    return version;
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

  getDuration() {
    // Returns the duration of the MPD in seconds
    return this.player.duration();
  }

  getTrack() {
    const track = this.player.getCurrentTrackFor("audio");
    return track;
  }

  getLanguage() {
    const activeTrack = this.getTrack();
    return activeTrack.lang ?? "";
  }

  getDashBitrate(type) {
    // MediaPlayer == getQualityFor
    /* 
      Gets the current download quality for media type video, audio or images. 
      For video and audio types the ABR rules update this value before every new download  
      unless autoSwitchBitrate is set to fasle
    */
    const videoBitrate = this.player.getQualityFor("video");

    return this.player.getBitrateInfoListFor("video")[videoBitrate];
  }

  getRenditionBitrate() {
    const currentBitrate = this.getDashBitrate("video");
    return currentBitrate?.bitrate;
  }

  getRenditionName() {
    let qlty = this.getDashBitrate("video");
    return qlty?.label;
  }

  /** Override to return renidtion actual width (before re-scaling). */
  getRenditionWidth() {
    return this.getDashBitrate("video")?.width;
  }

  /** Override to return renidtion actual height (before re-scaling). */
  getRenditionHeight() {
    return this.getDashBitrate("video")?.height;
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

  registerListeners() {
    nrvideo.Log.debugCommonVideoEvents(this.player, [
      null,
      "streamInitialized",
      "playbackMetaDataLoaded",
      "playbackLoadedData",
      "canPlay",
      "playbackPlaying",
      "playbackPaused",
      "playbackSeeking",
      "playbackSeeked",
      "error",
      "playbackEnded",
      "bufferStalled",
      "bufferLoaded",
      "qualityChangeRendered",
    ]);

    this.tag.on("streamInitialized", this.onReady.bind(this));
    this.tag.on("playbackMetaDataLoaded", this.onDownload.bind(this));
    this.tag.on("playbackLoadedData", this.onDownload.bind(this));
    this.tag.on("canPlay", this.onPlay.bind(this));
    this.tag.on("playbackPlaying", this.onPlaying.bind(this));
    this.tag.on("playbackPaused", this.onPause.bind(this));
    this.tag.on("playbackSeeking", this.onSeeking.bind(this));
    this.tag.on("playbackSeeked", this.onSeeked.bind(this));
    this.tag.on("error", this.onError.bind(this));
    this.tag.on("playbackError", this.onError.bind(this));
    this.tag.on("playbackEnded", this.onEnded.bind(this));
    this.player.on("bufferStalled", this.onBufferingStalled.bind(this));
    this.player.on("bufferLoaded", this.onBufferingLoaded.bind(this));
    this.player.on("qualityChangeRendered", this.onAdaptation.bind(this));
  }

  unregisterListeners() {
    this.tag.off("streamInitialized", this.onReady);
    this.tag.off("playbackMetaDataLoaded", this.onDownload);
    this.tag.off("playbackLoadedData", this.onDownload);
    this.tag.off("canPlay", this.onPlay);
    this.tag.off("playbackPlaying", this.onPlaying);
    this.tag.off("playbackPaused", this.onPause);
    this.tag.off("playbackSeeking", this.onSeeking);
    this.tag.off("playbackSeeked", this.onSeeked);
    this.tag.off("playbackError", this.onError);
    this.tag.off("error", this.onError);
    this.tag.off("playbackEnded", this.onEnded);
    this.player.off("bufferStalled", this.onBufferingStalled);
    this.player.off("bufferLoaded", this.onBufferingLoaded);
    this.player.off("qualityChangeRendered", this.onAdaptation);
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
    this.sendError(e.message);
  }

  onEnded() {
    this.sendEnd();
  }
}
