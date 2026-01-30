import nrvideo from '@newrelic/video-core';
import DashTracker from './tracker';

// Assign DashTracker to the nrvideo object
nrvideo.DashTracker = DashTracker;

// Export both for compatibility
module.exports = nrvideo;
module.exports.default = nrvideo;