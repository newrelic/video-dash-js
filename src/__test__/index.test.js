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
