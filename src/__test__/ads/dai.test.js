// Runs under the project default testEnvironment: "node", deliberately.
//
// Spec 13.2 assumed these tests would need a per-file `@jest-environment jsdom`
// docblock because "the DAI tests need a DOM". Writing them showed the premise
// is wrong: every fixture here is a plain object — the tag is
// `{ currentTime, duration, muted }`, the StreamManager is a listener map — and
// nothing touches `document` or `window`. `jest-environment-jsdom` is not
// installed in this repo (Jest 29 ships it separately), and adding a
// devDependency no test exercises would be unjustified. If a later test ever
// needs a real <video>, add `jest-environment-jsdom@29.7.0` to match the
// sibling repo and put the docblock on that file only.

import DaiTracker from '../../ads/dai';
import nrvideo from '@newrelic/video-core';

// jest.config maps @newrelic/video-core to the package's __mock__.js, which is
// too permissive for this suite in three ways that matter: it never calls
// registerListeners(), it ignores options.tag, and it has no sendAdBreakStart,
// isAd or dispose at all. So this file supplies a base class faithful to the
// REAL video-core 5.1.1, read out of dist/cjs/index.js:
//
//   constructor(player, options) { ... player && this.setPlayer(player, options.tag) }
//   setPlayer(player, tag)       { tag = tag || player; ...; this.registerListeners() }
//   dispose()                    { ...; this.player = null; this.tag = null }
//   isAd()                       { return this.state.isAd() }
//
// Every send* still succeeds here — base-class GATING is replayed separately in
// the gated-tracker fixtures in Task 3/4's describe blocks.
jest.mock('@newrelic/video-core', () => {
  class VideoTracker {
    constructor(player, options) {
      this.options = options || {};
      this.state = { _isAd: false };
      this.adsTracker = null;
      if (player) this.setPlayer(player, this.options.tag);
    }

    setPlayer(player, tag) {
      this.player = player;
      this.tag = tag || player; // matches the real base: tag falls back to player
      this.registerListeners();
    }

    isAd() {
      return this.state._isAd;
    }

    setIsAd(value) {
      this.state._isAd = value;
    }

    // Mirrors the real base (dist/cjs/index.js): dispose nulls player AND tag,
    // which is what made a disposed tracker throw out of the content guard.
    dispose() {
      this.unregisterListeners();
      this.player = null;
      this.tag = null;
    }

    registerListeners() {}
    unregisterListeners() {}
    sendRequest() {}
    sendDownload() {}
    sendError() {}
    sendAdBreakStart() {}
    sendAdBreakEnd() {}
    sendStart() {}
    sendAdQuartile() {}
    sendEnd() {}
    sendPause() {}
    sendResume() {}
    sendAdClick() {}
    getTrackerVersion() {
      return '1.0.0';
    }
  }

  const mock = {
    VideoTracker,
    Core: { addTracker: jest.fn() },
    Log: { debug: jest.fn(), warn: jest.fn(), error: jest.fn(), notice: jest.fn() },
  };
  return { ...mock, default: mock };
});

// All 23 StreamEvent.Type values the real SDK exposes (spec 6.6). The four at
// the end are deliberately never registered.
const StreamEventType = {
  LOADED: 'loaded',
  STREAM_INITIALIZED: 'streamInitialized',
  ERROR: 'error',
  AD_BREAK_STARTED: 'adBreakStarted',
  AD_BREAK_ENDED: 'adBreakEnded',
  AD_PERIOD_STARTED: 'adPeriodStarted',
  AD_PERIOD_ENDED: 'adPeriodEnded',
  STARTED: 'started',
  FIRST_QUARTILE: 'firstquartile',
  MIDPOINT: 'midpoint',
  THIRD_QUARTILE: 'thirdquartile',
  COMPLETE: 'complete',
  SKIPPED: 'skipped',
  PAUSED: 'paused',
  RESUMED: 'resumed',
  CLICK: 'click',
  VIDEO_CLICKED: 'videoClicked',
  CUEPOINTS_CHANGED: 'cuepointsChanged',
  AD_PROGRESS: 'adProgress',
  // never registered:
  FOCUS: 'focus',
  HIDE_AD_UI: 'hideAdUi',
  SHOW_AD_UI: 'showAdUi',
  SKIPPABLE_STATE_CHANGED: 'skippableStateChanged',
};

