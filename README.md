[![Community Project header](https://github.com/newrelic/opensource-website/raw/master/src/images/categories/Community_Project.png)](https://opensource.newrelic.com/oss-category/#community-project)

# New Relic Dash.js Tracker

[![npm version](https://badge.fury.io/js/%40newrelic%2Fvideo-dash.svg)](https://badge.fury.io/js/%40newrelic%2Fvideo-dash)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)

The New Relic Dash.js Tracker provides comprehensive video analytics for applications using Dash.js Player. Track video events, monitor playback quality, identify errors, and gain deep insights into user engagement and streaming performance for MPEG-DASH content.

## Features

- 🎯 **Automatic Event Detection** - Captures Dash.js player events automatically without manual instrumentation
- 📊 **Comprehensive Bitrate Tracking** - Four distinct bitrate metrics for complete quality analysis
- 🔄 **Multi-Version Support** - Compatible with both dash.js v4.x and v5.x
- 📈 **QoE Metrics** - Quality of Experience aggregation for startup time, buffering, and playback quality
- 🎨 **Event Segregation** - Organized event types: `VideoAction`, `VideoErrorAction`, `VideoCustomAction`
- 🚀 **Easy Integration** - NPM package or direct script include
- ⚡ **Real-Time Performance** - Network throughput and download bitrate monitoring
- 🎬 **MPEG-DASH Specific** - Optimized for adaptive streaming with separate video/audio tracks

## Table of Contents

- [Installation](#installation)
  - [Option 1: NPM/Yarn](#option-1-install-via-npmyarn)
  - [Option 2: Direct Script Include](#option-2-direct-script-include-without-npm)
- [Prerequisites](#prerequisites)
- [Usage](#usage)
- [Best Practices](#best-practices)
- [Configuration Options](#configuration-options)
- [API Reference](#api-reference)
- [Bitrate Metrics](#bitrate-metrics)
- [Data Model](#data-model)
- [Support](#support)
- [Contribute](#contribute)
- [License](#license)

## Installation

### Option 1: Install via NPM/Yarn

Install the package using your preferred package manager:

**NPM:**
```bash
npm install @newrelic/video-dash
```

**Yarn:**
```bash
yarn add @newrelic/video-dash
```

### Option 2: Direct Script Include (Without NPM)

For quick integration without a build system, include the tracker directly in your HTML:

```html
<!DOCTYPE html>
<html>
  <head>
    <!-- Dash.js Player -->
    <script src="https://cdn.dashjs.org/latest/dash.all.min.js"></script>
    
    <!-- New Relic Dash.js Tracker -->
    <script src="path/to/newrelic-video-dash.min.js"></script>
  </head>
  <body>
    <video id="myVideo" controls width="640" height="480"></video>

    <script>
      // Initialize Dash.js player
      var player = dashjs.MediaPlayer().create();
      player.initialize(document.querySelector('#myVideo'), 'https://your-dash-manifest.mpd', true);

      // Configure New Relic tracker with info from one.newrelic.com
      const options = {
        info: {
          licenseKey: "YOUR_LICENSE_KEY",
          beacon: "YOUR_BEACON_URL",
          applicationID: "YOUR_APP_ID"
        }
      };

      // Initialize tracker
      const tracker = new DashTracker(player, options);
    </script>
  </body>
</html>
```

**Setup Steps:**

1. **Get Configuration** - Visit [one.newrelic.com](https://one.newrelic.com) and follow the Streaming Video & Ads onboarding flow to get your `licenseKey`, `beacon`, `applicationID`, and integration code snippet.
2. **Integrate** - Include the script in your HTML and initialize with your configuration

## Prerequisites

Before using the tracker, ensure you have:

- **New Relic Account** - Active New Relic account with valid application credentials (`beacon`, `applicationID`, `licenseKey`)
- **Dash.js Player** - Version 4.x or 5.x integrated in your application


## Usage

### Getting Your Configuration

Before initializing the tracker, obtain your New Relic configuration:

1. Log in to [one.newrelic.com](https://one.newrelic.com)
2. Navigate to the video agent onboarding flow
3. Copy your credentials: `licenseKey`, `beacon`, and `applicationID`

### Browser Setup

Import from the `/browser` subpath — this build includes only the browser agent pipeline and excludes all connected-device (Vega) code, keeping the bundle lean.

Dash.js `player.initialize()` is synchronous — the tracker can be created immediately after, no `tag` needed. DashTracker registers all events on the Dash.js `MediaPlayer` event system, not on the underlying video element.

```javascript
import DashTracker from '@newrelic/video-dash/browser';

// Initialize Dash.js player — initialize() is synchronous.
const player = dashjs.MediaPlayer().create();
player.initialize(document.querySelector('#video'), manifestUrl, true);

// Initialize tracker immediately — no tag needed.
const tracker = new DashTracker(player, {
  info: {
    licenseKey:    'YOUR_LICENSE_KEY',
    beacon:        'YOUR_BEACON_URL',
    applicationID: 'YOUR_APP_ID',
  },
  config: {
    qoeAggregate:      true,
    qoeIntervalFactor: 2,
  },
  customData: {
    contentTitle: 'My Video Title',
  },
});

tracker.setUserId('YOUR_USER_ID');
```

### Vega Setup (Fire TV)

For deployments targeting Amazon Vega or Fire TV (Kepler runtime), import from the `/vega` subpath and use `VegaTracker`. The configuration shape is different — `applicationToken` + `endpoint` instead of license key + beacon, plus an optional `deviceInfo` block carrying runtime device identity.

DashTracker registers all events on the Dash.js `MediaPlayer` event system — no `tag` is needed on Vega either. Initialise inside `onSurfaceViewCreated` so the tracker is created after the surface is ready, and store it in a `useRef` so it can be disposed on cleanup.

```javascript
import { VegaTracker } from '@newrelic/video-dash/vega';
import {
  getDeviceId, getSystemVersion, getModel, getBrand,
  getBuildIdSync, getBuildNumber,
} from '@amazon-devices/react-native-device-info';

const deviceInfo = {
  uuid:               getDeviceId(),
  osVersion:          getSystemVersion(),
  deviceModel:        getModel(),
  deviceManufacturer: getBrand(),
  osBuild:            getBuildIdSync(),    // OS image build
  appBuild:           getBuildNumber(),    // app build number
  architecture:       'aarch64',
};

// Hold the tracker in a ref so it can be disposed on cleanup and accessed
// for later API calls (setUserId, setHarvestInterval, etc.).
const tracker = useRef(null);

// Initialize VegaTracker inside onSurfaceViewCreated.
// DashTracker uses the Dash.js MediaPlayer event system for all events,
// so no explicit tag is needed.
const onSurfaceViewCreated = (surfaceHandle) => {
  videoPlayer.setSurfaceHandle(surfaceHandle);
  videoPlayer.play();

  tracker.current = new VegaTracker(player, {
    info: {
      accountId:        'YOUR_ACCOUNT_ID',
      applicationToken: 'YOUR_NRMA_TOKEN',   // begins "AA…-NRMA"
      endpoint:         'US',                 // 'US' | 'EU' | 'STAGING'
      deviceInfo,                             // optional but recommended
    },
    config: {
      qoeAggregate:      true,
      qoeIntervalFactor: 1,
      obfuscate: [
        { regex: /your-domain\.com\/[^\s"]+/, replacement: 'your-domain.com/[REDACTED]' },
        { regex: /My Video Title/, replacement: '[TITLE_REDACTED]' },
      ],
    },
    customData: {
      contentTitle: 'My Video Title',
    },
  });
  tracker.current.setUserId('YOUR_USER_ID');
};

// Dispose the tracker when content ends to release event listeners.
const onEnded = () => {
  tracker.current?.dispose();
  tracker.current = null;
};
```

#### `info.deviceInfo` field reference

All sub-fields optional — missing values fall back to the defaults baked into the SDK.

| Field | Recommended source | Falls back to |
| --- | --- | --- |
| `uuid` | `getDeviceId()` | `"00000000-0000-0000-0000-000000000000"` |
| `osVersion` | `getSystemVersion()` | `"1.0"` |
| `deviceModel` | `getModel()` | `"VegaDevice"` |
| `deviceManufacturer` | `getBrand()` | `"Amazon"` |
| `osBuild` | `getBuildIdSync()` — **OS image build** | `"1"` |
| `appBuild` | `getBuildNumber()` — **app build number** | `"1"` |
| `architecture` | `'aarch64'` | `"aarch64"` |

### Advanced Configuration

```javascript
const options = {
  info: {
    licenseKey:    'YOUR_LICENSE_KEY',
    beacon:        'YOUR_BEACON_URL',
    applicationID: 'YOUR_APP_ID',
  },
  config: {
    qoeAggregate:      true,
    qoeIntervalFactor: 2,
  },
  customData: {
    contentTitle:     'My Video Title',
    customPlayerName: 'MyCustomPlayer',
    customAttribute:  'customValue',
  },
};

const tracker = new DashTracker(player, options);
```

## Best Practices

### 1. Setting `contentTitle`

The `contentTitle` attribute will display a value if your video metadata contains title information. If the metadata does not include a title, `contentTitle` will not be populated. For best results, ensure you explicitly set this attribute during initialization:

```javascript
const tracker = new DashTracker(player, {
  info: {
    licenseKey: 'YOUR_LICENSE_KEY',
    beacon: 'YOUR_BEACON_URL',
    applicationID: 'YOUR_APP_ID'
  },
  customData: {
    contentTitle: 'My Video Title'  // Explicitly set from your metadata
  }
});
```

If your title changes dynamically (e.g., playlist or queue):

```javascript
tracker.sendOptions({
  customData: {
    contentTitle: 'New Video Title'
  }
});
```

### 2. Setting `userId`

Set a user identifier to track video analytics per user:

```javascript
// Set userId during initialization
const tracker = new DashTracker(player, {
  info: {
    licenseKey: 'YOUR_LICENSE_KEY',
    beacon: 'YOUR_BEACON_URL',
    applicationID: 'YOUR_APP_ID'
  },
  customData: {
    contentTitle: 'Video Title',
    userId: 'user-12345'
  }
});

// Or set userId separately using the API method
tracker.setUserId('user-12345');
```

### 3. Adding Custom Attributes for Your Deployment

Add custom attributes unique to your deployment to improve data aggregation and analysis:

```javascript
const tracker = new DashTracker(player, {
  info: {
    licenseKey: 'YOUR_LICENSE_KEY',
    beacon: 'YOUR_BEACON_URL',
    applicationID: 'YOUR_APP_ID'
  },
  customData: {
    // Required for identification
    contentTitle: videoMetadata.title,
    userId: currentUser.id,
    
    // Custom attributes for your deployment
    subscriptionTier: 'premium',      // User subscription level
    contentProvider: 'studio-abc',    // Content source
    region: 'us-west-2',              // Geographic region
    cdnProvider: 'cloudflare',        // CDN being used
    deviceType: 'desktop',            // Device category
    appVersion: '2.1.0',              // Your app version
    campaign: 'spring-promo'          // Marketing campaign
  }
});
```

**Use these attributes in New Relic queries:**

```sql
-- Analyze by subscription tier
SELECT count(*) FROM VideoAction WHERE actionName = 'CONTENT_START' 
FACET subscriptionTier SINCE 1 day ago

-- Monitor by region
SELECT average(contentNetworkDownloadBitrate) FROM VideoAction 
FACET region SINCE 1 hour ago
```

### 4. Gradual Rollout with Feature Flags

When deploying to production, use feature flags to enable the tracker gradually. This helps you:

- Validate data collection without impacting all users
- Monitor performance impact at scale
- Catch issues before full deployment
- Control monitoring costs

```javascript
// Example using a feature flag
const rolloutPercentage = 5; // Start with 5% of users

function shouldEnableTracking(userId) {
  // Simple percentage-based rollout
  const hash = userId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return (hash % 100) < rolloutPercentage;
}

const player = dashjs.MediaPlayer().create();
player.initialize(document.querySelector('#video'), manifestUrl, true);

// Only initialize tracker if user is in rollout
if (shouldEnableTracking(currentUser.id)) {
  const tracker = new DashTracker(player, {
    info: {
      licenseKey: 'YOUR_LICENSE_KEY',
      beacon: 'YOUR_BEACON_URL',
      applicationID: 'YOUR_APP_ID'
    },
    customData: {
      contentTitle: videoMetadata.title,
      userId: currentUser.id,
      rolloutGroup: `${rolloutPercentage}%`  // Track which rollout group
    }
  });
}
```

**Recommended Rollout Schedule:**

| Phase | Percentage | Duration | Validation |
|-------|-----------|----------|------------|
| Initial | 5% | 2-3 days | Verify data flowing to New Relic |
| Early | 15% | 3-5 days | Check data quality and performance |
| Expansion | 25% | 5-7 days | Validate across device types |
| Majority | 50% | 1-2 weeks | Monitor at scale |
| Full | 100% | Ongoing | Complete deployment |

## Configuration Options

### QoE (Quality of Experience) Settings

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `qoeAggregate` | boolean | `false` | Enable Quality of Experience event aggregation. Set to `true` to collect QoE metrics like startup time, buffering, and average bitrate. |
| `qoeIntervalFactor` | number | `1` | Controls QoE event frequency. A value of `N` sends QoE events once every N harvest cycles. Must be a positive integer. QoE events are always included on first and final harvest cycles. |

### Custom Data

Add custom attributes to all events:

```javascript
customData: {
  contentTitle: 'My Video Title',      // Override video title
  customPlayerName: 'MyPlayer',        // Custom player identifier
  customPlayerVersion: '1.0.0',        // Custom player version
  userId: '12345',                     // User identifier
  contentSeries: 'Season 1',           // Series information
  // Add any custom attributes you need
}
```

> **Note:** There are reserved keywords used for default attributes (see [DATAMODEL.md](./DATAMODEL.md) for the complete list). Do not use these reserved keywords as custom attribute names, as they will be dropped.

> **Limit:** The maximum total number of custom attributes per event is **150**. Any attributes beyond this limit will be dropped.

## API Reference

### Core Methods

#### `tracker.setUserId(userId)`
Set a unique identifier for the current user.

```javascript
tracker.setUserId('user-12345');
```

#### `tracker.setHarvestInterval(milliseconds)`
Configure how frequently data is sent to New Relic. Accepts values between 1000ms (1 second) and 300000ms (5 minutes).

```javascript
tracker.setHarvestInterval(30000); // Send data every 30 seconds
```

#### `tracker.sendCustom(actionName, state, attributes)`
Send custom events with arbitrary attributes.

```javascript
tracker.sendCustom('VideoBookmarked', 'playing', {
  timestamp: Date.now(),
  position: player.time(),
  userId: 'user-12345',
  bookmarkId: 'bookmark-789'
});
```

#### `tracker.sendOptions(options)`
Update tracker configuration after initialization.

```javascript
tracker.sendOptions({
  customData: {
    contentTitle: 'New Video Title',
    season: '1',
    episode: '3'
  }
});
```

### Example: Complete Integration

```javascript
import DashTracker from '@newrelic/video-dash';

// Initialize Dash.js player
const player = dashjs.MediaPlayer().create();
player.initialize(document.querySelector('#video'), manifestUrl, true);

// Initialize tracker
const tracker = new DashTracker(player, {
  info: {
    licenseKey: 'YOUR_LICENSE_KEY',
    beacon: 'YOUR_BEACON_URL',
    applicationID: 'YOUR_APP_ID'
  },
  config: {
    qoeAggregate: true
  }
});

// Set user context
tracker.setUserId('user-12345');

// Configure reporting interval
tracker.setHarvestInterval(30000);

// Send custom events
player.on('qualityChangeRendered', () => {
  tracker.sendCustom('QualityChanged', 'playing', {
    newQuality: player.getQualityFor('video'),
    timestamp: Date.now()
  });
});
```

## Bitrate Metrics

The tracker captures four distinct bitrate metrics providing complete quality analysis:

| Attribute | Description | Use Case |
|-----------|-------------|----------|
| `contentBitrate` | Video-only bitrate (in bps) from the currently active video track, excluding audio | Monitor actual video quality being delivered |
| `contentManifestBitrate` | Maximum combined (video + audio) bitrate (in bps) as declared in the MPD manifest. Represents the highest possible stream variant | Understand maximum quality potential |
| `contentSegmentDownloadBitrate` | Network bandwidth (in bps) estimated by the player's ABR algorithm, based on measured download throughput | Analyze ABR decision-making |
| `contentNetworkDownloadBitrate` | Effective download throughput (in bps), calculated as (bytesDownloaded × 8) / downloadTime from the latest video segment request | Monitor real-time network performance |

### Bitrate Monitoring Example

```javascript
// All bitrate metrics are automatically captured and sent with each event
// Access them in New Relic Insights queries:

// NRQL Query Examples:
// SELECT average(contentNetworkDownloadBitrate) FROM VideoAction WHERE actionName = 'CONTENT_HEARTBEAT'
// SELECT contentBitrate, contentSegmentDownloadBitrate FROM VideoAction WHERE actionName = 'CONTENT_RENDITION_CHANGE'
```

## Data Model

The tracker captures comprehensive video analytics across three event types:

- **VideoAction** - Playback events (play, pause, buffer, seek, quality changes, heartbeats)
- **VideoErrorAction** - Error events (playback failures, network errors, media errors)
- **VideoCustomAction** - Custom events defined by your application

**Full Documentation:** See [DATAMODEL.md](./DATAMODEL.md) for complete event and attribute reference.

## Support

Should you need assistance with New Relic products, you are in good hands with several support channels.

If the issue has been confirmed as a bug or is a feature request, please file a GitHub issue.

### Support Channels

- [New Relic Documentation](https://docs.newrelic.com): Comprehensive guidance for using our platform
- [New Relic Community](https://discuss.newrelic.com): The best place to engage in troubleshooting questions
- [New Relic University](https://learn.newrelic.com): A range of online training for New Relic users of every level
- [New Relic Technical Support](https://support.newrelic.com): 24/7/365 ticketed support. Read more about our [Technical Support Offerings](https://docs.newrelic.com/docs/licenses/license-information/general-usage-licenses/support-plan)

## Contribute

We encourage your contributions to improve the Dash.js Tracker! Keep in mind that when you submit your pull request, you'll need to sign the CLA via the click-through using CLA-Assistant. You only have to sign the CLA one time per project.

If you have any questions, or to execute our corporate CLA (which is required if your contribution is on behalf of a company), drop us an email at opensource@newrelic.com.

For more details on how best to contribute, see [CONTRIBUTING.md](./CONTRIBUTING.md).

### A note about vulnerabilities

As noted in our [security policy](../../security/policy), New Relic is committed to the privacy and security of our customers and their data. We believe that providing coordinated disclosure by security researchers and engaging with the security community are important means to achieve our security goals.

If you believe you have found a security vulnerability in this project or any of New Relic's products or websites, we welcome and greatly appreciate you reporting it to New Relic through our [bug bounty program](https://docs.newrelic.com/docs/security/security-privacy/information-security/report-security-vulnerabilities/).

If you would like to contribute to this project, review [these guidelines](./CONTRIBUTING.md).

To all contributors, we thank you! Without your contribution, this project would not be what it is today.

## License

The Dash.js Tracker is licensed under the [Apache 2.0](http://apache.org/licenses/LICENSE-2.0.txt) License.

The Dash.js Tracker also uses source code from third-party libraries. Full details on which libraries are used and the terms under which they are licensed can be found in the [third-party notices document](./THIRD_PARTY_NOTICES.md).
