// Precache the whole static export so the manual works offline after the first visit.
import { generateSW } from 'workbox-build';

const { count, size, warnings } = await generateSW({
  globDirectory: 'dist',
  globPatterns: ['**/*.{html,js,css,json,png,jpg,jpeg,svg,ico,ttf,woff,woff2,wav}'],
  swDest: 'dist/sw.js',
  maximumFileSizeToCacheInBytes: 20 * 1024 * 1024,
  // /chapter/Water?block=3 must hit the precached /chapter/Water.html
  ignoreURLParametersMatching: [/.*/],
  cleanupOutdatedCaches: true,
  clientsClaim: true,
  skipWaiting: true,
});
warnings.forEach((w) => console.warn(w));
console.log(`sw.js: precached ${count} files, ${(size / 1024 / 1024).toFixed(1)} MB`);
