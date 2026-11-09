// Video element resolution (spec 7.6) — in its own file because it needs a
// FAITHFUL video-core base class.
//
// The project's `__mock__.js` VideoTracker does `this.tag = player` straight in
// its constructor and never calls `setPlayer()` at all, so under that mock
// DashTracker.setPlayer is dead code and the resolution cannot be observed. It
// also defines no `setPlayer` on the prototype, which is what
// `DashTracker.setPlayer` delegates to.
//
// The base below mirrors the real video-core 5.1.1 (dist/cjs/index.js):
//
//   constructor(e, t) { ... e && this.setPlayer(e, t.tag) }
//   setPlayer(e, t)   { t = t || e; this.player = e; this.tag = t;
//                       this.registerListeners() }

import DashTracker from '../tracker';

jest.mock('@newrelic/video-core', () => {
  class VideoTracker {
    constructor(player, options) {
      this.options = options || {};
      this.state = {};
      this.adsTracker = null;
      if (player) this.setPlayer(player, this.options.tag);
    }

    setPlayer(player, tag) {
      this.player = player;
      this.tag = tag || player; // the real base's fallback
      this.registerListeners();
    }

    registerListeners() {}
    unregisterListeners() {}
    getTrackerVersion() {
      return '1.0.0';
    }
  }

  const mock = {
    VideoTracker,
    Core: { addTracker: jest.fn() },
    Log: { debugCommonVideoEvents: jest.fn(), warn: jest.fn(), error: jest.fn() },
  };
  return { ...mock, default: mock };
});

function makePlayer(overrides = {}) {
  return {
    on: jest.fn(),
    off: jest.fn(),
    getVersion: jest.fn().mockReturnValue('5.3.0'),
    ...overrides,
  };
}

describe('video element resolution', () => {
  // Removes the ordering trap that bit the hls.js sample, where the tracker had
  // to be constructed AFTER the media element was attached. getVideoElement
  // exists in both dash.js 4.7.4 and 5.3.0.
  it('resolves the video element from player.getVideoElement()', () => {
    const element = { currentTime: 0, muted: false };
    const player = makePlayer({
      getVideoElement: jest.fn().mockReturnValue(element),
    });

    const tracker = new DashTracker(player, {});

    expect(tracker.tag).toBe(element);
    expect(player.getVideoElement).toHaveBeenCalled();
  });

  it('prefers options.tag over player.getVideoElement()', () => {
    const element = { currentTime: 0 };
    const explicit = { currentTime: 99 };
    const player = makePlayer({
      getVideoElement: jest.fn().mockReturnValue(element),
    });

    const tracker = new DashTracker(player, { tag: explicit });

    expect(tracker.tag).toBe(explicit);
    // An app that already passes a tag must be entirely unaffected.
    expect(player.getVideoElement).not.toHaveBeenCalled();
  });

  it('falls back to the player when the element does not exist yet', () => {
    const player = makePlayer({
      getVideoElement: jest.fn(() => {
        throw new Error('no element yet');
      }),
    });

    let tracker;
    expect(() => {
      tracker = new DashTracker(player, {});
    }).not.toThrow();
    expect(tracker.tag).toBe(player);
  });

  // dash.js 4 and 5 both have getVideoElement, but a custom or stubbed player
  // may not.
  it('falls back to the player when getVideoElement is absent', () => {
    const player = makePlayer();
    const tracker = new DashTracker(player, {});
    expect(tracker.tag).toBe(player);
  });

  it('falls back to the player when getVideoElement returns nothing', () => {
    const player = makePlayer({ getVideoElement: jest.fn(() => null) });
    const tracker = new DashTracker(player, {});
    expect(tracker.tag).toBe(player);
  });
});
