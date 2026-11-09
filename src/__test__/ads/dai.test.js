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
    // Honours the handler argument, as the real StreamManager does: it matches
    // on the function reference. An earlier version of this mock ignored it,
    // which made the "removes the wrapped listeners" assertions pass even if
    // unregisterListeners had passed entirely different functions — the exact
    // bug those tests exist to catch.
    removeEventListener: jest.fn((type, cb) => {
      if (listeners[type] === cb) delete listeners[type];
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

// Helper for the ad-playback suites: an IMA Ad whose accessors can be
// selectively present, absent or throwing.
function createMockAd(overrides = {}) {
  const {
    adId = 'ad-1',
    creativeId = 'creative-1',
    duration = 10,
    title = 'An ad',
    podIndex = 0,
    totalAds = 3,
    throwing = false,
  } = overrides;

  if (throwing) {
    const boom = () => {
      throw new Error('accessor exploded');
    };
    return {
      getAdId: boom,
      getCreativeId: boom,
      getDuration: boom,
      getTitle: boom,
      getDescription: boom,
      getAdvertiserName: boom,
      getDealId: boom,
      getWrapperAdIds: boom,
      getAdPodInfo: boom,
    };
  }

  return {
    getAdId: () => adId,
    getCreativeId: () => creativeId,
    getDuration: () => duration,
    getTitle: () => title,
    getDescription: () => 'A description',
    getAdvertiserName: () => 'Advertiser',
    getDealId: () => 'deal-1',
    getWrapperAdIds: () => [],
    // Deliberately NO getClickThroughUrl — the real DAI Ad has none.
    getAdPodInfo: () => ({
      getPodIndex: () => podIndex,
      getTotalAds: () => totalAds,
    }),
    ...overrides.extra,
  };
}

function startedEvent(adOverrides) {
  return { getAd: () => createMockAd(adOverrides) };
}

function progressEvent(adProgressData) {
  return { getStreamData: () => ({ adProgressData }) };
}

describe('DaiTracker — ad playback', () => {
  // video-core gates AD_START on a per-ad state.isRequested flag and clears it
  // on both AD_END and AD_BREAK_END, so without a request per ad only the
  // session's first ad would ever report a start.
  it('sends a request per ad, so every ad in a pod reports a start', () => {
    const { sm, tracker } = makeTracker();
    const order = [];
    tracker.sendRequest = jest.fn(() => order.push('request'));
    tracker.sendStart = jest.fn(() => order.push('start'));

    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    sm._emit(StreamEventType.STARTED, startedEvent({ adId: 'a1' }));
    sm._emit(StreamEventType.COMPLETE, {});
    sm._emit(StreamEventType.STARTED, startedEvent({ adId: 'a2' }));

    expect(tracker.sendRequest).toHaveBeenCalledTimes(2);
    expect(tracker.sendStart).toHaveBeenCalledTimes(2);
    expect(order).toEqual(['request', 'start', 'request', 'start']);
  });

  // goAdBreakEnd() clears isRequested but NOT isStarted, and only sendEnd()
  // resets that, so an ad left unfinished here blocks AD_START for every later
  // ad in the session.
  it('ends an in-flight ad before closing its break', () => {
    const { sm, tracker } = makeTracker();
    const order = [];
    tracker.sendEnd = jest.fn(() => order.push('end'));
    tracker.sendAdBreakEnd = jest.fn(() => order.push('breakEnd'));

    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    sm._emit(StreamEventType.STARTED, startedEvent());
    sm._emit(StreamEventType.AD_BREAK_ENDED, {}); // no COMPLETE

    expect(order).toEqual(['end', 'breakEnd']);
    expect(tracker.getCurrentAd()).toBeNull();
  });

  // Joining a live stream mid-break, the SDK reports quartiles for an ad whose
  // STARTED never reached us — measured, this is the FIRST thing that happens on
  // a live join (spec 7.3). Those arrive with no ad identity, and counting them
  // makes quartiles outnumber ad starts, breaking completion funnels.
  it('never emits a quartile for an ad that never reported a start', () => {
    const { sm, tracker } = makeTracker();
    tracker.sendAdQuartile = jest.fn();

    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    sm._emit(StreamEventType.MIDPOINT, {});
    sm._emit(StreamEventType.THIRD_QUARTILE, {});
    sm._emit(StreamEventType.COMPLETE, {});

    expect(tracker.sendAdQuartile).not.toHaveBeenCalled();
  });

  it('does not emit a click for an ad that never reported a start', () => {
    const { sm, tracker } = makeTracker();
    tracker.sendAdClick = jest.fn();

    sm._emit(StreamEventType.CLICK, {});

    expect(tracker.sendAdClick).not.toHaveBeenCalled();
  });

  it('extracts ad identity even though the SDK has no getClickThroughUrl', () => {
    const { sm, tracker } = makeTracker();

    sm._emit(StreamEventType.STARTED, startedEvent({ adId: 'xyz' }));

    const ad = tracker.getCurrentAd();
    expect(ad.adId).toBe('xyz');
    expect(ad.creativeId).toBe('creative-1');
    expect(ad.title).toBe('An ad');
    expect(ad.duration).toBe(10);
    // Absent accessor must come back undefined, not throw.
    expect(ad.clickThroughUrl).toBeUndefined();
  });

  // Read each accessor independently: the IMA Ad surface varies by creative and
  // SDK version, and one missing or throwing method must not discard the
  // attributes that did resolve.
  it('survives an Ad object whose optional accessors all throw', () => {
    const { sm, tracker } = makeTracker();

    expect(() => {
      sm._emit(StreamEventType.STARTED, startedEvent({ throwing: true }));
    }).not.toThrow();

    const ad = tracker.getCurrentAd();
    expect(ad).not.toBeNull();
    expect(ad.adId).toBeUndefined();
    expect(ad.position).toBeNull();
    expect(ad.adCount).toBeUndefined();
  });

  it('reports the real ad count from the IMA ad pod, not 0', () => {
    const { sm, tracker } = makeTracker();

    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    sm._emit(StreamEventType.STARTED, startedEvent({ totalAds: 3 }));

    expect(tracker.getCurrentAd().adCount).toBe(3);
    // Backfilled onto the break, which knows nothing at AD_BREAK_STARTED.
    expect(tracker.getCurrentAdBreak().adCount).toBe(3);
  });
});

describe('DaiTracker — adPosition', () => {
  it('maps podIndex 0 to pre, -1 to post and any other number to mid', () => {
    const { tracker } = makeTracker();
    const at = (podIndex) => tracker.extractAdPosition(createMockAd({ podIndex }));

    expect(at(0)).toBe('pre');
    expect(at(-1)).toBe('post');
    expect(at(1)).toBe('mid');
    expect(at(7)).toBe('mid');
    // Measured on the live asset: podIndex is a large monotonic identifier
    // (2969997), so every live ad is a mid-roll (spec 6.7).
    expect(at(2969997)).toBe('mid');
  });

  it('returns null when the pod info is unreadable', () => {
    const { tracker } = makeTracker();
    expect(tracker.extractAdPosition({})).toBeNull();
    expect(tracker.extractAdPosition(createMockAd({ throwing: true }))).toBeNull();
  });

  // Under SSAI the ad itself advances the stitched stream's clock, so a
  // time-based guess would reclassify a long pre-roll as a mid-roll partway in.
  it('keeps adPosition stable for the whole ad as the stream time advances', () => {
    const tag = createMockTag(0);
    const sm = createMockStreamManager();
    const tracker = new DaiTracker(sm, { tag });

    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    sm._emit(StreamEventType.STARTED, startedEvent({ podIndex: 0 }));
    expect(tracker.getAdPosition()).toBe('pre');

    tag.currentTime = 9.5; // deep into a 10s pre-roll
    expect(tracker.getAdPosition()).toBe('pre');
  });

  // Guards against adProgressData.adPosition (the 1-based index of the ad
  // WITHIN its pod) being mapped onto pre/mid/post. Measured proof it cannot
  // be: live one break of 3 ads gives 1,2,3 where ours must be mid,mid,mid
  // (spec 7.7.1).
  it('keeps adPosition identical for every ad in one pod', () => {
    const { sm, tracker } = makeTracker();
    const seen = [];

    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    [1, 2, 3].forEach((n) => {
      sm._emit(StreamEventType.STARTED, startedEvent({ adId: `a${n}`, podIndex: 4 }));
      // The numeric field the SDK offers, deliberately not used for adPosition.
      sm._emit(StreamEventType.AD_PROGRESS, progressEvent({
        currentTime: n, duration: 10, totalAds: 3, adPosition: n,
      }));
      seen.push(tracker.getAdPosition());
      sm._emit(StreamEventType.COMPLETE, {});
    });

    expect(seen).toEqual(['mid', 'mid', 'mid']);
  });

  it('never reports adPosition as a number', () => {
    const { sm, tracker } = makeTracker();
    const allowed = ['pre', 'mid', 'post', null];

    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    expect(allowed).toContain(tracker.getAdPosition());

    sm._emit(StreamEventType.STARTED, startedEvent({ podIndex: 2 }));
    sm._emit(StreamEventType.AD_PROGRESS, progressEvent({
      currentTime: 1, duration: 10, totalAds: 3, adPosition: 2,
    }));

    [
      StreamEventType.FIRST_QUARTILE,
      StreamEventType.MIDPOINT,
      StreamEventType.THIRD_QUARTILE,
    ].forEach((type) => {
      sm._emit(type, {});
      expect(allowed).toContain(tracker.getAdPosition());
      expect(typeof tracker.getAdPosition()).not.toBe('number');
    });
  });
});

describe('DaiTracker — AD_PROGRESS is a cache, never an event', () => {
  // Measured at ~4 events/second, 42 in one 50s live break. Emitting it would
  // flood NRDB (spec 6.6), so this handler must contain no send* at all.
  it('caches adProgressData on AD_PROGRESS without sending anything', () => {
    const { sm, tracker } = makeTracker();
    const sendSpies = [
      'sendRequest', 'sendStart', 'sendEnd', 'sendPause', 'sendResume',
      'sendAdQuartile', 'sendAdClick', 'sendAdBreakStart', 'sendAdBreakEnd',
      'sendError', 'sendDownload',
    ];
    sendSpies.forEach((name) => { tracker[name] = jest.fn(); });

    const data = {
      adBreakDuration: 29.928, adPeriodDuration: 30.03, adPosition: 1,
      currentTime: 0.267, duration: 9.976, totalAds: 3,
    };
    sm._emit(StreamEventType.AD_PROGRESS, progressEvent(data));

    expect(tracker.adProgressData).toEqual(data);
    sendSpies.forEach((name) => expect(tracker[name]).not.toHaveBeenCalled());
  });

  it('survives an AD_PROGRESS event carrying no stream data', () => {
    const { sm, tracker } = makeTracker();
    expect(() => sm._emit(StreamEventType.AD_PROGRESS, {})).not.toThrow();
    expect(tracker.adProgressData).toBeNull();
  });

  it('drops the cached progress when the ad ends', () => {
    const { sm, tracker } = makeTracker();

    sm._emit(StreamEventType.STARTED, startedEvent());
    sm._emit(StreamEventType.AD_PROGRESS, progressEvent({ currentTime: 5, duration: 10 }));
    expect(tracker.adProgressData).not.toBeNull();

    sm._emit(StreamEventType.COMPLETE, {});
    expect(tracker.adProgressData).toBeNull();
  });
});

describe('DaiTracker — quartile parity with hls.js', () => {
  // Review Focus 4. The tracker does NOT de-duplicate: it reports whatever the
  // SDK reports, gated only on an ad being in flight. Double-forwarding is
  // prevented upstream by subscribing in one event mode (forwardDaiMetadata)
  // and documented for integrators who hand-roll it. This test pins the parity
  // so nobody "fixes" it into idempotency without revisiting that decision.
  it('reports a quartile each time the SDK reports it, matching hls.js', () => {
    const { sm, tracker } = makeTracker();
    tracker.sendAdQuartile = jest.fn();

    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    sm._emit(StreamEventType.STARTED, startedEvent());
    sm._emit(StreamEventType.FIRST_QUARTILE, {});
    sm._emit(StreamEventType.FIRST_QUARTILE, {});

    expect(tracker.sendAdQuartile).toHaveBeenCalledTimes(2);
    expect(tracker.sendAdQuartile).toHaveBeenNthCalledWith(1, { quartile: 1 });
    expect(tracker.sendAdQuartile).toHaveBeenNthCalledWith(2, { quartile: 1 });
  });

  it('reports the three quartiles with their numbers', () => {
    const { sm, tracker } = makeTracker();
    tracker.sendAdQuartile = jest.fn();

    sm._emit(StreamEventType.STARTED, startedEvent());
    sm._emit(StreamEventType.FIRST_QUARTILE, {});
    sm._emit(StreamEventType.MIDPOINT, {});
    sm._emit(StreamEventType.THIRD_QUARTILE, {});

    expect(tracker.sendAdQuartile.mock.calls.map(([a]) => a.quartile)).toEqual([1, 2, 3]);
  });

  it('reports a skipped ad as an end with the skipped flag', () => {
    const { sm, tracker } = makeTracker();
    tracker.sendEnd = jest.fn();

    sm._emit(StreamEventType.STARTED, startedEvent());
    sm._emit(StreamEventType.SKIPPED, {});

    expect(tracker.sendEnd).toHaveBeenCalledWith({ skipped: true });
    expect(tracker.getCurrentAd()).toBeNull();
  });

  it('reports pause and resume during an ad', () => {
    const { sm, tracker } = makeTracker();
    tracker.sendPause = jest.fn();
    tracker.sendResume = jest.fn();

    sm._emit(StreamEventType.PAUSED, {});
    sm._emit(StreamEventType.RESUMED, {});

    expect(tracker.sendPause).toHaveBeenCalled();
    expect(tracker.sendResume).toHaveBeenCalled();
  });

  // video-core warns when the url key is absent-or-falsy, and the DAI Ad object
  // exposes no clickthrough accessor, so a null would log on every click.
  it('omits url entirely rather than sending a known null on click', () => {
    const { sm, tracker } = makeTracker();
    tracker.sendAdClick = jest.fn();

    sm._emit(StreamEventType.STARTED, startedEvent());
    sm._emit(StreamEventType.CLICK, {});

    expect(tracker.sendAdClick).toHaveBeenCalledWith({});
  });
});

// The project mock lets every send* succeed, so it cannot observe the base
// class's gating. This replays video-core 5.1.1's real isRequested / isStarted /
// isAdBreak transitions locally.
//
// WARNING: this is a hand-written replay, not the real module. If video-core
// changes its gating, this diverges silently and keeps passing. It mirrors
// video-core 5.1.1 (dist/cjs/index.js), the version package.json pins.
describe('DaiTracker — replayed video-core 5.1.1 gating', () => {
  function gatedTracker() {
    const sm = createMockStreamManager();
    const tracker = new DaiTracker(sm, { tag: createMockTag() });
    const state = { isRequested: false, isStarted: false, isAdBreak: false };
    const reported = [];

    tracker.sendRequest = () => {
      if (state.isRequested) return;
      state.isRequested = true;
      reported.push('AD_REQUEST');
    };
    tracker.sendStart = () => {
      if (!state.isRequested || state.isStarted) return;
      state.isStarted = true;
      reported.push('AD_START');
    };
    tracker.sendEnd = () => {
      if (!state.isRequested) return;
      state.isRequested = false;
      state.isStarted = false;
      reported.push('AD_END');
    };
    tracker.sendAdBreakStart = () => {
      if (state.isAdBreak) return;
      state.isAdBreak = true;
      reported.push('AD_BREAK_START');
    };
    tracker.sendAdBreakEnd = () => {
      if (!state.isAdBreak) return;
      state.isAdBreak = false;
      state.isRequested = false; // goAdBreakEnd clears isRequested, NOT isStarted
      reported.push('AD_BREAK_END');
    };
    tracker.sendAdQuartile = ({ quartile }) => reported.push(`AD_QUARTILE${quartile}`);

    return { sm, tracker, reported };
  }

  function playAd(sm, adId) {
    sm._emit(StreamEventType.STARTED, startedEvent({ adId, totalAds: 2 }));
    sm._emit(StreamEventType.FIRST_QUARTILE, {});
    sm._emit(StreamEventType.COMPLETE, {});
  }

  it('reports a start and an end for every ad in a multi-ad pod', () => {
    const { sm, reported } = gatedTracker();

    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    playAd(sm, 'ad1');
    playAd(sm, 'ad2');
    sm._emit(StreamEventType.AD_BREAK_ENDED, {});

    expect(reported.filter((r) => r === 'AD_REQUEST')).toHaveLength(2);
    expect(reported.filter((r) => r === 'AD_START')).toHaveLength(2);
    expect(reported.filter((r) => r === 'AD_END')).toHaveLength(2);
    // Non-negotiable assertion 3 from the verification plan.
    expect(reported.filter((r) => r === 'AD_REQUEST').length).toBe(
      reported.filter((r) => r === 'AD_START').length
    );
  });

  it('still reports ads in a later break after the first break ended', () => {
    const { sm, reported } = gatedTracker();

    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    sm._emit(StreamEventType.STARTED, startedEvent({ adId: 'ad1' }));
    sm._emit(StreamEventType.AD_BREAK_ENDED, {}); // ad1 never completed
    const mark = reported.length;

    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    playAd(sm, 'ad2');
    sm._emit(StreamEventType.AD_BREAK_ENDED, {});

    const second = reported.slice(mark);
    expect(second).toContain('AD_START');
    expect(second.indexOf('AD_START')).toBeLessThan(second.indexOf('AD_QUARTILE1'));
  });
});

describe('DaiTracker — cue points', () => {
  // Cue points live on StreamData; the StreamEvent has no getCuepoints().
  it('reads cue points from StreamData, not a getCuepoints() accessor', () => {
    const { sm, tracker } = makeTracker();
    const cuepoints = [
      { start: 0, end: 10.01, played: true },
      { start: 310.012, end: 320.022, played: false },
    ];

    sm._emit(StreamEventType.CUEPOINTS_CHANGED, {
      getStreamData: () => ({ cuepoints }),
      // A getCuepoints() accessor must be ignored — the real SDK has none, so
      // reading one would be coding against an API that does not exist.
      getCuepoints: () => [{ start: 999, end: 1000 }],
    });

    expect(tracker.getAdCuePoints()).toEqual(cuepoints);
  });

  // Only CUEPOINTS_CHANGED carries them; other events report null, so a missing
  // list must leave the known one untouched rather than clearing it.
  it('leaves a known cue point list untouched when an event carries none', () => {
    const { sm, tracker } = makeTracker();

    sm._emit(StreamEventType.CUEPOINTS_CHANGED, {
      getStreamData: () => ({ cuepoints: [{ start: 0, end: 10 }] }),
    });
    sm._emit(StreamEventType.CUEPOINTS_CHANGED, {
      getStreamData: () => ({ cuepoints: null }),
    });

    expect(tracker.getAdCuePoints()).toHaveLength(1);
  });
});

describe('DaiTracker — the two clocks', () => {
  // adPlayhead comes straight from the SDK (spec 7.7). Measured climbing
  // 0.267 -> 0.531 -> 0.797 within one ad, ad-relative and starting at 0.
  it('getPlayhead() reports adProgressData.currentTime in ms', () => {
    const { sm, tracker } = makeTracker();

    sm._emit(StreamEventType.STARTED, startedEvent());
    sm._emit(StreamEventType.AD_PROGRESS, progressEvent({
      currentTime: 0.267, duration: 9.976, totalAds: 3,
    }));

    expect(tracker.getPlayhead()).toBe(267);
  });

  it('getPlayhead() returns 0 for an ad in flight before the first progress tick', () => {
    const { sm, tracker } = makeTracker(); // tag.currentTime is 3

    sm._emit(StreamEventType.STARTED, startedEvent());

    // 0 is the correct value at that moment anyway — and crucially NOT the
    // stitched stream time of 3000.
    expect(tracker.getPlayhead()).toBe(0);
  });

  it("getPlayhead() does not leak the previous ad's progress into the next ad", () => {
    const { sm, tracker } = makeTracker();

    sm._emit(StreamEventType.STARTED, startedEvent({ adId: 'a1' }));
    sm._emit(StreamEventType.AD_PROGRESS, progressEvent({ currentTime: 9.5, duration: 10 }));
    expect(tracker.getPlayhead()).toBe(9500);

    sm._emit(StreamEventType.COMPLETE, {});
    sm._emit(StreamEventType.STARTED, startedEvent({ adId: 'a2' }));

    expect(tracker.getPlayhead()).toBe(0);
  });

  it('getPlayhead() goes back to stream time once the ad ends', () => {
    const tag = createMockTag(42);
    const sm = createMockStreamManager();
    const tracker = new DaiTracker(sm, { tag });

    sm._emit(StreamEventType.STARTED, startedEvent());
    sm._emit(StreamEventType.AD_PROGRESS, progressEvent({ currentTime: 5, duration: 10 }));
    sm._emit(StreamEventType.COMPLETE, {});

    expect(tracker.getPlayhead()).toBe(42000);
  });

  // The stitched clock, which cue points and the SDK's conversions are
  // expressed in. Measured: video.currentTime and player.time() are identical
  // on both VOD and live, so the video element is the right source.
  it('getStreamTimeMs() reports the stitched clock from the video element', () => {
    const sm = createMockStreamManager();
    const tracker = new DaiTracker(sm, { tag: createMockTag(12.5) });
    expect(tracker.getStreamTimeMs()).toBe(12500);
  });

  it('converts stream time to content time through the StreamManager', () => {
    const sm = createMockStreamManager();
    sm.contentTimeForStreamTime = jest.fn(() => 10.5);
    const tracker = new DaiTracker(sm, { tag: createMockTag() });

    expect(tracker.contentTimeForStreamTime(20.51)).toBe(10.5);
    expect(sm.contentTimeForStreamTime).toHaveBeenCalledWith(20.51);
  });

  it('returns undefined when the SDK cannot convert, so the caller keeps stream time', () => {
    const sm = createMockStreamManager();
    sm.contentTimeForStreamTime = jest.fn(() => {
      throw new Error('nope');
    });
    const tracker = new DaiTracker(sm, { tag: createMockTag() });

    expect(tracker.contentTimeForStreamTime(5)).toBeUndefined();
  });
});

describe('DaiTracker — isAdPlaying', () => {
  const cuePoints = [
    { start: 0, end: 10.01, played: false },
    { start: 310.012, end: 320.022, played: false },
  ];

  function withCuePoints(currentTime) {
    const sm = createMockStreamManager();
    const tracker = new DaiTracker(sm, { tag: createMockTag(currentTime) });
    sm._emit(StreamEventType.CUEPOINTS_CHANGED, {
      getStreamData: () => ({ cuepoints: cuePoints.map((c) => ({ ...c })) }),
    });
    return { sm, tracker };
  }

  // AD_BREAK_STARTED arrives only after playback has entered the ad, so the
  // break object alone misses the first moments of a pre-roll. Cue points, known
  // ahead of playback, cover that window.
  it('isAdPlaying() matches cue points against stream time while an ad is in flight', () => {
    expect(withCuePoints(5).tracker.isAdPlaying()).toBe(true);
    expect(withCuePoints(315).tracker.isAdPlaying()).toBe(true);
    expect(withCuePoints(100).tracker.isAdPlaying()).toBe(false);
    // End is exclusive.
    expect(withCuePoints(10.01).tracker.isAdPlaying()).toBe(false);
  });

  // Seeking back into a watched pre-roll gets no fresh ad telemetry, so
  // suppressing content there would lose it outright.
  it('isAdPlaying() skips cue point windows already played', () => {
    const sm = createMockStreamManager();
    const tracker = new DaiTracker(sm, { tag: createMockTag(5) });
    sm._emit(StreamEventType.CUEPOINTS_CHANGED, {
      getStreamData: () => ({ cuepoints: [{ start: 0, end: 10.01, played: true }] }),
    });

    expect(tracker.isAdPlaying()).toBe(false);
  });

  // Cue points are a VOD-only facility in DAI — the live asset reported none —
  // so this fallback is the path ALL live traffic takes. It is the entire
  // content guard on live, which is why it gets its own test here (spec 13.6).
  it('isAdPlaying() returns true from the break object alone when there are no cue points', () => {
    const { sm, tracker } = makeTracker();
    expect(tracker.getAdCuePoints()).toEqual([]);

    expect(tracker.isAdPlaying()).toBe(false);
    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    expect(tracker.isAdPlaying()).toBe(true);
    sm._emit(StreamEventType.AD_BREAK_ENDED, {});
    expect(tracker.isAdPlaying()).toBe(false);
  });

  // isAdPlaying reads getStreamTimeMs(), NOT getPlayhead(): cue point windows
  // are stream times, and the ad-relative playhead would break them.
  it('isAdPlaying() uses stream time, not the ad-relative playhead', () => {
    const sm = createMockStreamManager();
    const tracker = new DaiTracker(sm, { tag: createMockTag(315) });
    sm._emit(StreamEventType.CUEPOINTS_CHANGED, {
      getStreamData: () => ({ cuepoints: [{ start: 310.012, end: 320.022, played: false }] }),
    });
    // An ad-relative playhead of 1s would fall outside the 310-320 window and
    // report false.
    sm._emit(StreamEventType.STARTED, startedEvent());
    sm._emit(StreamEventType.AD_PROGRESS, progressEvent({ currentTime: 1, duration: 10 }));

    expect(tracker.getPlayhead()).toBe(1000);
    expect(tracker.isAdPlaying()).toBe(true);
  });

  // Review Focus 3. video-core's disposeAdsTracker() calls dispose(), which
  // nulls this tracker's player and tag, but never clears the PARENT's
  // adsTracker reference — verified in video-core 5.1.1 source. So the content
  // guard keeps calling in after setAdsTracker(null).
  it('stays inert after being disposed instead of throwing', () => {
    const { sm, tracker } = makeTracker();
    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    expect(tracker.isAdPlaying()).toBe(true);

    tracker.dispose();

    expect(tracker.isAdPlaying()).toBe(false);
    expect(() => tracker.getPlayhead()).not.toThrow();
    expect(() => tracker.getStreamTimeMs()).not.toThrow();
    expect(() => tracker.contentTimeForStreamTime(5)).not.toThrow();
  });
});

describe('DaiTracker — ad metadata getters', () => {
  it('reports ad identity from the current ad', () => {
    const { sm, tracker } = makeTracker();
    sm._emit(StreamEventType.STARTED, startedEvent({ adId: 'ad-9', creativeId: 'cr-9' }));

    expect(tracker.getVideoId()).toBe('ad-9');
    expect(tracker.getAdCreativeId()).toBe('cr-9');
    expect(tracker.getTitle()).toBe('An ad');
  });

  it('reports null identity when no ad is in flight', () => {
    const { tracker } = makeTracker();
    expect(tracker.getVideoId()).toBeNull();
    expect(tracker.getAdCreativeId()).toBeNull();
    expect(tracker.getTitle()).toBeNull();
    expect(tracker.getDuration()).toBeNull();
  });

  // Pins spec 7.7.2. ad.getDuration() is available from AD_START and stays
  // constant; adProgressData.duration is finer-grained but changes mid-ad, and
  // a duration that moves invites distrust of the whole dataset.
  it('getDuration() reports ad.getDuration() in ms, not adProgressData.duration', () => {
    const { sm, tracker } = makeTracker();

    sm._emit(StreamEventType.STARTED, startedEvent({ duration: 10 }));
    sm._emit(StreamEventType.AD_PROGRESS, progressEvent({
      currentTime: 9.9, duration: 9.976, totalAds: 3,
    }));

    expect(tracker.getDuration()).toBe(10000);
  });

  // Documented consequence of the choice above: the two never quite meet, so
  // adPlayhead >= adDuration never fires and completion must come from AD_END
  // or the third quartile.
  it('leaves adPlayhead short of adDuration at the end of an ad', () => {
    const { sm, tracker } = makeTracker();

    sm._emit(StreamEventType.STARTED, startedEvent({ duration: 10 }));
    sm._emit(StreamEventType.AD_PROGRESS, progressEvent({
      currentTime: 9.976, duration: 9.976,
    }));

    expect(tracker.getPlayhead()).toBeLessThan(tracker.getDuration());
    expect(tracker.getPlayhead() / tracker.getDuration()).toBeCloseTo(0.9976, 4);
  });

  it('reports the stitched stream url as src', () => {
    const { sm, tracker } = makeTracker();
    expect(tracker.getSrc()).toBeNull();

    sm._emit(StreamEventType.LOADED, {
      getStreamData: () => ({ streamId: 's', url: 'https://example.test/s.mpd' }),
    });

    expect(tracker.getSrc()).toBe('https://example.test/s.mpd');
  });

  it('reports the muted state from the video element', () => {
    const tag = createMockTag();
    const sm = createMockStreamManager();
    const tracker = new DaiTracker(sm, { tag });

    expect(tracker.isMuted()).toBe(false);
    tag.muted = true;
    expect(tracker.isMuted()).toBe(true);
  });
});

describe('DaiTracker — content tracker delegation', () => {
  function withContentTracker(overrides = {}) {
    const contentTracker = {
      isLive: jest.fn(() => true),
      getBitrate: jest.fn(() => 2142460),
      getRenditionHeight: jest.fn(() => 720),
      getRenditionWidth: jest.fn(() => 1280),
      getRenditionName: jest.fn(() => '720p'),
      getPlayerVersion: jest.fn(() => '5.3.0'),
      ...overrides,
    };
    const sm = createMockStreamManager();
    const tracker = new DaiTracker(sm, { tag: createMockTag(), contentTracker });
    return { sm, tracker, contentTracker };
  }

  // A DAI live stream's duration is a growing DVR window rather than Infinity
  // (measured: 60), so a duration-based test reports every live stream as VOD.
  // StreamData carries no stream type of its own.
  it('getStreamType() reports live from the content tracker', () => {
    const { tracker, contentTracker } = withContentTracker();
    expect(tracker.getStreamType()).toBe('live');
    expect(tracker.isLiveStream()).toBe(true);

    contentTracker.isLive.mockReturnValue(false);
    expect(tracker.getStreamType()).toBe('vod');
    expect(tracker.isLiveStream()).toBe(false);
  });

  it('getStreamType() reports null when the live flag is unknown', () => {
    const { tracker } = withContentTracker({ isLive: () => undefined });
    expect(tracker.getStreamType()).toBeNull();
  });

  // The stitched stream is decoded by the same dash.js instance during ads, so
  // all quality data lives on the content tracker, not the StreamManager. This
  // also inherits the existing dash.js 4-vs-5 branching for free.
  it('delegates bitrate and rendition getters to the content tracker', () => {
    const { tracker } = withContentTracker();

    expect(tracker.getBitrate()).toBe(2142460);
    expect(tracker.getRenditionBitrate()).toBe(2142460);
    expect(tracker.getRenditionHeight()).toBe(720);
    expect(tracker.getRenditionWidth()).toBe(1280);
    expect(tracker.getRenditionName()).toBe('720p');
  });

  it('returns null from rendition getters when no content tracker was supplied', () => {
    const { tracker } = makeTracker({ contentTracker: null });

    expect(tracker.getBitrate()).toBeNull();
    expect(tracker.getRenditionBitrate()).toBeNull();
    expect(tracker.getRenditionHeight()).toBeNull();
    expect(tracker.getRenditionWidth()).toBeNull();
    expect(tracker.getRenditionName()).toBeNull();
    expect(tracker.getStreamType()).toBeNull();
  });

  // Deliberate divergence from hls.js, which hardcodes 'unknown'. Under SSAI
  // the player rendering the ad IS dash.js, so reporting 'unknown' throws away
  // information we hold (spec 7.8). Do not "restore parity" by reverting this.
  it('reports the real dash.js version as playerVersion', () => {
    const { tracker } = withContentTracker();
    expect(tracker.getPlayerVersion()).toBe('5.3.0');
  });

  it('falls back to unknown when no content tracker was supplied', () => {
    const { tracker } = makeTracker({ contentTracker: null });
    expect(tracker.getPlayerVersion()).toBe('unknown');
  });

  it('falls back to unknown when the content tracker cannot report a version', () => {
    const { tracker } = withContentTracker({ getPlayerVersion: undefined });
    expect(tracker.getPlayerVersion()).toBe('unknown');
  });
});

describe('DaiTracker — never throws into the SDK dispatch', () => {
  // FOUND IN THE BROWSER. A DaiTracker handler runs inside the IMA DAI SDK's
  // own event dispatch. When onStreamInitialized threw — because video-core's
  // attribute collection reached a dash.js getter that had no source yet — the
  // exception escaped into the SDK, which aborted the stream request and
  // emitted an empty ERROR. The live asset played nothing at all.
  //
  // The underlying getter is fixed in DashTracker, but this contains the whole
  // class: the thrown value came from a third-party player through video-core,
  // so any future throw there would again break the customer's playback. A
  // telemetry library must never take the stream down with it.
  it('swallows and logs an exception from any handler', () => {
    const { sm, tracker } = makeTracker();

    // Exactly what was observed: dash.js throws a bare string, not an Error.
    tracker.sendDownload = () => {
      throw 'You must first call initialize() and set a valid source before calling this method';
    };

    expect(() => sm._emit(StreamEventType.STREAM_INITIALIZED, {})).not.toThrow();
    expect(nrvideo.Log.error).toHaveBeenCalled();
  });

  it('keeps handling later events after one handler threw', () => {
    const { sm, tracker } = makeTracker();
    tracker.sendAdBreakStart = () => {
      throw new Error('attribute collection exploded');
    };

    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    // The break still opened: state is updated before the send.
    expect(tracker.getCurrentAdBreak()).not.toBeNull();

    tracker.sendAdQuartile = jest.fn();
    sm._emit(StreamEventType.STARTED, startedEvent());
    sm._emit(StreamEventType.FIRST_QUARTILE, {});
    expect(tracker.sendAdQuartile).toHaveBeenCalledWith({ quartile: 1 });
  });

  it('still removes the wrapped listeners on unregisterListeners', () => {
    const { sm, tracker } = makeTracker();
    tracker.unregisterListeners();
    expect(sm.removeEventListener).toHaveBeenCalledTimes(19);
    expect(sm._listenerCount()).toBe(0);
  });
});

describe('DaiTracker — one error, two trackers, no attribute leak', () => {
  // video-core's getAttributes() FILLS AND RETURNS the object it is handed
  // (verified in 5.1.1: `getAttributes(e, t) { (e = e || {}).trackerName = ...;
  // return e }`), and only DashTracker is registered with Core, so a DaiTracker
  // send is funnelled through the parent's attribute collection.
  //
  // So handing the SAME payload object to the ad tracker and then to the
  // content tracker publishes a CONTENT_ERROR carrying adId, adPartner,
  // adPosition, adPlayhead and the rest. Spec 7.4 bans exactly this; the rule
  // was applied to adBreakData but missed here.
  //
  // The earlier test cannot catch it: its mocks are plain jest.fn()s that do
  // not mutate, and Jest records arguments BY REFERENCE. This one replays the
  // mutation and snapshots what each tracker actually received.
  function errorLeakFixture() {
    let contentReceived = null;
    const contentTracker = {
      isLive: () => false,
      sendError: jest.fn((att) => {
        contentReceived = { ...att }; // snapshot before filling anything
        att.isAd = false;
        att.contentId = 'content-1';
        return att;
      }),
    };
    const { sm, tracker } = makeTracker({ contentTracker });
    // Replay the ad tracker's own attribute collection.
    tracker.sendError = jest.fn((att) => {
      att.isAd = true;
      att.adId = 'ad-1';
      att.adPartner = 'google-dai';
      att.adPosition = 'pre';
      att.adPlayhead = 3200;
      att.numberOfAds = 1;
      return att;
    });
    return { sm, tracker, contentTracker, received: () => contentReceived };
  }

  it('does not leak ad attributes into the content error event', () => {
    const { sm, received } = errorLeakFixture();

    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    sm._emit(StreamEventType.ERROR, {
      getStreamData: () => ({ errorMessage: 'Stream init failed' }),
    });

    expect(received()).toEqual({ errorMessage: 'Stream init failed' });
    ['adId', 'adPartner', 'adPosition', 'adPlayhead', 'numberOfAds'].forEach((key) => {
      expect(received()).not.toHaveProperty(key);
    });
  });

  it('does not let the content tracker mutate the ad error event either', () => {
    const { sm, tracker, contentTracker } = errorLeakFixture();
    // Reverse direction: whatever the content tracker adds must not appear on
    // the ad tracker's payload.
    const adReceived = [];
    tracker.sendError = jest.fn((att) => {
      adReceived.push({ ...att });
      return att;
    });

    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    sm._emit(StreamEventType.ERROR, {
      getStreamData: () => ({ errorMessage: 'boom' }),
    });

    expect(adReceived[0]).toEqual({ errorMessage: 'boom' });
    expect(contentTracker.sendError).toHaveBeenCalled();
  });

  it('still reports the error on both trackers', () => {
    const { sm, tracker, contentTracker } = errorLeakFixture();

    sm._emit(StreamEventType.AD_BREAK_STARTED, {});
    sm._emit(StreamEventType.ERROR, {
      getStreamData: () => ({ errorMessage: 'boom' }),
    });

    expect(tracker.sendError).toHaveBeenCalledTimes(1);
    expect(contentTracker.sendError).toHaveBeenCalledTimes(1);
  });
});

describe('DaiTracker — the tag must be a media element', () => {
  // video-core's base does `tag = tag || player` (verified in 5.1.1), so a
  // DaiTracker built without options.tag silently takes the StreamManager as
  // its "video element". getStreamTimeMs() then reads undefined?.currentTime
  // and returns 0 forever, which freezes the stitched clock: the cue-point arm
  // of isAdPlaying() can never match, so CONTENT_START is not deferred past a
  // VOD pre-roll. Nothing complains today.
  it('falls back to the content tracker\'s tag when options.tag is omitted', () => {
    const video = createMockTag(7);
    const contentTracker = { tag: video, isLive: () => false };
    const sm = createMockStreamManager();

    const tracker = new DaiTracker(sm, { contentTracker });

    expect(tracker.tag).toBe(video);
    expect(tracker.getStreamTimeMs()).toBe(7000);
  });

  it('warns when no usable media element can be resolved', () => {
    const sm = createMockStreamManager();

    const tracker = new DaiTracker(sm, {});

    expect(nrvideo.Log.warn).toHaveBeenCalledWith(
      expect.stringContaining('media element')
    );
    // Still inert rather than broken.
    expect(tracker.getStreamTimeMs()).toBe(0);
    expect(() => tracker.isAdPlaying()).not.toThrow();
  });

  it('does not warn when options.tag was supplied', () => {
    makeTracker();
    expect(nrvideo.Log.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('media element')
    );
  });
});
