[![Community Project header](https://github.com/newrelic/opensource-website/raw/master/src/images/categories/Community_Project.png)](https://opensource.newrelic.com/oss-category/#community-project)

# New Relic Dash Tracker Agent

The New Relic Dash Tracker enhances your media applications by tracking video events, session errors, and other activities, providing comprehensive insights into performance and user interactions.

- The Player Name tracker is available as a ready-to-use JavaScript snippet for easy copy-paste integration.
- New Relic Video.js module auto-detects events emitted by Video.js Player.
- Ensure that the **Browser agent** is successfully instrumented before deploying the media tracker.
- For questions and feedback on this package, please visit the Explorer's Hub, New Relic's community support forum.
- Looking to contribute to the Player Name agent code base? See [DEVELOPING.md](https://link-to-your-developing-md-file) for instructions on building and testing the browser agent library, and Contributors.

## Adding The Dash Tracker To Your Project

To integrate New Relic Tracker Agent into your web application effectively, you'll need to instrument the Browser Agent code first and then add the player script. Below is a guide on how to do this within your HTML file:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>New Relic Tracker Integration</title>
    <script src="path/to/browser-agent.js"></script>
    <script src="path/to/player-name-tracker.js"></script>
  </head>
  <body>
    <!-- Your HTML content -->
  </body>
</html>
```

## Instantiating the Dash Tracker

```javascript
// Add a DashTracker
nrvideo.Core.addTracker(new nrvideo.DashTracker(player));

// For setting userId
nrvideo.Core.addTracker(new nrvideo.DashTracker(player)).setUserId("userId");

//For setting custom attributes const tracker = new
nrvideo.VideojsTracker(player, { customData: { contentTitle: "Override Existing
Title", customPlayerName: "myGreatPlayer", customPlayerVersion: "9.4.2" } });



```

Support New Relic has open-sourced this project. This project is provided AS-IS
WITHOUT WARRANTY OR DEDICATED SUPPORT. Issues and contributions should be
reported to the project here on GitHub. We encourage you to bring your
experiences and questions to the [Explorers Hub](https://discuss.newrelic.com)
where our community members collaborate on solutions and new ideas. ##
Contributing We encourage your contributions to improve New Relic Dash Tracker!
Keep in mind when you submit your pull request, you'll need to sign the CLA via
the click-through using CLA-Assistant. You only have to sign the CLA one time
per project. If you have any questions, or to execute our corporate CLA,
required if your contribution is on behalf of a company, please drop us an email
at opensource@newrelic.com. **A note about vulnerabilities** As noted in our
[security policy](../../security/policy), New Relic is committed to the privacy
and security of our customers and their data. We believe that providing
coordinated disclosure by security researchers and engaging with the security
community are important means to achieve our security goals. If you believe you
have found a security vulnerability in this project or any of New Relic's
products or websites, we welcome and greatly appreciate you reporting it to New
Relic through [our bug bounty
program](https://docs.newrelic.com/docs/security/security-privacy/information-security/report-security-vulnerabilities/).

## License New Relic Dash Tracker is licensed under the [Apache

2.0](http://apache.org/licenses/LICENSE-2.0.txt) License. ## Release - Create a
PR. - Once approved, Update the package version according to the semver rules. -
Update the CHANGELOG in the repo (all web repos have a changelog file). - Create
a github tag with the version.

```

```
