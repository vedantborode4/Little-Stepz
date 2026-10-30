import { z } from "zod";

export const SYNC_SOURCES = ["MOCK", "LIVE"] as const;
export type SyncSource = (typeof SYNC_SOURCES)[number];
export const SYNC_SOURCE_LABELS: Record<SyncSource, string> = {
  MOCK: "Demo data (not the website)",
  LIVE: "littlestepz.in",
};

export const SYNC_MODES = ["DRY_RUN", "LINK_IDS"] as const;
export type SyncMode = (typeof SYNC_MODES)[number];
export const SYNC_MODE_LABELS: Record<SyncMode, string> = {
  DRY_RUN: "Dry run",
  LINK_IDS: "Link website IDs",
};

export const SYNC_RUN_STATUSES = ["SUCCEEDED", "FAILED"] as const;
export type SyncRunStatus = (typeof SYNC_RUN_STATUSES)[number];

/** How the CRM is set up to reach the website: never written to, only read. */
export const SYNC_CONNECTIONS = ["OFF", "MOCK", "LIVE"] as const;
export type SyncConnection = (typeof SYNC_CONNECTIONS)[number];

/** Linking needs the plan the owner reviewed, so a changed website can't slip extra links in. */
export const linkIdsSchema = z.object({ dryRunId: z.string().uuid("Run a dry run first") });
export type LinkIdsInput = z.infer<typeof linkIdsSchema>;
