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

  describe("getRenditionBitrate", () => {
    it("should return the bitrate of the current video rendition", () => {
      const currentBitrate = {
        bitrate: 987654,
        height: 360,
        mediaType: "video",
        qualityIndex: 2,
        scanType: null,
        width: 854,
      };
      tracker.getDashBitrate = jest.fn().mockReturnValue(currentBitrate);

      const result = tracker.getRenditionBitrate();

      expect(result).toBe(currentBitrate.bitrate);
    });
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

  describe("getRenditionName", () => {
    it("should return the label of the current video rendition", () => {
      const currentBitrate = {
        bitrate: 987654,
        height: 360,
        mediaType: "video",
        qualityIndex: 2,
        scanType: null,
        width: 854,
        label: "360p",
      };
      tracker.getDashBitrate = jest.fn().mockReturnValue(currentBitrate);

      const result = tracker.getRenditionName();

      expect(result).toBe(currentBitrate.label);
    });

    it("should return undefined if the current video rendition is not available", () => {
      tracker.getDashBitrate = jest.fn().mockReturnValue(undefined);

      const result = tracker.getRenditionName();

      expect(result).toBeUndefined();
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

  it("should call sendResume and sendStart on onPlaying", () => {
    tracker.onPlaying();
    expect(tracker.sendResume).toHaveBeenCalled();
    expect(tracker.sendStart).toHaveBeenCalled();
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
    const event = { detail: "error" };
    tracker.onError(event);
    expect(tracker.sendError).toHaveBeenCalledWith(event.detail);
  });

  it("should call sendEnd on onEnded", () => {
    tracker.onEnded();
    expect(tracker.sendEnd).toHaveBeenCalled();
  });
});
