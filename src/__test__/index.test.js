import DashTracker from "../tracker";

const exportedModule = require("../index");

describe("DashTracker Module Export", () => {
  it("should export DashTracker as default", () => {
    expect(exportedModule.default).toBe(DashTracker);
  });
});