// The 18 hls.js registers, plus AD_PROGRESS as a cache-only subscription.
const HANDLED_EVENT_TYPES = [
  StreamEventType.LOADED,
  StreamEventType.STREAM_INITIALIZED,
  StreamEventType.ERROR,
  StreamEventType.AD_BREAK_STARTED,
  StreamEventType.AD_BREAK_ENDED,
  StreamEventType.AD_PERIOD_STARTED,
  StreamEventType.AD_PERIOD_ENDED,
  StreamEventType.STARTED,
  StreamEventType.FIRST_QUARTILE,
  StreamEventType.MIDPOINT,
  StreamEventType.THIRD_QUARTILE,
  StreamEventType.COMPLETE,
  StreamEventType.SKIPPED,
  StreamEventType.PAUSED,
  StreamEventType.RESUMED,
  StreamEventType.CLICK,
  StreamEventType.VIDEO_CLICKED,
  StreamEventType.CUEPOINTS_CHANGED,
  StreamEventType.AD_PROGRESS,
];

const NEVER_REGISTERED = [
  StreamEventType.FOCUS,
  StreamEventType.HIDE_AD_UI,
  StreamEventType.SHOW_AD_UI,
  StreamEventType.SKIPPABLE_STATE_CHANGED,
];

beforeEach(() => {
  jest.clearAllMocks();
  global.google = {
    ima: { dai: { api: { StreamEvent: { Type: StreamEventType } } } },
  };
});

// Mirrors the StreamManager surface enumerated from the real SDK. Note there is
// NO getStreamTime: the SDK's time API takes a time rather than reporting one.
function createMockStreamManager() {
  const listeners = {};
  return {
    addEventListener: jest.fn((type, cb) => {
      listeners[type] = cb;
    }),
    removeEventListener: jest.fn((type) => {
      delete listeners[type];
    }),
    contentTimeForStreamTime: jest.fn((streamTime) => streamTime),
    _emit(type, event) {
      if (listeners[type]) listeners[type](event || {});
    },
    _listenerCount() {
      return Object.keys(listeners).length;
    },
  };
}

function createMockTag(currentTime = 3) {
  return { currentTime, duration: 120, muted: false };
}

function makeTracker(options) {
  const sm = createMockStreamManager();
  const tracker = new DaiTracker(sm, { tag: createMockTag(), ...options });
  return { sm, tracker };
}

describe('DaiTracker — construction & registration', () => {
  it('subscribes to exactly the 19 StreamEvent types it handles', () => {
    const { sm } = makeTracker();
    const subscribed = sm.addEventListener.mock.calls.map(([type]) => type).sort();
    expect(subscribed).toHaveLength(19);
    expect(subscribed).toEqual([...HANDLED_EVENT_TYPES].sort());
  });

  // AD_PROGRESS fires ~4/second and is registered as a cache only (spec 6.6).
  it('registers AD_PROGRESS, which hls.js does not', () => {
    const { sm } = makeTracker();
    const subscribed = sm.addEventListener.mock.calls.map(([type]) => type);
    expect(subscribed).toContain(StreamEventType.AD_PROGRESS);
  });

  it('does not subscribe to FOCUS, HIDE_AD_UI, SHOW_AD_UI or SKIPPABLE_STATE_CHANGED', () => {
    const { sm } = makeTracker();
    const subscribed = sm.addEventListener.mock.calls.map(([type]) => type);
    NEVER_REGISTERED.forEach((type) => expect(subscribed).not.toContain(type));
  });

  // Optional chaining does NOT protect an undeclared identifier — `google?.ima`
  // still throws a ReferenceError when the IMA script never loaded. The guard
  // has to be a typeof check.
  it('warns instead of throwing when the IMA DAI SDK is absent', () => {
    delete global.google;
    const sm = createMockStreamManager();
    let tracker;
    expect(() => {
      tracker = new DaiTracker(sm, { tag: createMockTag() });
    }).not.toThrow();
    expect(nrvideo.Log.warn).toHaveBeenCalledWith(
      expect.stringContaining('DAI API not available')
    );
    expect(sm.addEventListener).not.toHaveBeenCalled();
    // And it must stay inert rather than half-wired.
    expect(() => tracker.unregisterListeners()).not.toThrow();
  });

  it('removes every listener on unregisterListeners', () => {
    const { sm, tracker } = makeTracker();
    tracker.unregisterListeners();
    expect(sm.removeEventListener).toHaveBeenCalledTimes(19);
    expect(sm._listenerCount()).toBe(0);
  });

  it('reports the fixed tracker, player and partner names', () => {
    const { tracker } = makeTracker();
    expect(tracker.getTrackerName()).toBe('dai-ads');
    expect(tracker.getPlayerName()).toBe('dash-dai');
    expect(tracker.getAdPartner()).toBe('google-dai');
  });
});

