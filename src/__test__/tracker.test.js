import DashTracker from "../tracker";
import { version } from "../../package.json";

const player = {
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  duration: jest.fn(),
  getCurrentTime: jest.fn(),
  getPlaybackRate: jest.fn(),
  getBufferedRanges: jest.fn(),
  getSeekableRanges: jest.fn(),
  getQualityFor: jest.fn(),
  on: jest.fn(),
  getSource: jest.fn(),
  getCurrentTrackFor: jest.fn(),
  setPlayer: jest.fn(),
  getVersion: jest.fn().mockReturnValue('4.0.0'),
};

const videoBitrateList = [
  {
    bitrate: 258157,
    height: 180,
    mediaType: "video",
    qualityIndex: 0,
    scanType: null,
    width: 426,
  },
  {
    bitrate: 512345,
    height: 240,
    mediaType: "video",
    qualityIndex: 1,
    scanType: null,
    width: 640,
  },
  {
    bitrate: 987654,
    height: 360,
    mediaType: "video",
    qualityIndex: 2,
    scanType: null,
    width: 854,
  },
  {
    bitrate: 1234567,
    height: 480,
    mediaType: "video",
    qualityIndex: 3,
    scanType: null,
    width: 1280,
  },
  {
    bitrate: 2345678,
    height: 720,
    mediaType: "video",
    qualityIndex: 4,
    scanType: null,
    width: 1920,
  },
];

describe("Dash Tracker Attributes For Specified Event ", () => {
  let tracker;

  beforeEach(() => {
    tracker = new DashTracker(player, {});
  });

  it("should return the tracker name as dash", () => {
    //assertion
    expect(tracker.getTrackerName()).toBe("dash");
  });

  it("should return pacjage version 0.2.0", () => {
    expect(tracker.getTrackerVersion()).toBe(version);
  });

  it("should return source of player", () => {
    const url = "https://bitmovin-a.akamaihd.net/content/sintel/sintel.mpd";
    player.getSource = jest.fn().mockReturnValue(url);
    expect(tracker.getSrc()).toBe(url);
  });

  it("isLive should return true if player is dynamic", () => {
    player.isDynamic = jest.fn().mockReturnValue(true);
    expect(tracker.isLive()).toBe(true);
  });

  it("isLive should return false if player is not dynamic", () => {
    player.isDynamic = jest.fn().mockReturnValue(false);
    expect(tracker.isLive()).toBe(false);
  });

  it("should call setPlayer method of VideoTracker", () => {
    const tag = " ";
    tracker.setPlayer = jest.fn();
    tracker.setPlayer(player, tag);
    expect(tracker.setPlayer).toHaveBeenCalledWith(player, tag);
  });

  it("should return the duration of the player", () => {
    const mpd = 60;
    tracker.getDuration = player.duration.mockReturnValue(mpd);
    expect(tracker.getDuration()).toBe(mpd);
  });

  it("should return the playrate of the player", () => {
    const rate = 1;
    tracker.getPlayrate = player.getPlaybackRate.mockReturnValue(rate);
    expect(tracker.getPlayrate()).toBe(rate);
  });

  it("should return the mute status of the player", () => {
    const isMutedValue = true;
    tracker.player.isMuted = jest.fn().mockReturnValue(isMutedValue);
    expect(tracker.isMuted()).toBe(isMutedValue);
  });

  it("should return the version of the player", () => {
    const version = "1.0.0";
    tracker.player.getVersion = jest.fn().mockReturnValue(version);
    expect(tracker.getPlayerVersion()).toBe(version);
  });

  it("should return the preload value of the player", () => {
    const preloadValue = "auto";
    tracker.player.preload = jest.fn().mockReturnValue(preloadValue);
    expect(tracker.getPreload()).toBe(preloadValue);
  });

  it("should return the autoplay value of the player", () => {
    const autoplayValue = true;
    tracker.player.getAutoPlay = jest.fn().mockReturnValue(autoplayValue);
    expect(tracker.isAutoplayed()).toBe(autoplayValue);
  });
});

describe("getTrack", () => {
  let tracker;

  beforeEach(() => {
    tracker = new DashTracker(player, {});
  });

  const audio = {
    lang: "en",
  };
  player.getCurrentTrackFor = jest.fn().mockReturnValue(audio);

  it("should return the current track of the player", () => {
    const result = tracker.getTrack();
    expect(result).toEqual(audio);
  });

  it("should return the language of the current track", () => {
    const result = tracker.getLanguage(audio.lang);
    expect(result).toBe("en");
  });
});

