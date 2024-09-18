// All dash events

{
  ADAPTATION_SET_REMOVED_NO_CAPABILITIES: "adaptationSetRemovedNoCapabilities";
  AST_IN_FUTURE: "astInFuture";
  BASE_URLS_UPDATED: "baseUrlsUpdated";
  BUFFER_EMPTY: "bufferStalled";
  BUFFER_LEVEL_STATE_CHANGED: "bufferStateChanged";
  BUFFER_LEVEL_UPDATED: "bufferLevelUpdated";
  BUFFER_LOADED: "bufferLoaded";
  CAN_PLAY: "canPlay";
  CAN_PLAY_THROUGH: "canPlayThrough";
  CAPTION_CONTAINER_RESIZE: "captionContainerResize";
  CAPTION_RENDERED: "captionRendered";
  CONFORMANCE_VIOLATION: "conformanceViolation";
  CONTENT_STEERING_REQUEST_COMPLETED: "contentSteeringRequestCompleted";
  CUE_ENTER: "cueEnter";
  CUE_EXIT: "cueExit";
  DVB_FONT_DOWNLOAD_ADDED: "dvbFontDownloadAdded";
  DVB_FONT_DOWNLOAD_COMPLETE: "dvbFontDownloadComplete";
  DVB_FONT_DOWNLOAD_FAILED: "dvbFontDownloadFailed";
  DYNAMIC_TO_STATIC: "dynamicToStatic";
  ERROR: "error";
  EVENT_MODE_ON_RECEIVE: "eventModeOnReceive";
  EVENT_MODE_ON_START: "eventModeOnStart";
  FRAGMENT_LOADING_ABANDONED: "fragmentLoadingAbandoned";
  FRAGMENT_LOADING_COMPLETED: "fragmentLoadingCompleted";
  FRAGMENT_LOADING_PROGRESS: "fragmentLoadingProgress";
  FRAGMENT_LOADING_STARTED: "fragmentLoadingStarted";
  INBAND_PRFT: "inbandPrft";
  KEY_ADDED: "public_keyAdded";
  KEY_ERROR: "public_keyError";
  KEY_MESSAGE: "public_keyMessage";
  KEY_SESSION_CLOSED: "public_keySessionClosed";
  KEY_SESSION_CREATED: "public_keySessionCreated";
  KEY_SESSION_REMOVED: "public_keySessionRemoved";
  KEY_SESSION_UPDATED: "public_keySessionUpdated";
  KEY_STATUSES_CHANGED: "public_keyStatusesChanged";
  KEY_SYSTEM_ACCESS_COMPLETE: "public_keySystemAccessComplete";
  KEY_SYSTEM_SELECTED: "public_keySystemSelected";
  LICENSE_REQUEST_COMPLETE: "public_licenseRequestComplete";
  LICENSE_REQUEST_SENDING: "public_licenseRequestSending";
  LOG: "log";
  MANAGED_MEDIA_SOURCE_END_STREAMING: "managedMediaSourceEndStreaming";
  MANAGED_MEDIA_SOURCE_START_STREAMING: "managedMediaSourceStartStreaming";
  MANIFEST_LOADED: "manifestLoaded";
  MANIFEST_LOADING_FINISHED: "manifestLoadingFinished";
  MANIFEST_LOADING_STARTED: "manifestLoadingStarted";
  MANIFEST_VALIDITY_CHANGED: "manifestValidityChanged";
  METRICS_CHANGED: "metricsChanged";
  METRIC_ADDED: "metricAdded";
  METRIC_CHANGED: "metricChanged";
  METRIC_UPDATED: "metricUpdated";
  PERIOD_SWITCH_COMPLETED: "periodSwitchCompleted";
  PERIOD_SWITCH_STARTED: "periodSwitchStarted";
  PLAYBACK_ENDED: "playbackEnded";
  PLAYBACK_ERROR: "playbackError";
  PLAYBACK_LOADED_DATA: "playbackLoadedData";
  PLAYBACK_METADATA_LOADED: "playbackMetaDataLoaded";
  PLAYBACK_NOT_ALLOWED: "playbackNotAllowed";
  PLAYBACK_PAUSED: "playbackPaused";
  PLAYBACK_PLAYING: "playbackPlaying";
  PLAYBACK_PROGRESS: "playbackProgress";
  PLAYBACK_RATE_CHANGED: "playbackRateChanged";
  PLAYBACK_SEEKED: "playbackSeeked";
  PLAYBACK_SEEKING: "playbackSeeking";
  PLAYBACK_STALLED: "playbackStalled";
  PLAYBACK_STARTED: "playbackStarted";
  PLAYBACK_TIME_UPDATED: "playbackTimeUpdated";
  PLAYBACK_VOLUME_CHANGED: "playbackVolumeChanged";
  PLAYBACK_WAITING: "playbackWaiting";
  PROTECTION_CREATED: "public_protectioncreated";
  PROTECTION_DESTROYED: "public_protectiondestroyed";
  QUALITY_CHANGE_RENDERED: "qualityChangeRendered";
  QUALITY_CHANGE_REQUESTED: "qualityChangeRequested";
  REPRESENTATION_SWITCH: "representationSwitch";
  STREAM_ACTIVATED: "streamActivated";
  STREAM_DEACTIVATED: "streamDeactivated";
  STREAM_INITIALIZED: "streamInitialized";
  STREAM_INITIALIZING: "streamInitializing";
  STREAM_TEARDOWN_COMPLETE: "streamTeardownComplete";
  STREAM_UPDATED: "streamUpdated";
  TEXT_TRACKS_ADDED: "allTextTracksAdded";
  TEXT_TRACK_ADDED: "textTrackAdded";
  THROUGHPUT_MEASUREMENT_STORED: "throughputMeasurementStored";
  TRACK_CHANGE_RENDERED: "trackChangeRendered";
  TTML_PARSED: "ttmlParsed";
  TTML_TO_PARSE: "ttmlToParse";
}

// diffrent mpd files
const mpdSrcArray = [
  {
    bigBuckBunny: "https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd",
  },
  {
    tearsOfSteel: "https://dash.akamaized.net/akamai/hd/tears/tears.mpd",
  },
  {
    sintel: "https://bitmovin-a.akamaihd.net/content/sintel/sintel.mpd",
  },
  {
    angelOne:
      "https://storage.googleapis.com/shaka-demo-assets/angel-one/dash.mpd",
  },
];
