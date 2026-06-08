# Update 01: General Purpose UI & Glassmorphism

Date: 2026-05-12

## Purpose
Transform the specialized "LeetCode solver" UI into a general-purpose AI assistant interface with a premium glassmorphism look, global keyboard shortcuts, and improved window draggability.

## Steps
1. [x] **Refine Design System**: Updated `index.css` with advanced glassmorphism tokens (`--glass-bg`, `--glass-blur`), premium typography (Inter), and a flexible layout.
2. [x] **Generalize UI Components**: Rewrote `App.tsx` to include a search/input bar, generalized action buttons (Assist, Recap, etc.), and a layout matching the reference image.
3. [x] **Implement Keyboard Shortcuts**: Added listeners for `Cmd+B` (Toggle Panel), `Cmd+H` (Stop Capture), and `Cmd+Enter` (Trigger Assist).
4. [x] **Improve Draggability**: Implemented a `window-wrapper` that handles draggability for the top bar and the main panel background, while keeping buttons interactive.

5. [x] **Implement Guide Mode**: Added a global "Guide Me" mode that uses a full-screen transparent overlay.
    - Added `setIgnoreMouseEvents` to allow clicking through the guide.
    - Created an animated `MousePointer2` arrow that moves to specific screen coordinates.
    - Integrated Web Speech API (`speechSynthesis`) for real-time voice guidance.
    - Added a mock "element locator" that simulates finding UI elements and pointing to them.

## Expected Outcome
A sleek, movable, and responsive AI overlay that feels integrated into the desktop environment and supports various workflows beyond coding.
