/**
 * Whether the loading screen should be up: the level's files are still loading, or a
 * mode is starting (endless waits for its run ticket) while the canvas still holds the
 * old level, frozen. Without the second case the game looks stuck on the last level.
 */
export const loadingScreenUp = ({ levelLoaded, modeStarting }) => !levelLoaded || modeStarting;
