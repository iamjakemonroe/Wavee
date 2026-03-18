# Wavee Mobile (Expo + React Native)

Production-oriented mobile client for Wavee's MVP:

- Backend API auth + profile bootstrap
- TikTok-style home feed with autoplay primitives
- Song upload via backend API
- Playback screen with shared player state
- Search, playlist, and profile starter screens

## Tech

- React Native (Expo) + TypeScript
- Zustand for local app state
- React Query for server state and pagination
- API-driven architecture (`apps/backend` owns all DB/service logic)

## Getting Started

1. Install deps:

```bash
npm install
```

2. Configure env:

```bash
cp .env.example .env
```

Populate:

- `EXPO_PUBLIC_API_URL`

3. Run mobile app:

```bash
npm run start
```

## Notes

- Upload validation/rate limiting is enforced by backend API handlers.
- Background playback and offline downloads are represented as premium feature placeholders.
- Mobile reads and mutates data only via backend HTTP contracts.
