import { defineConfig } from 'astro/config';

// Static output: /ru and /en are complete HTML documents, so language, metadata
// and every scientific statement are present before any script runs.
export default defineConfig({
  site: 'https://demoru.vitacodex.life',
  output: 'static',
  trailingSlash: 'never',
  build: { format: 'file' },
  devToolbar: { enabled: false },
});
