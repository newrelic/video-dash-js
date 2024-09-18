const myPlayer = document.querySelector("#myPlayer");

const player = new dashjs.MediaPlayer().create();

player.initialize(
  myPlayer,
  "http://bitmovin-a.akamaihd.net/content/sintel/sintel.mpd",
  true
);

// set up the IMA SDK

const adContainer = document.getElementById("ad-container");

//This class represents a container for displaying ads.
//The SDK will automatically create structures inside the containerElement parameter to house video and overlay ads.

const adDisplayContainer = new google.ima.AdDisplayContainer(adContainer);
adDisplayContainer.initialize();

//AdsLoader allows clients to request ads from ad servers.
//To do so, users must register for the AdsManagerLoadedEvent event and then request ads.
const adsLoader = new google.ima.AdsLoader(adDisplayContainer);

let adsManager;

adsLoader.addEventListener(
  google.ima.AdsManagerLoadedEvent.Type.ADS_MANAGER_LOADED,
  onAdsManagerLoaded,
  false
);

//A class for specifying properties of the ad request.
let adsRequest = new google.ima.AdsRequest();
adsRequest.adTagUrl =
  "https://pubads.g.doubleclick.net/gampad/ads?sz=640x480&iu=/124319096/external/single_ad_samples&ciu_szs=300x250&impl=s&gdfp_req=1&env=vp&output=vast&unviewed_position_start=1&cust_params=deployment%3Ddevsite%26sample_ct%3Dlinear&correlator=";

adsLoader.requestAds(adsRequest);

function onAdsManagerLoaded(adsManagerLoadedEvent) {
  adsManager = adsManagerLoadedEvent.getAdsManager(adContainer);

  adsManager.addEventListener(google.ima.AdErrorEvent.Type.AD_ERROR, onAdError);
  adsManager.addEventListener(
    google.ima.AdEvent.Type.CONTENT_PAUSE_REQUESTED,
    onContentPauseRequested
  );
  adsManager.addEventListener(
    google.ima.AdEvent.Type.CONTENT_RESUME_REQUESTED,
    onContentResumeRequested
  );

  try {
    adsManager.init(640, 360, google.ima.ViewMode.NORMAL);
    adsManager.start();
  } catch (adError) {
    console.log(adError);
  }
}

function onAdError(adErrorEvent) {
  console.log(adErrorEvent.getError());
  if (adsManager) {
    adsManager.destroy();
  }
}

function onContentPauseRequested() {
  player.pause();
}

function onContentResumeRequested() {
  player.play();
}

const playButton = document.getElementById("play-button");

document.getElementById("play-button").addEventListener("click", () => {
  console.log("clicked");
});
