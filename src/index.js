import DashTracker from './tracker';
import VegaTracker from './vegaTracker';
import DaiTracker from './ads/dai';
import forwardDaiMetadata from './ads/forwardDaiMetadata';

// The UMD build sets `libraryExport: 'default'`, so only the default export
// reaches `window` — a bare `window.DaiTracker` can never exist. Script-tag
// consumers reach the DAI pieces through `DashTracker.DaiTracker` and
// `DashTracker.forwardDaiMetadata`.
DashTracker.DaiTracker = DaiTracker;
DashTracker.forwardDaiMetadata = forwardDaiMetadata;

export default DashTracker;
export { DashTracker, VegaTracker, DaiTracker, forwardDaiMetadata };
