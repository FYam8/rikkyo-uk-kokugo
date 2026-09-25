import { getAllEvents } from './lib/localdb.js';
import { initKokugoProgressSync } from './lib/progressSync.js';

// Cloud sync is deliberately optional. Without VITE_PROGRESS_API_BASE the app
// behaves exactly as before and keeps all learning data local-only.
setTimeout(() => {
  void initKokugoProgressSync({ loadExistingEvents: getAllEvents });
}, 500);

