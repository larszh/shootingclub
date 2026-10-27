// Gemeinsame Typen für Offline-Speicher, Synchronisierung und Offline-Ansichten.
// Bewusst ohne Laufzeit-Abhängigkeiten, damit Server und Client sie importieren können.
import type { Stage } from "@/modules/scores/types";

export type ScoreResult = { stageIndex: number; shots: number[]; total: number };

export type ScoreParticipant = {
  /** Teilnehmer-ID (Server) bzw. Index als String bei offline erstellten Durchgängen. */
  id: string;
  userId: string | null;
  name: string;
  isGuest: boolean;
  note: string | null;
  isMe: boolean;
  avatarUrl: string | null;
  results: ScoreResult[];
};

/** Serialisierbare Sicht auf einen Durchgang (Server-Seite, Snapshot oder IndexedDB). */
export type ScoreMatch = {
  id: string | null;
  clientId: string | null;
  title: string | null;
  /** ISO-Zeitpunkt */
  date: string;
  /** Zeitpunkt (Serverzeit, ISO), zu dem diese Ansicht erzeugt wurde */
  generatedAt: string;
  status: string;
  locationNote: string | null;
  createdByName: string | null;
  canEdit: boolean;
  canDelete: boolean;
  program: {
    id: string;
    name: string;
    discipline: string;
    scoringMode: string;
    stages: Stage[];
    totals: { shots: number; max: number; distances: number[] };
  };
  participants: ScoreParticipant[];
};

// ---------------------------------------------------------------------------
// Outbox
// ---------------------------------------------------------------------------

export type CreateMatchParticipantInput = { userId?: string; guestName?: string; note?: string };

export type CreateMatchPayload = {
  clientId: string;
  programId: string;
  title?: string;
  /** "YYYY-MM-DD" oder ISO */
  date?: string;
  locationNote?: string;
  participants: CreateMatchParticipantInput[];
};

export type MatchRef = { matchId?: string; matchClientId?: string };

export type SaveStageResultPayload = MatchRef & {
  /** Teilnehmer-ID, bei offline erstellten Durchgängen (matchClientId) der Index als String. */
  participantKey: string;
  stageIndex: number;
  shots: number[];
  /** ms seit Epoch (Gerätezeit) – last-write-wins */
  clientUpdatedAt: number;
};

export type SetMatchStatusPayload = MatchRef & { status: "OPEN" | "FINISHED"; clientUpdatedAt: number };

export type SyncOpType = "createMatch" | "saveStageResult" | "setMatchStatus";

type OpBase = {
  /** Eindeutige ID dieser Operation (Idempotenz). */
  id: string;
  tenantId: string;
  userId: string;
};

export type WireOp =
  | (OpBase & { type: "createMatch"; payload: CreateMatchPayload })
  | (OpBase & { type: "saveStageResult"; payload: SaveStageResultPayload })
  | (OpBase & { type: "setMatchStatus"; payload: SetMatchStatusPayload });

/** Eintrag in der Outbox (IndexedDB). `key` fasst gleichartige Operationen zusammen. */
export type OutboxOp = WireOp & {
  key: string;
  createdAt: number;
  attempts: number;
  nextAttemptAt: number;
  lastError?: string | null;
  failed?: boolean;
  /** Speicher-Schlüssel des Durchgangs in der UI (s:<id> oder c:<clientId>) */
  originKey?: string;
  /** Teilnehmer-Schlüssel, wie ihn die UI verwendet */
  uiParticipantKey?: string;
};

export type SyncMapping = { matchClientId: string; matchId: string; participantIds: Array<string | null> };

export type SyncOpResult = {
  id: string;
  ok: boolean;
  error?: string;
  code?: string;
  /** true = später erneut versuchen, false = dauerhaft fehlgeschlagen */
  retry?: boolean;
  /** Ältere Änderung, vom Server ignoriert (last-write-wins) */
  ignored?: boolean;
  matchId?: string;
  mapping?: SyncMapping;
  /** Serverzeit der Bestätigung (vom Client aus der Antwort übernommen) */
  serverTime?: number;
};

export type SyncResponse = { results: SyncOpResult[]; serverTime: number };

// ---------------------------------------------------------------------------
// Snapshot und lokale Durchgänge
// ---------------------------------------------------------------------------

export type SnapshotProgram = {
  id: string;
  name: string;
  discipline: string;
  scoringMode: string;
  stages: Stage[];
  totals: { shots: number; max: number; distances: number[] };
  favorite: boolean;
};

export type SnapshotMember = { id: string; name: string; avatarUrl: string | null };

export type SnapshotResponse = {
  user: { id: string; name: string; avatarUrl: string | null };
  tenant: { id: string; name: string } | null;
  scores: {
    canCreate: boolean;
    programs: SnapshotProgram[];
    members: SnapshotMember[];
    openMatches: ScoreMatch[];
  } | null;
  generatedAt: string;
};

export type OfflineSnapshot = {
  tenantId: string;
  tenantName: string;
  userId: string;
  userName: string;
  userAvatarUrl: string | null;
  canCreate: boolean;
  programs: SnapshotProgram[];
  members: SnapshotMember[];
  generatedAt: string;
};

export type OfflineSession = { userId: string; userName: string; tenantId: string | null; tenantName: string | null; updatedAt: number };

/** Lokal gespeicherter Durchgang. `shots[participantKey][stageIndex]`. */
export type MatchEntry = {
  key: string;
  userId: string;
  tenantId: string;
  view: ScoreMatch;
  shots: Record<string, number[][]>;
  /** "participantKey|stageIndex" → Zeitstempel der lokalen, noch nicht bestätigten Änderung */
  dirty: Record<string, number>;
  /** "participantKey|stageIndex" → Serverzeit, zu der der lokale Stand bestätigt wurde */
  synced?: Record<string, number>;
  status: string;
  statusDirty?: number | null;
  updatedAt: number;
  /** Gesetzt, sobald ein offline erstellter Durchgang auf dem Server existiert. */
  serverId?: string | null;
  participantMap?: Array<string | null>;
};

export type SyncEvent =
  | { type: "acked"; op: OutboxOp; result: SyncOpResult }
  | { type: "failed"; op: OutboxOp; result: SyncOpResult }
  | { type: "mapped"; clientId: string; matchId: string; participantIds: Array<string | null> }
  | { type: "flushed"; acked: number }
  | { type: "snapshot" }
  | { type: "changed" };

export function cellKey(participantKey: string, stageIndex: number) {
  return `${participantKey}|${stageIndex}`;
}
