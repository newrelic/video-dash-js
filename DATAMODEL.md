# Introduction

This document provides an overview of the Events and Attributes used for media monitoring in New Relic.

# Glossary

This section defines the key terms used in the context of New Relic Media monitoring:

## Event Types

- **videoAction**: Events triggered by general video interactions, such as starting, pausing, or seeking.
- **videoAdAction**: Events related to ad playback, such as starting, completing, or skipping an ad.
- **videoErrorAction**: Events triggered by errors encountered during video or ad playback.
- **videoCustomAction**: Custom events defined to capture specific actions or interactions beyond default event types.

## Attribute

An Attribute is a piece of data associated with an event. Attributes provide additional context or details about the event, such as the video’s title, duration, or playback position.

- Most attributes are included with every event.
- Some attributes are specific to certain event types, such as ad-related data sent with ad events.

## Event Type Reference

### VideoAction

| Attribute Name           | Definition                                                                                                                                                                                          |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| actionName               | The specific action being performed in the video player, such as play, pause, resume, content buffering, etc. The extensive list for all the actions being performed in the player is listed below. |
| appId                    | The ID of your application, as recorded by New Relic.                                                                                                                                               |
| appName                  | The name of the application.                                                                                                                                                                        |
| playerName               | The name of the video player.                                                                                                                                                                       |
| playerVersion            | The version of the video player.                                                                                                                                                                    |
| deviceType               | The specific type of the device: iPhone 8, iPad Pro, etc.                                                                                                                                           |
| deviceGroup              | The category of the device, such as iPhone or Tablet.                                                                                                                                               |
| deviceManufacturer       | The manufacturer of the device, such as Motorola or HTC.                                                                                                                                            |
| deviceModel              | The model number of the device.                                                                                                                                                                     |
| deviceName               | The device's name.                                                                                                                                                                                  |
| deviceSize               | The display size of the device: Small, normal, large, xlarge.                                                                                                                                       |
| deviceUuid               | A unique identifier assigned at the time of app installation by New Relic.                                                                                                                          |
| viewSession              | Trackers will generate unique IDs for every new video session. This could be the session ID from the client.                                                                                        |
| viewId                   | Trackers will generate unique IDs for every new video iteration.                                                                                                                                    |
| contentId                | The ID of the video.                                                                                                                                                                                |
| contentTitle             | The title of the video.                                                                                                                                                                             |
| contentIsLive            | True if the video is live.                                                                                                                                                                          |
| contentBitrate           | Bitrate (in bits) of the video.                                                                                                                                                                     |
| contentRenditionName     | Name of the rendition (e.g., 1080p).                                                                                                                                                                |
| contentRenditionBitrate  | Target Bitrate of the rendition.                                                                                                                                                                    |
| contentRenditionHeight   | Rendition actual Height (before re-scaling).                                                                                                                                                        |
| contentRenditionWidth    | Rendition actual Width (before re-scaling).                                                                                                                                                         |
| contentDuration          | Duration of the video, in ms.                                                                                                                                                                       |
| contentPlayhead          | Playhead (currentTime) of the video, in ms.                                                                                                                                                         |
| contentLanguage          | Language of the video. We recommend using locale notation, e.g., en_US.                                                                                                                             |
| contentSrc               | URL of the resource being played.                                                                                                                                                                   |
| contentPlayrate          | Playrate (speed) of the video, e.g., 1.0, 0.5, 1.25.                                                                                                                                                |
| contentIsFullscreen      | True if the video is currently fullscreen.                                                                                                                                                          |
| contentIsMuted           | True if the video is currently muted.                                                                                                                                                               |
| contentCdn               | The CDN serving the content.                                                                                                                                                                        |
| contentIsAutoplayed      | If the player was auto-played.                                                                                                                                                                      |
| contentPreload           | The player preload attribute.                                                                                                                                                                       |
| contentFps               | Current FPS (Frames per second).                                                                                                                                                                    |
| isBackgroundEvent        | If the player is hidden by another window.                                                                                                                                                          |
| totalAdPlaytime          | Total time ad is played for this video session.                                                                                                                                                     |
| elapsedTime              | Time that has passed since the last event.                                                                                                                                                          |
| bufferType               | When buffer starts, i.e., initial, seek, pause & connection.                                                                                                                                        |
| asn                      | Autonomous System Number: a unique number identifying a group of IP networks that serves the content to the end user.                                                                               |
| asnLatitude              | The latitude of the geographic center of the postal code where the Autonomous System Network is registered. This is not the end user's latitude.                                                    |
| asnLongitude             | The longitude of the geographic center of the postal code where the Autonomous System Network is registered. This is not the end user's longitude.                                                  |
| asnOrganization          | The organization that owns the Autonomous System Number. Often an ISP, sometimes a private company or institution.                                                                                  |
| timestamp                | The time (date, hour, minute, second) at which the interaction occurred.                                                                                                                            |
| instrumentation.provider | Player/agent name.                                                                                                                                                                                  |
| instrumentation.name     | Name of the instrumentation collecting the data.                                                                                                                                                    |
| instrumentation.version  | Agent’s version.                                                                                                                                                                                    |
