export const TOUR_VERSION: number;
export const TOUR_QUERY: string;
export function tourKey(userId: string | null | undefined): string | null;
export function hasSeenTour(storage: Storage, userId: string | null | undefined): boolean;
export function markTourSeen(storage: Storage, userId: string | null | undefined): boolean;
export function consumeTourRequest(location: Location, history: History): boolean;
export function tourMayStart(state: {loading:boolean;workspaceReady:boolean;clinical:boolean;busy:boolean;creating:boolean;profileReady:boolean;hasUnsavedWork:boolean}): boolean;
export function hasUnsavedTourWork(root: Document): boolean;
