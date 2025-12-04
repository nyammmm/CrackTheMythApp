# CrackTheMythApp

This repository contains a React Native (Expo) client and a minimal Express backend.

Overview
- Client: Expo app at the repository root (`App.tsx`).
- Backend: Express server in `backend/server.js` with MongoDB integration.

Quick start (development)
1. Start MongoDB (local or hosted) and set `MONGO_URI`.
2. Start backend:
```powershell
cd backend
copy .env.example .env
# edit .env and set MONGO_URI and JWT_SECRET
npm install
npm start
```
3. Run the Expo app:
```powershell
# at repo root
npm install
npm start
# then run on Android emulator (Expo will open)
```

Backend URL configuration for the app
- The app defaults to the Android emulator address `http://10.0.2.2:4000`.
- If you run the backend on a different machine or a device, set the server URL in the Auth screen: tap the "Change server" link under the login form and enter your backend URL (e.g., `http://192.168.1.10:4000`). This value is persisted to AsyncStorage and used for all API calls.

Building for production
- Configure the backend (deploy to Heroku/Railway/Vercel or a VPS) and set `MONGO_URI` and `JWT_SECRET`.
- Change the backend URL in the app before building, or configure your build environment to inject a runtime value (with Expo, use `app.config.js`/`expo-constants` or the managed config to set `extra` values).
 - Change the backend URL in the app before building, or configure your build environment to inject a runtime value. This repo includes `app.config.js` which reads the `BACKEND_URL` environment variable at build-time and exposes it to the app via `expo-constants`.

Build with a production backend URL (example using EAS or a shell env)

Windows PowerShell example (temporary environment variable for build):
```powershell
$env:BACKEND_URL='https://api.myhost.com'
npx eas build --platform android --profile production
```

If you don't use EAS, you can also edit `app.config.js` to set the `backendUrl` before running `expo build` or `expo publish`.

Notes
- This backend is a minimal POC intended for development. For production, add validation, rate-limiting, HTTPS, and stronger security practices.

If you want, I can:
- Add a seed script to import your full quizzes and learning modules into MongoDB automatically.
- Add a production-ready config (app.config.js) so `BACKEND_URL` is baked into builds.

How to generate a full seed and run it
 - Extract the in-app `appData` to a seed file (automated):
	 - This repo includes a small extractor script that pulls the `appData` object from `App.tsx` and writes `backend/seed_data_full.json`.
	 - Run (PowerShell):
```powershell
npm run extract-seed
```
	 - If the extractor fails, it will print an error — this can happen if `appData` contains code that cannot be evaluated automatically. In that case I can help convert the data manually.

 - Seed your MongoDB with the generated file:
	 - Ensure `backend/.env` is configured with `MONGO_URI` and `JWT_SECRET` (copy `backend/.env.example` first).
	 - Install backend deps and run the seed:
```powershell
cd backend
npm install
node seed.js
```
	 - `seed.js` reads `backend/seed_data.json` by default. If you want to seed with the generated file, replace `seed_data.json` or edit `seed.js` to point to `seed_data_full.json`.

Where to get the backend URL and how to set it
 - Local Android emulator (recommended for development):
	 - Use `http://10.0.2.2:4000` when running the Android emulator and the backend on your PC.
 - Local device on the same network:
	 - Use your machine's LAN IP, e.g. `http://192.168.1.10:4000`. Confirm the backend port is reachable from the device.
 - Deployed backend:
	 - Deploy `backend/` to any host (Heroku, Railway, VPS, Docker host). The host URL (for example `https://api.myhost.com`) is your `BACKEND_URL`.

How to bake `BACKEND_URL` into a production build
 - Quick EAS build (PowerShell):
```powershell
$env:BACKEND_URL='https://api.myhost.com'
npx eas build --platform android --profile production
```
 - For classic `expo build` or other workflows, set the `BACKEND_URL` env var before running the build/publish, or edit `app.config.js` directly.

Runtime override in the app
 - The app supports a runtime override: open the Auth screen, tap "Change server" and enter a new backend URL — this is persisted in AsyncStorage and used for all API calls.

Notes & troubleshooting
 - If you seed and the app still shows local content, clear app storage (logout, clear AsyncStorage) so the app fetches remote content.
 - If the extractor cannot parse `appData`, I can adapt the extractor to match your `App.tsx` structure or produce the seed file directly.
