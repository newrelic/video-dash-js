const myPlayer = document.querySelector("#myPlayer");

// Create a new instance of the player
const player = new dashjs.MediaPlayer().create();
player.events = dashjs.MediaPlayer.events;

const url = "https://bitmovin-a.akamaihd.net/content/sintel/sintel.mpd";

/*
  for live stream:
 const url = "https://refapp.hbbtv.org/videos/multiperiod_v8.php?drm=0&advert=1&emsg=0&video=v1,v2,v3&audiolang=eng,fin&sublang=eng,fin,swe&mup=2&spd=8";
*/

/* generic sample mpd file:

 "https://storage.googleapis.com/shaka-demo-assets/sintel-mp4-only/dash.mpd";
"https://bitmovin-a.akamaihd.net/content/sintel/sintel.mpd",
const url = "https://bitmovin-a.akamaihd.net/content/MI201109210084_1/mpds/f08e80da-bf1d-4e3d-8899-f0f6155f6efa.mpd";

*/

try {
  player.initialize(myPlayer, url, true);

  // intializing the tracker and adding events to browser agent
  const mediaEvents = nrvideo.Core.addTracker(new nrvideo.DashTracker(player));

  //poulate quailty levels dropdown
  player.on("streamInitialized", function () {
    const bitrates = player.getBitrateInfoListFor("video");
    const qualitySelector = document.querySelector("#qualityLevels");

    // Add 'auto' option
    const autoOption = document.createElement("option");
    autoOption.value = "auto";
    autoOption.text = "Auto";
    qualitySelector.appendChild(autoOption);

    // Add bitrate options
    bitrates.forEach((level, index) => {
      const option = document.createElement("option");
      option.value = index; // Use index to set quality level
      option.text = `${level.height}p (${Math.round(
        level.bitrate / 1000
      )} kbps)`;
      qualitySelector.appendChild(option);
    });
  });

  // Change video quality based on user selection
  document.querySelector("#qualityLevels").addEventListener("change", (e) => {
    const selectedQuality = e.target.value;

    // document.querySelector("#video-container").style.display = "none"; // Hide video

    loader.style.display = "block"; // Show loader

    if (selectedQuality === "auto") {
      player.updateSettings({
        streaming: { abr: { autoSwitchBitrate: { video: true } } },
      });
    } else {
      player.updateSettings({
        streaming: { abr: { autoSwitchBitrate: { video: false } } },
      });
      player.setQualityFor("video", parseInt(selectedQuality, 10));
    }
  });

  // Hide loader when quality change completes
  player.on(dashjs.MediaPlayer.events.QUALITY_CHANGE_RENDERED, function () {
    // console.log("Quality change completed");
    loader.style.display = "none"; // Hide loader
  });
} catch (error) {
  nrvideo.Core.sendError({ message: error.message });
}
