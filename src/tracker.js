import * as nrvideo from "newrelic-video-core";
import { version } from "../package.json";

export default class DashTracker extends nrvideo.VideoTracker {
  constructor(player, options) {
    super(player, options);

    // console.log("player", this.player);
    // player.on("manifestLoaded", (e) => {
    //   console.log("manifestLoaded", e.data);
    // });
  }

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

  getTitle() {
    //https://github.com/Dash-Industry-Forum/dash.js/issues/2961
    // https://reference.dashif.org/dash.js/nightly/samples/getting-started/listening-to-events.html
    /* Not has any method for getting title */
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

  //implementing getTrack() method for dash.js
  getTrack() {
    const track = this.player.getCurrentTrackFor("audio");
    return track;
  }

  getLanguage() {
    const activeTrack = this.getTrack();
    return activeTrack ? activeTrack.lang : "";
    //return this.getTrack().lang;
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
    //return this.player.getVideoElement().clientWidth;
    return this.getDashBitrate("video")?.width;
  }

  /** Override to return renidtion actual height (before re-scaling). */
  getRenditionHeight() {
    //return this.player.getVideoElement().clientHeight;
    return this.getDashBitrate("video")?.height;
  }

  getPlayerVersion() {
    return this.player.getVersion();
  }

  getPreload() {
    /* Content Is Preloaded */
    return this.player.preload();
  }

  isMuted() {
    /* Content Is Muted */
    return this.player.isMuted();
  }

  isAutoplayed() {
    /* Content Is Autoplayed */
    return this.player.getAutoPlay();
  }

  isFullscreen() {
    // dash js does not have a built-in method to check if the player is in fullscreen mode
    // we can do by using jabvaSrcipt method:
    // console.log("full screen", this._fullScreen);
  }

  registerListeners() {
    //nrvideo.Log.debugCommonVideoEvents(this.tag);

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

    /*        Stream Period is activate ON_READY Event       */
    this.tag.on("streamInitialized", this.onReady.bind(this));

    /*       Playback meta data loaded Download Event       */
    this.tag.on("playbackMetaDataLoaded", this.onDownload.bind(this));

    /*      Playback loaded data Download Event       */
    this.tag.on("playbackLoadedData", this.onDownload.bind(this));

    /*       Playback can play Event  CONTENT_REQUEST, CONTENT_START     */
    this.tag.on("canPlay", this.onPlay.bind(this));

    /*          CONTENT_RESUME     */
    this.tag.on("playbackPlaying", this.onPlaying.bind(this));

    /*          CONTENT_PAUSE     */
    this.tag.on("playbackPaused", this.onPause.bind(this));

    /*          CONTENT_SEEK_START     */
    this.tag.on("playbackSeeking", this.onSeeking.bind(this));

    /*          CONTENT_SEEK_END     */
    this.tag.on("playbackSeeked", this.onSeeked.bind(this));

    /*          CONTENT_ERROR     */
    this.tag.on("error", this.onError.bind(this));
    this.tag.on("playbackError", this.onError.bind(this));

    /*          CONTENT_END     */
    this.tag.on("playbackEnded", this.onEnded.bind(this));

    /*     CONTENT_BUFFER_START     */
    this.player.on("bufferStalled", this.onBufferingStalled.bind(this));

    /*     CONTENT_BUFFER_END     */
    this.player.on("bufferLoaded", this.onBufferingLoaded.bind(this));

    /*     CONTENT_RENDITION_CHANGED     */
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

  onAdaptation(e) {
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
    this.sendError(e.detail);
  }

  onEnded() {
    this.sendEnd();
  }
}
