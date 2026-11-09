import forwardDaiMetadata from '../../ads/forwardDaiMetadata';
import nrvideo from '@newrelic/video-core';

const SCHEME = 'urn:google:dai:2018';
const ON_RECEIVE = 'eventModeOnReceive';

function createPlayer() {
  const subscriptions = [];
  return {
    on: jest.fn((type, handler, scope, options) => {
      subscriptions.push({ type, handler, scope, options });
    }),
    off: jest.fn(),
    _subscriptions: subscriptions,
  };
}

function createStreamManager() {
  return { processMetadata: jest.fn() };
}

// The shape dash.js actually delivers, measured verbatim against 5.3.0:
// the handler receives a WRAPPER, and the payload is on `.event`.
function wrappedEvent(overrides = {}) {
  return {
    type: SCHEME,
    event: {
      type: 'urn:google:dai:2018',
      id: 0,
      messageData: 'google_0908243367581169597',
      calculatedPresentationTime: 179378216.085,
      presentationTimeDelta: null,
      duration: 0,
      presentationTime: 0,
      eventStream: {},
      parsedMessageData: undefined,
      ...overrides,
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  delete global.dashjs;
});

describe('forwardDaiMetadata — subscription', () => {
  // Registering BOTH modes delivers every event twice and doubles every
  // AD_QUARTILE reaching New Relic. Measured: 126 events per mode, all 14
  // distinct ids in both (spec 7.3). video-core's sendAdQuartile does no
  // de-duplication, so this is the only place it is prevented.
  it('subscribes to the DAI scheme in exactly one mode', () => {
    const player = createPlayer();

    forwardDaiMetadata(player, createStreamManager());

    expect(player.on).toHaveBeenCalledTimes(1);
    const [type, handler, scope, options] = player.on.mock.calls[0];
    expect(type).toBe(SCHEME);
    expect(typeof handler).toBe('function');
    expect(options).toEqual({ mode: ON_RECEIVE });
  });

  it('never subscribes in the ON_START mode', () => {
    const player = createPlayer();
    global.dashjs = {
      MediaPlayer: {
        events: {
          EVENT_MODE_ON_RECEIVE: 'eventModeOnReceive',
          EVENT_MODE_ON_START: 'eventModeOnStart',
        },
      },
    };

    forwardDaiMetadata(player, createStreamManager());

    const modes = player.on.mock.calls.map(([, , , options]) => options?.mode);
    expect(modes).toEqual([ON_RECEIVE]);
    expect(modes).not.toContain('eventModeOnStart');
  });

  it('reads the mode from the dashjs global when present', () => {
    const player = createPlayer();
    global.dashjs = {
      MediaPlayer: { events: { EVENT_MODE_ON_RECEIVE: 'someFutureModeName' } },
    };

    forwardDaiMetadata(player, createStreamManager());

    expect(player.on.mock.calls[0][3]).toEqual({ mode: 'someFutureModeName' });
  });

  // The helper must not import dash.js — it stays consumer-provided. And the
  // guard has to be a typeof check: `dashjs?.MediaPlayer` still throws a
  // ReferenceError on an identifier that was never declared.
  it('falls back to the measured literal when the dashjs global is absent', () => {
    const player = createPlayer();
    expect(global.dashjs).toBeUndefined();

    expect(() => forwardDaiMetadata(player, createStreamManager())).not.toThrow();

    expect(player.on.mock.calls[0][3]).toEqual({ mode: ON_RECEIVE });
  });

  it('falls back to the literal when the global exists but carries no mode', () => {
    const player = createPlayer();
    global.dashjs = { MediaPlayer: { events: {} } };

    forwardDaiMetadata(player, createStreamManager());

    expect(player.on.mock.calls[0][3]).toEqual({ mode: ON_RECEIVE });
  });
});

describe('forwardDaiMetadata — forwarding', () => {
  function forwardOne(event) {
    const player = createPlayer();
    const streamManager = createStreamManager();
    forwardDaiMetadata(player, streamManager);
    player._subscriptions[0].handler(event);
    return streamManager;
  }

  // THE measured correction. dash.js hands the handler `{ event, type }`, so
  // `e.messageData` is undefined. Forwarding that calls processMetadata with no
  // data and not one ad event ever fires — indistinguishable from not
  // forwarding at all. Proved both ways on the live asset: census
  // {streamInitialized: 1, loaded: 1} after 60s versus a full break in 5s.
  it('unwraps the dash.js event wrapper before forwarding', () => {
    const streamManager = forwardOne(wrappedEvent());

    expect(streamManager.processMetadata).toHaveBeenCalledWith(
      SCHEME,
      'google_0908243367581169597',
      179378216.085
    );
  });

  it('forwards messageData and calculatedPresentationTime to processMetadata', () => {
    const streamManager = forwardOne(
      wrappedEvent({ messageData: 'google_abc', calculatedPresentationTime: 12.5 })
    );

    expect(streamManager.processMetadata).toHaveBeenCalledWith(SCHEME, 'google_abc', 12.5);
  });

  // Defensive: if a future dash.js stops wrapping, or a v4 build never did,
  // the same call must keep working.
  it('tolerates an already-unwrapped payload', () => {
    const streamManager = forwardOne({
      messageData: 'google_flat',
      calculatedPresentationTime: 99.5,
    });

    expect(streamManager.processMetadata).toHaveBeenCalledWith(SCHEME, 'google_flat', 99.5);
  });

  // presentationTimeDelta was null on every event measured, so a helper using
  // it would forward null and schedule nothing.
  it('never reads presentationTimeDelta', () => {
    const player = createPlayer();
    const streamManager = createStreamManager();
    forwardDaiMetadata(player, streamManager);

    let deltaRead = false;
    const event = {
      type: SCHEME,
      event: {
        messageData: 'google_abc',
        calculatedPresentationTime: 7,
        get presentationTimeDelta() {
          deltaRead = true;
          return null;
        },
      },
    };
    player._subscriptions[0].handler(event);

    expect(deltaRead).toBe(false);
    expect(streamManager.processMetadata).toHaveBeenCalledWith(SCHEME, 'google_abc', 7);
  });

  it('does not throw when processMetadata throws', () => {
    const player = createPlayer();
    const streamManager = {
      processMetadata: jest.fn(() => {
        throw new Error('SDK rejected the metadata');
      }),
    };
    forwardDaiMetadata(player, streamManager);

    expect(() => player._subscriptions[0].handler(wrappedEvent())).not.toThrow();
    expect(nrvideo.Log.warn).toHaveBeenCalled();
  });

  it('does not throw on an event carrying no payload at all', () => {
    const player = createPlayer();
    const streamManager = createStreamManager();
    forwardDaiMetadata(player, streamManager);

    expect(() => player._subscriptions[0].handler(undefined)).not.toThrow();
    expect(() => player._subscriptions[0].handler({})).not.toThrow();
  });
});

describe('forwardDaiMetadata — lifecycle', () => {
  it('returns a function that removes the listener', () => {
    const player = createPlayer();

    const stop = forwardDaiMetadata(player, createStreamManager());
    expect(typeof stop).toBe('function');

    stop();

    const [onType, onHandler, onScope] = player.on.mock.calls[0];
    // Same type, same handler reference AND same scope: dash.js matches all
    // three when removing, so a mismatched scope would leave the listener
    // attached and silently keep forwarding.
    expect(player.off).toHaveBeenCalledWith(onType, onHandler, onScope);
  });

  it('warns and no-ops when the player is missing', () => {
    const stop = forwardDaiMetadata(null, createStreamManager());

    expect(nrvideo.Log.warn).toHaveBeenCalledWith(
      expect.stringContaining('forwardDaiMetadata')
    );
    expect(typeof stop).toBe('function');
    expect(() => stop()).not.toThrow();
  });

  it('warns and no-ops when the StreamManager is missing', () => {
    const player = createPlayer();

    const stop = forwardDaiMetadata(player, null);

    expect(nrvideo.Log.warn).toHaveBeenCalled();
    expect(player.on).not.toHaveBeenCalled();
    expect(() => stop()).not.toThrow();
  });

  it('does not throw when removing the listener fails', () => {
    const player = createPlayer();
    player.off = jest.fn(() => {
      throw new Error('already gone');
    });

    const stop = forwardDaiMetadata(player, createStreamManager());

    expect(() => stop()).not.toThrow();
  });
});
