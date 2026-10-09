# 21 — Mapa de components

## Shell

- `AppShell`.
- `GameShell`.
- `OrientationGate`.
- `ConnectionBanner`.
- `SoundToggle`.
- `ErrorBoundary`.

## Joc

- `BoardScene`.
- `BoardPath`.
- `BoardCell`.
- `Pawn`.
- `TurnHeader`.
- `ProgressSummary`.
- `QuestionCard`.
- `AnswerPanel`.
- `JudgeControls`.
- `TpClaimControls`.
- `ResultOverlay`.
- `VictoryOverlay`.

## Setup

- `PrivateAccessScreen`.
- `HomeScreen`.
- `ModeScreen`.
- `DurationScreen`.
- `StartingPlayerScreen`.
- `OnlineChoiceScreen`.
- `RoleScreen`.
- `LobbyScreen`.

## Serveis

- `authService`.
- `gameService`.
- `realtimeService`.
- `audioService`.
- `hapticsService`.
- `assetPreloadService`.

## Hooks

- `useAnonymousSession`.
- `useAuthorizedDevice`.
- `useGameView`.
- `useGameActions`.
- `useGameRealtime`.
- `usePresence`.
- `useOrientationGate`.
- `useSoundPreference`.

## Regla

Els components reben una `GameView` segura. No consulten la taula `questions` ni decideixen permisos per si sols.
