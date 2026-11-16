import DashTracker from "../tracker";
import VegaTracker from "../vegaTracker";

const exportedModule = require("../index");

describe("DashTracker Module Export", () => {
  it("should export DashTracker as default", () => {
    expect(exportedModule.default).toBe(DashTracker);
  });

  it("should export DashTracker as named export", () => {
    expect(exportedModule.DashTracker).toBe(DashTracker);
  });

  it("should export VegaTracker as named export", () => {
    expect(exportedModule.VegaTracker).toBe(VegaTracker);
  });
});

// ---------------------------------------------------------------------------
// The DAI public surface (spec 7.9)
//
// This is new public API that hls.js does not have, so the names are a support
// commitment. Recorded here so a rename cannot happen silently.
// ---------------------------------------------------------------------------
const DaiTracker = require("../ads/dai").default;
const forwardDaiMetadata = require("../ads/forwardDaiMetadata").default;
const browserEntry = require("../entry-browser");
const vegaEntry = require("../entry-vega");

describe("DAI Module Export", () => {
  it("exports DaiTracker as a named export", () => {
    expect(exportedModule.DaiTracker).toBe(DaiTracker);
  });

  it("exports forwardDaiMetadata as a named export", () => {
    expect(exportedModule.forwardDaiMetadata).toBe(forwardDaiMetadata);
  });

  // The UMD target sets libraryExport: 'default', so a bare window.DaiTracker
  // can never exist — script-tag consumers reach these through DashTracker.*
  it("attaches both as statics on the default export", () => {
    expect(exportedModule.default.DaiTracker).toBe(DaiTracker);
    expect(exportedModule.default.forwardDaiMetadata).toBe(forwardDaiMetadata);
  });

  it("exposes the same statics from the browser entry", () => {
    expect(browserEntry.default.DaiTracker).toBe(DaiTracker);
    expect(browserEntry.default.forwardDaiMetadata).toBe(forwardDaiMetadata);
    expect(browserEntry.DaiTracker).toBe(DaiTracker);
    expect(browserEntry.forwardDaiMetadata).toBe(forwardDaiMetadata);
  });

  // ima3_dai.js is browser-only, so DAI has no meaning on connected devices
  // and entry-vega is deliberately untouched (spec 4).
  it("does not export DaiTracker or forwardDaiMetadata from the Vega entry", () => {
    expect(vegaEntry.DaiTracker).toBeUndefined();
    expect(vegaEntry.forwardDaiMetadata).toBeUndefined();
    expect(vegaEntry.default).toBe(VegaTracker);
  });
});