describe('DaiTracker — per-stream state', () => {
  // Verified live order per stream request:
  //   STREAM_INITIALIZED -> CUEPOINTS_CHANGED -> LOADED -> ... -> CUEPOINTS_CHANGED
  // Cue points arrive BEFORE their own LOADED, so resetting at LOADED would
  // discard the list for the stream being loaded.
  it('resets per-stream state at STREAM_INITIALIZED, not LOADED', () => {
    const { sm, tracker } = makeTracker();

    sm._emit(StreamEventType.CUEPOINTS_CHANGED, {
      getStreamData: () => ({ cuepoints: [{ start: 0, end: 10 }] }),
    });
    sm._emit(StreamEventType.LOADED, {
      getStreamData: () => ({ streamId: 's1', url: 'https://example.test/a.mpd' }),
    });

    // LOADED must leave the cue points alone.
    expect(tracker.getAdCuePoints()).toHaveLength(1);
    expect(tracker.getStreamData()).toEqual({
      streamId: 's1',
      url: 'https://example.test/a.mpd',
    });

    sm._emit(StreamEventType.STREAM_INITIALIZED, {});

    expect(tracker.getAdCuePoints()).toEqual([]);
    expect(tracker.getStreamData()).toBeNull();
    expect(tracker.getCurrentAdBreak()).toBeNull();
  });

  it('reports a download on STREAM_INITIALIZED', () => {
    const { sm, tracker } = makeTracker();
    tracker.sendDownload = jest.fn();
    sm._emit(StreamEventType.STREAM_INITIALIZED, {});
    expect(tracker.sendDownload).toHaveBeenCalledWith({
      state: 'stream-initialized',
    });
  });

  // LOADED captures the stitched stream but must NOT send a request: that would
  // consume video-core's per-ad isRequested flag that AD_START depends on.
  it('does not report an ad request on LOADED', () => {
    const { sm, tracker } = makeTracker();
    tracker.sendRequest = jest.fn();
    sm._emit(StreamEventType.LOADED, {
      getStreamData: () => ({ streamId: 's1', url: 'u' }),
    });
    expect(tracker.sendRequest).not.toHaveBeenCalled();
  });
});

describe('DaiTracker — ad breaks', () => {
  it('keeps getCurrentAdBreak() non-null for the whole break', () => {
    const { sm, tracker } = makeTracker();

    expect(tracker.getCurrentAdBreak()).toBeNull();

    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    // Must be non-null even though the SDK tells us nothing about the break —
    // DashTracker's guard reads this as "a break is in progress".
    expect(tracker.getCurrentAdBreak()).not.toBeNull();

    sm._emit(StreamEventType.AD_BREAK_ENDED, {});
    expect(tracker.getCurrentAdBreak()).toBeNull();
  });

  it('reports break start and break end', () => {
    const { sm, tracker } = makeTracker();
    tracker.sendAdBreakStart = jest.fn();
    tracker.sendAdBreakEnd = jest.fn();

    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    expect(tracker.sendAdBreakStart).toHaveBeenCalledTimes(1);

    sm._emit(StreamEventType.AD_BREAK_ENDED, {});
    expect(tracker.sendAdBreakEnd).toHaveBeenCalledTimes(1);
  });

  // Never hand internal state to a send*: video-core's getAttributes() fills and
  // returns the very object it is given, which would turn adBreakData — and so
  // the public getCurrentAdBreak() — into the whole telemetry payload.
  it('does not hand its internal break object to sendAdBreakStart', () => {
    const { sm, tracker } = makeTracker();
    tracker.sendAdBreakStart = jest.fn();

    sm._emit(StreamEventType.AD_BREAK_STARTED, {});

    const passed = tracker.sendAdBreakStart.mock.calls[0][0];
    expect(passed).not.toBe(tracker.getCurrentAdBreak());
  });

  // Bumpers and some live breaks fire only a period start, with no
  // AD_BREAK_STARTED to open the break.
  it('closes a period-opened break on AD_PERIOD_ENDED', () => {
    const { sm, tracker } = makeTracker();

    sm._emit(StreamEventType.AD_PERIOD_STARTED, {});
    expect(tracker.getCurrentAdBreak()).not.toBeNull();

    sm._emit(StreamEventType.AD_PERIOD_ENDED, {});
    expect(tracker.getCurrentAdBreak()).toBeNull();
  });

  // Measured ordering under ON_RECEIVE (spec 11): adPeriodStarted precedes
  // adBreakStarted by ~6ms, and adPeriodEnded follows adBreakEnded by ~2.5s. A
  // period nested inside an SDK-announced break must not close it — that break
  // may still have more ads, and its own AD_BREAK_ENDED will close it.
  it('leaves a period nested inside an SDK-announced break alone', () => {
    const { sm, tracker } = makeTracker();
    tracker.sendAdBreakEnd = jest.fn();

    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    sm._emit(StreamEventType.AD_PERIOD_STARTED, {});
    sm._emit(StreamEventType.AD_PERIOD_ENDED, {});

    expect(tracker.getCurrentAdBreak()).not.toBeNull();
    expect(tracker.sendAdBreakEnd).not.toHaveBeenCalled();
  });

  // The measured live order is breakEnded -> periodEnded, so the flag must be
  // cleared by the break end or every break would emit two AD_BREAK_ENDs.
  it('does not close a break twice when AD_PERIOD_ENDED trails AD_BREAK_ENDED', () => {
    const { sm, tracker } = makeTracker();
    tracker.sendAdBreakEnd = jest.fn();

    sm._emit(StreamEventType.AD_PERIOD_STARTED, {});
    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    sm._emit(StreamEventType.AD_BREAK_ENDED, {});
    sm._emit(StreamEventType.AD_PERIOD_ENDED, {});

    expect(tracker.sendAdBreakEnd).toHaveBeenCalledTimes(1);
  });
});

