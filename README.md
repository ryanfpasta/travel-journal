# Travel Journal for iPhone

A travel journal for iPhone, built as a Home Screen web app (no Mac or App Store needed). A sister
of the Android China Journal. It keeps photos with location, places, day moods and
ratings, meals and experiences, notes, a calendar, a map, backups, and the memory box export.

## Install on the iPhone

1. Open the app's web address in **Safari** (Edge and Chrome work too; camera and location permissions then follow that browser's settings).
2. Tap **Share** (the square with the arrow), then **Add to Home Screen**, then **Add**.
3. Open it from the new **Journal** icon. Allow location ("While Using the App") and camera when asked.

Always open it from the Home Screen icon. That copy keeps its own storage and is protected from
Safari's habit of clearing sites you haven't visited in a week.

**The web address must never change.** The journal lives in the iPhone's storage for that exact
address, like the Android app's signing key. A new address starts an empty journal (a backup
restore brings everything across).

## Trips

Each trip has its own name, dates, colour, days, places, photos, map and memory box. Tap the trip
name at the top of Today, Timeline, Calendar or Map to switch or start one; **More** edits the trip in
use and has **Save all photos to the Photos app** (a batch of 20 per tap, which iOS requires).
Journals from v1.0 become one trip on first start (database version 2).

## Videos

**Photo / video** opens the camera with both modes; **Add from library** takes photos and videos.
Clips up to 300 MB are kept as they are, play in the journal, go into backups and Save to Photos.
The memory box shows photos only for now.

## Differences from the Android app

- **No background location.** iPhone web apps can't run in the background. A reading is logged with
  every photo, when you tap **Sync now**, and every 30 minutes while the app is open.
- **Photos taken in the app are not added to the Camera Roll.** They live in the journal (and in
  backups). For important shots you can use the normal Camera app and **Add from library** later;
  the photo keeps its date, and gets a nearby location reading if iOS hides its own.
- **Maps** use online OpenStreetMap tiles. Every tile you've looked at is kept for offline use, and
  **Map → Save this area for offline** downloads the area on screen down to street level ahead of time
  (up to 800 pieces per area and 2,500 a day, to respect the free OSM servers; zoom in to a town or
  region first). The country outlines always work offline. (Mapsforge `.map` files are Android-only.)

## No signal

After the first visit the whole app is stored on the phone and opens in Airplane Mode. Photos, videos,
notes, places, the calendar and backups all work offline; GPS works without data (the first fix can
take longer). Only new map areas and app updates need internet.

## Not losing anything

- Every photo is saved in the same step as its database row, so nothing is half-saved.
- Notes and fields save as you type and when you leave the app.
- Under 1 GB free the app warns; under 150 MB it pauses new photos.
- **More → Back up now** makes one zip. Choose **Save to Files** (iCloud Drive) or AirDrop it.
  It holds every trip. Restoring merges and never removes anything newer.

## Memory box

**More → Export memory box** makes the same zip as the Android app. Unzip it on a laptop and
double-click `memory-box/index.html`.

Since 1.3.1 the page uses the redesigned layout shared with the Android app (light page with a serif
title, highlights strip, calendar, photo mosaic, stops timeline, map card and recap). It works with no
internet: fonts are in `memorybox/fonts`, and the map is an outline map because the iPhone export does
not bundle street tiles. `memorybox/app.js` fills in fields the iPhone export leaves out (regions come
from each day's first city), so keep it identical to the Android copy.

## Releasing an update

Edit the files, bump `VERSION` in `sw.js` and `APP_VERSION` in `index.html`, and publish to the same
address. The app shows "A new version is ready" and the journal data is untouched.

## Layout

- `index.html`, `style.css`: the page.
- `js/store.js`: IndexedDB storage and journal logic (same field names as the Android database).
- `js/photos.js`: camera/library photos, thumbnails, location for photos.
- `js/zip.js`, `js/exif.js`: backup/export zips and photo date/location reading.
- `js/app.js`: screens.
- `sw.js`, `manifest.webmanifest`, `icons/`: offline support and Home Screen install.
- `memorybox/`: the memory box page, copied from the Android app's assets (also provides Leaflet).
