"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getServerSyncStatus, getSyncStatus, subscribeSyncStatus, type SyncStatus } from "./outbox";
import { onSyncEvent } from "./events";
import type { SyncEvent } from "./types";

/** Online-Status und Anzahl ausstehender Übertragungen für die UI. */
export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(subscribeSyncStatus, getSyncStatus, getServerSyncStatus);
}

/** Auf Ereignisse der Offline-Schicht reagieren (Listener sollte stabil sein oder mit useCallback erzeugt). */
export function useSyncEvents(listener: (ev: SyncEvent) => void) {
  useEffect(() => onSyncEvent(listener), [listener]);
}
