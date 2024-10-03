import * as nrvideo from "newrelic-video-core";
import Tracker from "../tracker";

const exportedModule = require("../index");

describe("nrvideo DashTracker Assignment", () => {
  it("should assign Tracker to nrvideo.DashTracker", () => {
    expect(nrvideo.DashTracker).toBe(Tracker);
  });

  it("should export the modified nrvideo object", () => {
    expect(exportedModule).toBe(nrvideo);
  });
});