describe('DaiTracker — stream errors', () => {
  // StreamEvent.ERROR is predominantly stream-level, and because isAd() is true
  // here, reporting it only on this tracker routes it to AD_ERROR — where
  // video-core never sets hadStartupError/hadPlaybackError. The most severe
  // failure the integration can see would never reach content error analysis.
  it('reports a DAI stream error on the content tracker as well as the ad tracker', () => {
    const contentTracker = { sendError: jest.fn(), isLive: () => false };
    const { sm, tracker } = makeTracker({ contentTracker });
    tracker.sendError = jest.fn();

    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    sm._emit(StreamEventType.ERROR, {
      getStreamData: () => ({ errorMessage: 'Stream init failed' }),
    });

    expect(contentTracker.sendError).toHaveBeenCalledWith({
      errorMessage: 'Stream init failed',
    });
    expect(tracker.sendError).toHaveBeenCalledWith({
      errorMessage: 'Stream init failed',
    });
  });

  it('still reports an error when there is no content tracker', () => {
    const { sm, tracker } = makeTracker({ contentTracker: null });
    tracker.sendError = jest.fn();

    sm._emit(StreamEventType.ERROR, {
      getStreamData: () => ({ errorMessage: 'boom' }),
    });

    expect(tracker.sendError).toHaveBeenCalledWith({ errorMessage: 'boom' });
  });

  it('falls back to a generic message when the SDK gives none', () => {
    const { sm, tracker } = makeTracker({ contentTracker: null });
    tracker.sendError = jest.fn();

    sm._emit(StreamEventType.ERROR, { getStreamData: () => ({}) });

    expect(tracker.sendError).toHaveBeenCalledWith({
      errorMessage: 'Unknown DAI error',
    });
  });

  // The SDK's errorMessage embeds the full DAI request URL, whose query string
  // carries ua, uach, sid and in real integrations ppid and cust_params.
  // video-core's obfuscation is opt-in per integrator, so verbatim this puts
  // user identifiers in NRDB by default (spec 6.9).
  it('strips query strings and caps length in error messages', () => {
    const { tracker } = makeTracker();
    const message =
      'Stream initialization failed for ' +
      'https://pubads.g.doubleclick.net/ondemand/dash/x.mpd' +
      '?ppid=abc123&sid=sess-9&uach=Mac&cust_params=user%3D42' +
      ' HTTP status code: 404';

    const out = tracker.sanitizeErrorMessage(message);

    expect(out).toContain('https://pubads.g.doubleclick.net/ondemand/dash/x.mpd');
    expect(out).not.toContain('ppid');
    expect(out).not.toContain('sid=');
    expect(out).not.toContain('uach');
    expect(out).not.toContain('cust_params');
    expect(out).toContain('HTTP status code: 404');
  });

  it('caps a very long error message', () => {
    const { tracker } = makeTracker();
    const out = tracker.sanitizeErrorMessage('x'.repeat(5000));
    expect(out.length).toBeLessThanOrEqual(512);
    expect(out.endsWith('…')).toBe(true);
  });

  // CodeQL js/polynomial-redos. Requiring the query group made every 'http://'
  // start a scan to the end of the token that then failed and backtracked,
  // which is quadratic in message length. The group must stay optional.
  it('sanitizes a pathological error message in linear time', () => {
    const { tracker } = makeTracker();
    const pathological = `http://${'a'.repeat(20000)}`;

    const start = Date.now();
    tracker.sanitizeErrorMessage(pathological);
    const elapsed = Date.now() - start;

    expect(elapsed).toBeLessThan(400);
  });
});
