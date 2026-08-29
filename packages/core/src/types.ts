export type SnapshotStatus =
  | "NEW"
  | "UNCHANGED"
  | "CHANGED"
  | "APPROVED"
  | "REJECTED";

export type BuildStatus =
  | "PENDING"
  | "PASSED"
  | "NEEDS_REVIEW"
  | "APPROVED"
  | "REJECTED";

export interface Viewport {
  name: string;
  width: number;
  height: number;
}

export interface CaptureTarget {
  /** Stable identifier used to match a screenshot to its baseline across runs. */
  name: string;
  url: string;
  /** CSS selectors to mask (painted solid) before capture, e.g. timestamps. */
  mask?: string[];
  /** Wait for this selector before capturing. */
  waitFor?: string;
  fullPage?: boolean;
}

/** The shape a user's diffboard.config.js writes - defaults get filled in by `loadConfig`. */
export interface DiffboardUserConfig {
  serverUrl: string;
  token?: string;
  baseBranch?: string;
  targets: CaptureTarget[];
  viewports: Viewport[];
  /** Percentage of changed pixels (0-100) above which a snapshot is flagged CHANGED. */
  threshold?: number;
  outDir?: string;
}

/** A user config with every default resolved - what the rest of the CLI operates on. */
export interface DiffboardConfig extends DiffboardUserConfig {
  baseBranch: string;
  threshold: number;
  outDir: string;
}

export interface DiffResult {
  diffPercent: number;
  diffPixels: number;
  totalPixels: number;
  width: number;
  height: number;
  /** PNG buffer highlighting changed pixels, or null when dimensions differ. */
  diffImage: Buffer | null;
  dimensionsMatch: boolean;
}