describe("Bitrate Properties for Dash.js", () => {
  let tracker;

  beforeEach(() => {
    tracker = new DashTracker(player, {});
  });

  it("should return the bitrate info for the specified media type", () => {
    const videoBitrate = 2; // Assuming videoBitrate is 2 for testing purposes
    const expectedBitrateInfo = {
      bitrate: 987654,
      height: 360,
      mediaType: "video",
      qualityIndex: 2,
      scanType: null,
      width: 854,
    };
    tracker.player.getQualityFor = jest.fn().mockReturnValue(videoBitrate);
    tracker.player.getBitrateInfoListFor = jest
      .fn()
      .mockReturnValue(videoBitrateList);

    const result = tracker.getDashBitrate("video");

    expect(result).toEqual(expectedBitrateInfo);
  });

  describe("getRenditionWidth", () => {
    it("should return the width of the current video rendition", () => {
      const currentBitrate = {
        bitrate: 987654,
        height: 360,
        mediaType: "video",
        qualityIndex: 2,
        scanType: null,
        width: 854,
      };
      tracker.getDashBitrate = jest.fn().mockReturnValue(currentBitrate);

      const result = tracker.getRenditionWidth();

      expect(result).toBe(currentBitrate.width);
    });
  });

  describe("getRenditionHeight", () => {
    it("should return the height of the current video rendition", () => {
      const currentBitrate = {
        bitrate: 987654,
        height: 360,
        mediaType: "video",
        qualityIndex: 2,
        scanType: null,
        width: 854,
      };
      tracker.getDashBitrate = jest.fn().mockReturnValue(currentBitrate);

      const result = tracker.getRenditionHeight();

      expect(result).toBe(currentBitrate.height);
    });
  });

});

