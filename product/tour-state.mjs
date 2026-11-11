export const TOUR_VERSION = 1;
export const TOUR_QUERY = 'tour';

export function tourKey(userId) {
  if (typeof userId !== 'string' || !userId.trim()) return null;
  return `fuerte-caregiver-tour:v${TOUR_VERSION}:${userId}`;
}

export function hasSeenTour(storage, userId) {
  const key = tourKey(userId);
  if (!key) return true;
  try { return storage.getItem(key) === 'done'; } catch { return false; }
}

export function markTourSeen(storage, userId) {
  const key = tourKey(userId);
  if (!key) return false;
  try { storage.setItem(key, 'done'); return true; } catch { return false; }
}

export function consumeTourRequest(location, history) {
  const url = new URL(location.href);
  if (url.searchParams.get(TOUR_QUERY) !== '1') return false;
  url.searchParams.delete(TOUR_QUERY);
  history.replaceState(history.state, '', url.pathname + url.search + url.hash);
  return true;
}

export function tourMayStart({loading, workspaceReady, clinical, busy, creating, profileReady, hasUnsavedWork}) {
  return !loading && workspaceReady && !clinical && !busy && !creating && profileReady && !hasUnsavedWork;
}

export function hasUnsavedTourWork(root) {
  if (root.querySelector('[data-tour="record-editor"],[data-tour="treatment-editor"]')) return true;
  if (root.querySelector('.chat-composer textarea')?.value?.trim()) return true;
  const form = root.querySelector('[data-tour="profile-create"]');
  return !!form && ['name', 'birth', 'treatment'].some(key => form.elements.namedItem(key)?.value?.trim());
}
