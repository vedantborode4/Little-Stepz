import { File, Paths } from "expo-file-system";

/**
 * Synchronous startup breadcrumb log.
 *
 * The iOS release builds abort with a bare SIGABRT ~200ms into launch. React
 * Native catches an NSException raised by a native module method and rethrows it
 * from a dispatch block (`ObjCTurboModule::performVoidMethodInvocation` ->
 * `objc_exception_rethrow`); the stack has already unwound past the throw site by
 * then, so the crash report names neither the module nor the method. A JS error
 * handler cannot see it either, because the throw is native and the JS thread is
 * parked when it happens.
 *
 * So rather than try to catch the failure, record how far startup got. `write()`
 * is synchronous, so a mark is durable the moment it returns — unlike
 * AsyncStorage, whose write would still be queued when abort() lands. The next
 * launch reads the trace back and, if it never reached `boot:complete`, shows it
 * on screen: the last mark is the step that killed the process.
 *
 * Every entry point is fail-soft. A diagnostic must never become the crash.
 */

const FILE_NAME = "boot-trace.txt";

let marks: string[] = [];
let previous: string | null = null;
let sink: File | null = null;
let disabled = false;
let startedAt = Date.now();

function sinkFile(): File | null {
  if (disabled) return null;
  if (sink) return sink;
  try {
    const f = new File(Paths.document, FILE_NAME);
    if (!f.exists) f.create({ overwrite: true });
    sink = f;
    return sink;
  } catch {
    disabled = true;
    return null;
  }
}

function flush(): void {
  const f = sinkFile();
  if (!f) return;
  try {
    f.write(marks.join("\n"));
  } catch {
    disabled = true;
  }
}

/** Reads the previous run's trace, then starts a new one. Call once, first thing. */
export function beginBootTrace(): void {
  const f = sinkFile();
  if (f) {
    try {
      previous = f.textSync() || null;
    } catch {
      previous = null;
    }
  }
  marks = [];
  startedAt = Date.now();
  mark("boot:begin");
}

/** Records a step. Durable as soon as it returns. */
export function mark(step: string): void {
  if (disabled) return;
  marks.push(`+${String(Date.now() - startedAt).padStart(5, " ")}ms  ${step}`);
  flush();
}

/** Records a caught failure without letting the reporting itself throw. */
export function markError(step: string, err: unknown): void {
  const detail =
    err instanceof Error ? `${err.message}\n${err.stack ?? "(no stack)"}` : String(err);
  mark(`!! FAILED ${step}\n${detail}`);
}

/** Runs `fn`, recording the step and any throw. Never rethrows. */
export function guard(step: string, fn: () => void): void {
  mark(step);
  try {
    fn();
  } catch (err) {
    markError(step, err);
  }
}

/** Same as `guard` for a promise-returning call: marks a rejection instead of dropping it. */
export function guardAsync(step: string, fn: () => Promise<unknown>): void {
  mark(step);
  try {
    void fn().catch((err) => markError(step, err));
  } catch (err) {
    markError(step, err);
  }
}

/** Marks startup as having finished, so the next launch shows nothing. */
export function completeBootTrace(): void {
  mark("boot:complete");
}

/**
 * The previous run's trace, but only when that run never reached
 * `boot:complete` — i.e. only when it died or was killed mid-startup.
 */
export function previousCrashTrace(): string | null {
  if (!previous || previous.includes("boot:complete")) return null;
  return previous;
}