describe("registerListeners", () => {
  let tracker;

  beforeEach(() => {
    tracker = new DashTracker(player, {});
  });

  it("should register event listeners for various video events", () => {
    const mockOnReady = jest.fn();
    const mockOnDownload = jest.fn();
    const mockOnPlay = jest.fn();
    const mockOnPlaying = jest.fn();
    const mockOnPause = jest.fn();
    const mockOnSeeking = jest.fn();
    const mockOnSeeked = jest.fn();
    const mockOnError = jest.fn();
    const mockOnEnded = jest.fn();
    const mockOnBufferingStalled = jest.fn();
    const mockOnBufferingLoaded = jest.fn();
    const mockOnAdaptation = jest.fn();

    tracker.onReady = mockOnReady;
    tracker.onDownload = mockOnDownload;
    tracker.onPlay = mockOnPlay;
    tracker.onPlaying = mockOnPlaying;
    tracker.onPause = mockOnPause;
    tracker.onSeeking = mockOnSeeking;
    tracker.onSeeked = mockOnSeeked;
    tracker.onError = mockOnError;
    tracker.onEnded = mockOnEnded;
    tracker.onBufferingStalled = mockOnBufferingStalled;
    tracker.onBufferingLoaded = mockOnBufferingLoaded;
    tracker.onAdaptation = mockOnAdaptation;

    tracker.registerListeners();

    expect(tracker.tag.on).toHaveBeenCalledWith(
      "streamInitialized",
      expect.any(Function)
    );
    expect(tracker.tag.on).toHaveBeenCalledWith(
      "playbackMetaDataLoaded",
      expect.any(Function)
    );
    expect(tracker.tag.on).toHaveBeenCalledWith(
      "playbackLoadedData",
      expect.any(Function)
    );
    expect(tracker.tag.on).toHaveBeenCalledWith(
      "canPlay",
      expect.any(Function)
    );
    expect(tracker.tag.on).toHaveBeenCalledWith(
      "playbackPlaying",
      expect.any(Function)
    );
    expect(tracker.tag.on).toHaveBeenCalledWith(
      "playbackPaused",
      expect.any(Function)
    );
    expect(tracker.tag.on).toHaveBeenCalledWith(
      "playbackSeeking",
      expect.any(Function)
    );
    expect(tracker.tag.on).toHaveBeenCalledWith(
      "playbackSeeked",
      expect.any(Function)
    );
    expect(tracker.tag.on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(tracker.tag.on).toHaveBeenCalledWith(
      "playbackError",
      expect.any(Function)
    );
    expect(tracker.tag.on).toHaveBeenCalledWith(
      "playbackEnded",
      expect.any(Function)
    );
    expect(tracker.player.on).toHaveBeenCalledWith(
      "bufferStalled",
      expect.any(Function)
    );
    expect(tracker.player.on).toHaveBeenCalledWith(
      "bufferLoaded",
      expect.any(Function)
    );
    expect(tracker.player.on).toHaveBeenCalledWith(
      "qualityChangeRendered",
      expect.any(Function)
    );
  });
});

describe("unregisterListeners", () => {
  let tracker;

  beforeEach(() => {
    tracker = new DashTracker(player, {});
  });

  it("should unregister event listeners for various video events", () => {
    const mockOff = jest.fn();

    tracker.tag.off = mockOff;
    tracker.player.off = mockOff;

    tracker.unregisterListeners();

    expect(tracker.tag.off).toHaveBeenCalledWith(
      "streamInitialized",
      tracker.onReady
    );
    expect(tracker.tag.off).toHaveBeenCalledWith(
      "playbackMetaDataLoaded",
      tracker.onDownload
    );
    expect(tracker.tag.off).toHaveBeenCalledWith(
      "playbackLoadedData",
      tracker.onDownload
    );
    expect(tracker.tag.off).toHaveBeenCalledWith("canPlay", tracker.onPlay);
    expect(tracker.tag.off).toHaveBeenCalledWith(
      "playbackPlaying",
      tracker.onPlaying
    );
    expect(tracker.tag.off).toHaveBeenCalledWith(
      "playbackPaused",
      tracker.onPause
    );
    expect(tracker.tag.off).toHaveBeenCalledWith(
      "playbackSeeking",
      tracker.onSeeking
    );
    expect(tracker.tag.off).toHaveBeenCalledWith(
      "playbackSeeked",
      tracker.onSeeked
    );
    expect(tracker.tag.off).toHaveBeenCalledWith(
      "playbackError",
      tracker.onError
    );
    expect(tracker.tag.off).toHaveBeenCalledWith(
      "playbackEnded",
      tracker.onEnded
    );
    expect(tracker.player.off).toHaveBeenCalledWith(
      "bufferStalled",
      tracker.onBufferingStalled
    );
    expect(tracker.player.off).toHaveBeenCalledWith(
      "bufferLoaded",
      tracker.onBufferingLoaded
    );
    expect(tracker.player.off).toHaveBeenCalledWith(
      "qualityChangeRendered",
      tracker.onAdaptation
    );
  });
});

describe("Tracker Event Handlers", () => {
  let tracker;
  beforeEach(() => {
    // create a new instance of the tracker before each test

    tracker = new DashTracker(player, {});

    // mock the methods being called in the event handlers
    tracker.sendPlayerReady = jest.fn();
    tracker.sendDownload = jest.fn();
    tracker.sendRequest = jest.fn();
    tracker.sendResume = jest.fn();
    tracker.sendStart = jest.fn();
    tracker.sendRenditionChanged = jest.fn();
    tracker.sendBufferStart = jest.fn();
    tracker.sendBufferEnd = jest.fn();
    tracker.sendPause = jest.fn();
    tracker.sendSeekStart = jest.fn();
    tracker.sendSeekEnd = jest.fn();
    tracker.sendError = jest.fn();
    tracker.sendEnd = jest.fn();
  });

  it("should call sendPlayerReady on onReady", () => {
    tracker.onReady();
    expect(tracker.sendPlayerReady).toHaveBeenCalled();
  });

  it("should call sendDownload on onDownload", () => {
    const eventMock = { type: "download" };
    tracker.onDownload(eventMock);
    expect(tracker.sendDownload).toHaveBeenCalledWith({
      state: eventMock.type,
    });
  });

  it("should call sendRequest on onPlay", () => {
    tracker.onPlay();
    expect(tracker.sendRequest).toHaveBeenCalled();
  });

  // CONTENT_START deliberately no longer comes from onPlaying. It moved to
  // playbackTimeUpdated so a pre-roll can defer it rather than lose it — see
  // the "CONTENT_START" describe block below and spec 9.2.1.
  it("should call sendResume but not sendStart on onPlaying", () => {
    tracker.onPlaying();
    expect(tracker.sendResume).toHaveBeenCalled();
    expect(tracker.sendStart).not.toHaveBeenCalled();
  });

  it("should call sendRenditionChanged on onAdaptation", () => {
    const event = { type: "adaptation" };
    tracker.onAdaptation(event);
    expect(tracker.sendRenditionChanged).toHaveBeenCalled();
  });

  it("should call sendBufferStart on onBufferingStalled", () => {
    tracker.onBufferingStalled();
    expect(tracker.sendBufferStart).toHaveBeenCalled();
  });

  it("should call sendBufferEnd on onBufferingLoaded", () => {
    tracker.onBufferingLoaded();
    expect(tracker.sendBufferEnd).toHaveBeenCalled();
  });

  it("should call sendPause on onPause", () => {
    tracker.onPause();
    expect(tracker.sendPause).toHaveBeenCalled();
  });

  it("should call sendSeekStart on onSeeking", () => {
    tracker.onSeeking();
    expect(tracker.sendSeekStart).toHaveBeenCalled();
  });

  it("should call sendSeekEnd on onSeeked", () => {
    tracker.onSeeked();
    expect(tracker.sendSeekEnd).toHaveBeenCalled();
  });

  it("should call sendError on onError", () => {
    const event = { error: { code: 1, message: "error" } };
    tracker.onError(event);
    expect(tracker.sendError).toHaveBeenCalledWith({ errorCode: event.error.code, errorMessage: event.error.message });
  });

  it("should call sendEnd on onEnded", () => {
    tracker.onEnded();
    expect(tracker.sendEnd).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// dash.js 5 rendition payloads (spec 10.1.1)
//
// Shape measured verbatim against dash.js 5.3.0 on 2026-11-09:
//   Object.keys(e) -> ['mediaType','oldRepresentation','newRepresentation',
//                      'streamId','type']
//   e.newRepresentation.bandwidth -> 274000   (directly on the object)
//   e.oldRepresentation           -> null     (on a stream's FIRST switch)
// oldQuality / newQuality are absent entirely, so the pre-existing code read
// undefined for both and reported oldBitrate: null, newBitrate: null.
// ---------------------------------------------------------------------------
describe("onAdaptation across dash.js majors", () => {
  function makeTracker(version, playerOverrides = {}) {
    const p = {
      on: jest.fn(),
      off: jest.fn(),
      getVersion: jest.fn().mockReturnValue(version),
      getBitrateInfoListFor: jest.fn().mockReturnValue(videoBitrateList),
      getRepresentationsByType: jest.fn().mockReturnValue(videoBitrateList),
      ...playerOverrides,
    };
    const tracker = new DashTracker(p, {});
    tracker.sendRenditionChanged = jest.fn();
    return tracker;
  }

  it("reports rendition bitrates from a dash.js 4 qualityChangeRendered payload", () => {
    const tracker = makeTracker("4.7.4");

    tracker.onAdaptation({ oldQuality: 1, newQuality: 3, mediaType: "video" });

    expect(tracker.sendRenditionChanged).toHaveBeenCalledWith({
      oldBitrate: 512345,
      newBitrate: 1234567,
    });
  });

  it("reports rendition bitrates from a dash.js 5 qualityChangeRendered payload", () => {
    const tracker = makeTracker("5.3.0");

    tracker.onAdaptation({
      mediaType: "video",
      oldRepresentation: { bandwidth: 274000, width: 1280, height: 720, index: 0, id: "1" },
      newRepresentation: { bandwidth: 2142460, width: 1920, height: 1080, index: 4, id: "5" },
      streamId: "s1",
      type: "qualityChangeRendered",
    });

    expect(tracker.sendRenditionChanged).toHaveBeenCalledWith({
      oldBitrate: 274000,
      newBitrate: 2142460,
    });
  });

  // Measured: oldRepresentation is null on the very first switch of a stream,
  // on both the VOD and live runs. This is the one new crash path the fix could
  // introduce, so it gets its own test.
  it("tolerates a null oldRepresentation on a stream's first switch", () => {
    const tracker = makeTracker("5.3.0");

    expect(() =>
      tracker.onAdaptation({
        mediaType: "video",
        oldRepresentation: null,
        newRepresentation: { bandwidth: 274000 },
      })
    ).not.toThrow();

    expect(tracker.sendRenditionChanged).toHaveBeenCalledWith({
      oldBitrate: null,
      newBitrate: 274000,
    });
  });

  // Review Focus 1. getVersion() returning nothing leaves majorVersion
  // undefined, and `undefined >= 5` is false — so a version check alone sends a
  // dash.js 5 player down the v4 path, where both reads are undefined and the
  // rendition change reports null bitrates for the whole session (spec 13.5).
  it("falls back to feature detection when getVersion() returns nothing", () => {
    const tracker = makeTracker(undefined);
    expect(tracker.majorVersion).toBeUndefined();

    tracker.onAdaptation({
      mediaType: "video",
      oldRepresentation: { bandwidth: 274000 },
      newRepresentation: { bandwidth: 400000 },
    });

    expect(tracker.sendRenditionChanged).toHaveBeenCalledWith({
      oldBitrate: 274000,
      newBitrate: 400000,
    });
  });

  it("still reports null bitrates when neither payload shape is present", () => {
    const tracker = makeTracker("5.3.0");

    tracker.onAdaptation({ mediaType: "video" });

    expect(tracker.sendRenditionChanged).toHaveBeenCalledWith({
      oldBitrate: null,
      newBitrate: null,
    });
  });
});

// ---------------------------------------------------------------------------
// The DAI content guard (spec 9.1, 9.2)
//
// NOTE on fixtures: the project's video-core mock has `setAdsTracker() {}` as a
// no-op and no `state` object at all, so these tests assign `tracker.adsTracker`
// and `tracker.state` directly. That is deliberate — the guard's logic is what
// is under test here, not video-core's wiring.
// ---------------------------------------------------------------------------
function fakeAdsTracker(overrides = {}) {
  return {
    isAd: () => true,
    isAdPlaying: jest.fn(() => false),
    getCurrentAdBreak: jest.fn(() => null),
    ...overrides,
  };
}

function guardedTracker(adsTracker, playerOverrides = {}) {
  const p = {
    on: jest.fn(),
    off: jest.fn(),
    getVersion: jest.fn().mockReturnValue("5.3.0"),
    time: jest.fn().mockReturnValue(12.5),
    duration: jest.fn().mockReturnValue(600),
    isDynamic: jest.fn().mockReturnValue(false),
    ...playerOverrides,
  };
  const tracker = new DashTracker(p, {});
  if (adsTracker !== undefined) tracker.adsTracker = adsTracker;
  tracker.state = {};
  [
    "sendRequest", "sendResume", "sendStart", "sendPause", "sendSeekStart",
    "sendSeekEnd", "sendBufferStart", "sendBufferEnd", "sendRenditionChanged",
    "sendError", "sendEnd",
  ].forEach((m) => { tracker[m] = jest.fn(); });
  return tracker;
}

describe("isAdsTrackerActive", () => {
  it("is false when there is no ads tracker at all", () => {
    const tracker = guardedTracker(undefined);
    expect(tracker.isAdsTrackerActive()).toBe(false);
  });

  it("prefers isAdPlaying(), which covers the start of a pre-roll", () => {
    const ads = fakeAdsTracker({ isAdPlaying: jest.fn(() => true) });
    const tracker = guardedTracker(ads);

    expect(tracker.isAdsTrackerActive()).toBe(true);
    expect(ads.isAdPlaying).toHaveBeenCalled();
    // The break object must not even be consulted when isAdPlaying answered.
    expect(ads.getCurrentAdBreak).not.toHaveBeenCalled();
  });

  it("falls back to the current ad break when isAdPlaying is absent", () => {
    const ads = fakeAdsTracker({
      isAdPlaying: undefined,
      getCurrentAdBreak: jest.fn(() => ({ adCount: 3 })),
    });
    const tracker = guardedTracker(ads);
    expect(tracker.isAdsTrackerActive()).toBe(true);
  });

  // Scoped to a break IN PROGRESS, never the permanent isAd() flag: under SSAI
  // the ads tracker stays attached for the whole session, so content
  // pause/seek/buffer must keep reporting between breaks.
  it("resumes content reporting between breaks even though isAd() stays true", () => {
    const ads = fakeAdsTracker({ isAdPlaying: jest.fn(() => false) });
    const tracker = guardedTracker(ads);

    expect(ads.isAd()).toBe(true);
    expect(tracker.isAdsTrackerActive()).toBe(false);

    tracker.onPause();
    expect(tracker.sendPause).toHaveBeenCalled();
  });

  // Review Focus 3. video-core's disposeAdsTracker() nulls the ads tracker's
  // player and tag but leaves the parent's reference in place, so the guard
  // keeps calling into a disposed object. It must be inert, not throw.
  it("stays inert when the ads tracker has been disposed", () => {
    const disposed = {
      isAd: () => true,
      // A disposed DaiTracker answers false here rather than throwing.
      isAdPlaying: () => false,
      getCurrentAdBreak: () => null,
    };
    const tracker = guardedTracker(disposed);

    expect(() => tracker.isAdsTrackerActive()).not.toThrow();
    expect(tracker.isAdsTrackerActive()).toBe(false);
    tracker.onPause();
    expect(tracker.sendPause).toHaveBeenCalled();
  });

  it("does not throw when the ads tracker exposes neither predicate", () => {
    const tracker = guardedTracker({ isAd: () => true });
    expect(() => tracker.isAdsTrackerActive()).not.toThrow();
    expect(tracker.isAdsTrackerActive()).toBe(true);
  });
});

describe("canCloseContentTransition", () => {
  // The asymmetry: OPENING a content transition during a break is suppressed,
  // CLOSING one already open is not. video-core bills (stopTime - startTime) to
  // totalRebufferingTime, so holding a transition open across a break charges
  // the whole ad pod to content.
  it("allows closing a transition that was already open when the break began", () => {
    const ads = fakeAdsTracker({ isAdPlaying: jest.fn(() => true) });
    const tracker = guardedTracker(ads);
    tracker.state = { isBuffering: true };

    expect(tracker.canCloseContentTransition("isBuffering")).toBe(true);
    expect(tracker.canCloseContentTransition("isSeeking")).toBe(false);
  });

  it("allows closing anything when no break is in progress", () => {
    const tracker = guardedTracker(fakeAdsTracker());
    expect(tracker.canCloseContentTransition("isBuffering")).toBe(true);
  });
});

describe("CONTENT_START", () => {
  it("emits CONTENT_START from playbackTimeUpdated, not playbackPlaying", () => {
    const tracker = guardedTracker(undefined);

    tracker.onPlaying();
    expect(tracker.sendStart).not.toHaveBeenCalled();
    expect(tracker.sendResume).toHaveBeenCalled();

    tracker.onTimeUpdated();
    expect(tracker.sendStart).toHaveBeenCalledTimes(1);
  });

  it("registers playbackTimeUpdated", () => {
    const tracker = guardedTracker(undefined);
    tracker.registerListeners();
    expect(tracker.player.on).toHaveBeenCalledWith(
      "playbackTimeUpdated",
      expect.any(Function)
    );
  });

  // Suppressing sendStart in onPlaying ALONE would lose CONTENT_START for the
  // session rather than defer it: playbackPlaying does not fire again at a
  // seamless SSAI boundary, and video-core never retries (spec 9.2.1).
  it("emits CONTENT_START after a pre-roll ends, not during it", () => {
    const ads = fakeAdsTracker({ isAdPlaying: jest.fn(() => true) });
    const tracker = guardedTracker(ads);

    tracker.onPlaying();
    tracker.onTimeUpdated();
    tracker.onTimeUpdated();
    expect(tracker.sendStart).not.toHaveBeenCalled();

    ads.isAdPlaying.mockReturnValue(false); // break ends
    tracker.onTimeUpdated();

    expect(tracker.sendStart).toHaveBeenCalledTimes(1);
  });

  // playbackTimeUpdated fires continuously, so the tracker calls sendStart on
  // every ungated tick and video-core's isStarted flag collapses them to one
  // CONTENT_START. The project mock cannot observe that, so this replays the
  // real gate (video-core 5.1.1) and asserts the REPORTED count — proving a
  // future guard change cannot produce a second start.
  it("emits CONTENT_START exactly once across a whole session", () => {
    const ads = fakeAdsTracker({ isAdPlaying: jest.fn(() => false) });
    const tracker = guardedTracker(ads);
    const reported = [];
    let isStarted = false;
    tracker.sendStart = () => {
      if (isStarted) return; // goStart() is a no-op once isStarted is set
      isStarted = true;
      reported.push("CONTENT_START");
    };

    for (let i = 0; i < 5; i += 1) tracker.onTimeUpdated();
    ads.isAdPlaying.mockReturnValue(true); // mid-roll
    for (let i = 0; i < 5; i += 1) tracker.onTimeUpdated();
    ads.isAdPlaying.mockReturnValue(false);
    for (let i = 0; i < 5; i += 1) tracker.onTimeUpdated();

    expect(reported).toEqual(["CONTENT_START"]);
  });

  it("does not emit CONTENT_START before the playhead has advanced", () => {
    const tracker = guardedTracker(undefined, { time: jest.fn(() => 0) });
    tracker.onTimeUpdated();
    expect(tracker.sendStart).not.toHaveBeenCalled();
  });

  // Deliberately unguarded: the viewer DID request content. video-core
  // subtracts total ad time from startupTime, so this ordering is what makes
  // that KPI correct.
  it("does not guard onPlay, so CONTENT_REQUEST still fires before a pre-roll", () => {
    const tracker = guardedTracker(fakeAdsTracker({ isAdPlaying: () => true }));
    tracker.onPlay();
    expect(tracker.sendRequest).toHaveBeenCalled();
  });
});

describe("guarded content transitions during a break", () => {
  it("suppresses content pause, seek start and buffer start during a break", () => {
    const tracker = guardedTracker(fakeAdsTracker({ isAdPlaying: () => true }));

    tracker.onPause();
    tracker.onSeeking();
    tracker.onBufferingStalled();
    tracker.onPlaying();

    expect(tracker.sendPause).not.toHaveBeenCalled();
    expect(tracker.sendSeekStart).not.toHaveBeenCalled();
    expect(tracker.sendBufferStart).not.toHaveBeenCalled();
    expect(tracker.sendResume).not.toHaveBeenCalled();
  });

  it("still closes a buffer or seek that was already open when the break began", () => {
    const tracker = guardedTracker(fakeAdsTracker({ isAdPlaying: () => true }));
    tracker.state = { isBuffering: true, isSeeking: true };

    tracker.onBufferingLoaded();
    tracker.onSeeked();

    expect(tracker.sendBufferEnd).toHaveBeenCalled();
    expect(tracker.sendSeekEnd).toHaveBeenCalled();
  });

  it("does not close a transition that was never open during a break", () => {
    const tracker = guardedTracker(fakeAdsTracker({ isAdPlaying: () => true }));
    tracker.state = {};

    tracker.onBufferingLoaded();
    tracker.onSeeked();

    expect(tracker.sendBufferEnd).not.toHaveBeenCalled();
    expect(tracker.sendSeekEnd).not.toHaveBeenCalled();
  });

  it("reports all content transitions normally with no ads tracker", () => {
    const tracker = guardedTracker(undefined);

    tracker.onPause();
    tracker.onSeeking();
    tracker.onBufferingStalled();
    tracker.onBufferingLoaded();
    tracker.onSeeked();
    tracker.onPlaying();

    expect(tracker.sendPause).toHaveBeenCalled();
    expect(tracker.sendSeekStart).toHaveBeenCalled();
    expect(tracker.sendBufferStart).toHaveBeenCalled();
    expect(tracker.sendBufferEnd).toHaveBeenCalled();
    expect(tracker.sendSeekEnd).toHaveBeenCalled();
    expect(tracker.sendResume).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Rendition changes during ad breaks (spec 9.2.2)
//
// This is the one decision that diverges from hls.js, where onQualityChange is
// unguarded. Measured 2026-11-09, the premise holds: qualityChangeRendered DOES
// fire inside breaks. VOD reported 274000 at the pre-roll's start against
// 2142460 for the content either side; live reported 334000 and 335000 inside
// the break and 400000 after it.
//
// The value itself is accurate — dash.js 5 carries bandwidth directly — but it
// describes the AD's representation while the event we emit from it is labelled
// CONTENT_RENDITION_CHANGE. A consumer reading that at 274 kbps concludes the
// viewer's content dropped to 274 kbps, which never happened.
// ---------------------------------------------------------------------------
describe("rendition changes during ad breaks", () => {
  const v5Payload = {
    mediaType: "video",
    oldRepresentation: { bandwidth: 2142460 },
    newRepresentation: { bandwidth: 274000 },
  };

  it("suppresses rendition changes during a break", () => {
    const tracker = guardedTracker(fakeAdsTracker({ isAdPlaying: () => true }));

    tracker.onAdaptation(v5Payload);

    expect(tracker.sendRenditionChanged).not.toHaveBeenCalled();
  });

  it("reports rendition changes normally between breaks", () => {
    const ads = fakeAdsTracker({ isAdPlaying: jest.fn(() => true) });
    const tracker = guardedTracker(ads);

    tracker.onAdaptation(v5Payload);
    expect(tracker.sendRenditionChanged).not.toHaveBeenCalled();

    ads.isAdPlaying.mockReturnValue(false); // break ends
    tracker.onAdaptation({
      mediaType: "video",
      oldRepresentation: { bandwidth: 274000 },
      newRepresentation: { bandwidth: 2142460 },
    });

    expect(tracker.sendRenditionChanged).toHaveBeenCalledTimes(1);
    expect(tracker.sendRenditionChanged).toHaveBeenCalledWith({
      oldBitrate: 274000,
      newBitrate: 2142460,
    });
  });

  it("reports rendition changes when there is no ads tracker", () => {
    const tracker = guardedTracker(undefined);
    tracker.onAdaptation(v5Payload);
    expect(tracker.sendRenditionChanged).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Error robustness, and the fatality question (spec 9.4)
//
// MEASURED 2026-11-09 against dash.js 5.3.0 by forcing a manifest 404:
//
//   Object.keys(e)       -> ['error', 'type']
//   Object.keys(e.error) -> ['code', 'message', 'data']
//   'fatal' in e.error   -> false
//   e.error.severity     -> undefined
//
// There is no fatality flag and no severity field. None of dash.js's 87 events
// matches /WARN|RECOVER|RETRY/, and MediaPlayer.errors is a registry of code
// constants and messages that classifies WHAT failed, never how badly. So
// hls.js's `data.fatal === false` filter has nothing to port, and no predicate
// is invented to mimic it — reporting every error is correct behaviour here
// rather than an oversight.
// ---------------------------------------------------------------------------
describe("onError", () => {
  // Review Focus 5. e.error.code was dereferenced unguarded, so an error event
  // without an error payload threw straight into dash.js's event dispatch.
  it("does not throw when an error event carries no error payload", () => {
    const tracker = guardedTracker(undefined);

    expect(() => tracker.onError({ type: "error" })).not.toThrow();
    expect(() => tracker.onError({})).not.toThrow();
    expect(() => tracker.onError(undefined)).not.toThrow();
  });

  it("still reports an error when the payload is missing, rather than staying silent", () => {
    const tracker = guardedTracker(undefined);

    tracker.onError({ type: "error" });

    expect(tracker.sendError).toHaveBeenCalledWith({
      errorCode: undefined,
      errorMessage: "Unknown dash.js error",
    });
  });

  it("still reports errorCode and errorMessage when the payload is present", () => {
    const tracker = guardedTracker(undefined);

    tracker.onError({
      type: "error",
      error: {
        code: 25,
        message: "http://localhost:8777/does-not-exist.mpd is not available",
        data: { request: {}, response: {} },
      },
    });

    expect(tracker.sendError).toHaveBeenCalledWith({
      errorCode: 25,
      errorMessage: "http://localhost:8777/does-not-exist.mpd is not available",
    });
  });

  // Pins the measured finding. If a future dash.js adds a fatality flag this
  // test is the place to revisit — but it must not be "fixed" by inventing a
  // code allowlist, which would be a guess dressed as a filter.
  it("reports every error, because dash.js exposes no fatality flag", () => {
    const tracker = guardedTracker(undefined);

    tracker.onError({ type: "error", error: { code: 25, message: "manifest 404" } });
    tracker.onError({ type: "playbackError", error: { code: 10, message: "append" } });
    tracker.onError({ type: "error", error: { code: 23, message: "fragment" } });

    expect(tracker.sendError).toHaveBeenCalledTimes(3);
  });

  it("is registered for both the error and playbackError channels", () => {
    const tracker = guardedTracker(undefined);
    tracker.registerListeners();

    expect(tracker.player.on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(tracker.player.on).toHaveBeenCalledWith("playbackError", expect.any(Function));
  });
});

// ---------------------------------------------------------------------------
// Content-time conversion (spec 9.3)
//
// Under SSAI the stitched stream's clock includes every ad played so far, so
// reporting it directly overstates content progress by the cumulative ad
// duration.
//
// MEASURED 2026-11-09, which is what decided the shape of this:
//   VOD  — contentTimeForStreamTime subtracts ad time correctly. Content time
//          reads 0 for the whole 10.01s pre-roll, then the gap settles at
//          exactly 10.010 (stream 10.648 -> content 0.638).
//   LIVE — it is an identity. The playhead returned unchanged across 14
//          samples, and so did player.duration() (60 -> 60).
//
// Live is therefore harmless, so there is deliberately NO isLive() skip and no
// live test: a skip would add a branch, diverge from hls.js, and change nothing.
// ---------------------------------------------------------------------------
describe("content time conversion", () => {
  it("converts contentPlayhead to content time via the ads tracker", () => {
    const ads = fakeAdsTracker({
      // Mirrors the measured VOD behaviour: 10.01s of ads played so far.
      contentTimeForStreamTime: jest.fn((streamTime) => streamTime - 10.01),
    });
    const tracker = guardedTracker(ads, { time: jest.fn(() => 10.648) });

    expect(tracker.getPlayhead()).toBeCloseTo(638, 0);
    expect(ads.contentTimeForStreamTime).toHaveBeenCalledWith(10.648);
  });

  it("converts contentDuration to content time as well", () => {
    const ads = fakeAdsTracker({
      contentTimeForStreamTime: jest.fn((t) => t - 30),
    });
    const tracker = guardedTracker(ads, { duration: jest.fn(() => 764.197) });

    // Still seconds: rescaling to ms is Task 12 and is blocked on a release
    // decision, so this task must not touch the unit.
    expect(tracker.getDuration()).toBeCloseTo(734.197, 3);
  });

  it("reports stream time unchanged when there is no ads tracker", () => {
    const tracker = guardedTracker(undefined, { time: jest.fn(() => 12.5) });
    expect(tracker.getPlayhead()).toBe(12500);
  });

  it("reports stream time unchanged when the SDK cannot convert", () => {
    const ads = fakeAdsTracker({
      contentTimeForStreamTime: jest.fn(() => undefined),
    });
    const tracker = guardedTracker(ads, { time: jest.fn(() => 12.5) });
    expect(tracker.getPlayhead()).toBe(12500);
  });

  it("reports stream time unchanged when the conversion is not finite", () => {
    const ads = fakeAdsTracker({
      contentTimeForStreamTime: jest.fn(() => NaN),
    });
    const tracker = guardedTracker(ads, { time: jest.fn(() => 12.5) });
    expect(tracker.getPlayhead()).toBe(12500);
  });

  it("reports stream time unchanged when the ads tracker cannot convert at all", () => {
    const ads = fakeAdsTracker({ contentTimeForStreamTime: undefined });
    const tracker = guardedTracker(ads, { time: jest.fn(() => 12.5) });
    expect(tracker.getPlayhead()).toBe(12500);
  });

  // The measured live case: an identity conversion must be indistinguishable
  // from no conversion, which is why no isLive() skip is needed.
  it("is harmless when the conversion is an identity, as measured on live", () => {
    const ads = fakeAdsTracker({
      contentTimeForStreamTime: jest.fn((t) => t),
    });
    const tracker = guardedTracker(ads, {
      time: jest.fn(() => 179378221.608),
      duration: jest.fn(() => 60),
      isDynamic: jest.fn(() => true),
    });

    expect(tracker.getPlayhead()).toBeCloseTo(179378221608, 0);
    expect(tracker.getDuration()).toBe(60);
  });
});
