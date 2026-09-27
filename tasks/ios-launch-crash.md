# iOS launch crash — SIGABRT ~200ms into startup

## Symptom
`in.littlestepz` aborts on **every** launch on iOS 26 (iPhone 15), in both App Store
(1.0.1 build 3) and TestFlight (1.0.2 build 4) builds, and in a `preview` profile build.
Signed in or not makes no difference.

## What the crash reports say
```
EXC_CRASH (SIGABRT)  ·  asi: "abort() called"
objc_exception_rethrow
invocation function for block in ObjCTurboModule::performVoidMethodInvocation
_dispatch_call_block_and_release        (serial module queue, not main)
```
Time to death: build 3 ≈ **147 ms**, build 4 ≈ **192 ms** (mach ticks ÷ 24 MHz).

Reading of the trace:
- A **native module's void method raised an `NSException`**. React Native catches it and
  rethrows (`@catch { throw; }`), which unwinds the stack *before* the report is written —
  so the module and method names are **not recoverable from the crash log**. Collecting
  more `.ips` files cannot identify the cause.
- The **JS thread is parked** (`RCTJSThreadManager runRunLoop`). JS finished its first tick
  and dispatched an async native call; the throw happened afterwards on a module queue.
  So this is not a JS exception and `ErrorBoundary` was never going to catch it.
- Build 4 had an `NSURLSession` request in flight (`CFURLCache::createAndOpenCacheDB`),
  build 3 had a keychain read (`SecItemCopyMatching`) — i.e. it dies around the first
  session-restore / first API call.

## Why previous builds didn't fix it
`share_with_app_devs: 0` on both reports, so these crashes reach **neither Xcode Organizer
nor App Store Connect**. There is no crash-reporting SDK (see store-release.md). Every
build so far has been a guess against zero telemetry.

## Change made: startup breadcrumbs
- [ ] `apps/mobile/src/lib/boot-trace.ts` — synchronous breadcrumb log. Uses
      `expo-file-system`'s `File.write()`, which is **sync**, so a mark is durable the
      moment it returns; an AsyncStorage write would still be queued when `abort()` lands.
- [ ] `apps/mobile/index.js` — `require` instead of `import` so startup order is explicit;
      begins the trace first, then installs an `ErrorUtils` global handler that records
      rather than terminates.
- [ ] `apps/mobile/src/app/_layout.tsx` — every module-scope native call
      (`preventAutoHideAsync`, `configureNotificationHandler`, `ensureAndroidChannel`) is
      wrapped in `guard`/`guardAsync`; marks added through the session/font/gate path.
      These all ran **above** `ErrorBoundary`, so any throw aborted silently.
- [ ] `apps/mobile/src/lib/api/query-client.ts` — `NetInfo.addEventListener` and
      `AppState.addEventListener` run at *import* time; now guarded.
- [ ] `apps/mobile/src/components/BootTraceScreen.tsx` — if the previous launch never
      reached `boot:complete`, the trace is shown on screen with a Copy button.

**The last line of the trace is the step that killed the process.**

## Next
1. `eas build -p ios --profile preview` → install → launch (crashes) → launch again → read
   the trace screen.
2. If the trace file comes back empty, `expo-file-system` itself is implicated — that is
   also a signal.
3. Independent of the build: `idevicesyslog -p LittleStepz` from Windows
   (libimobiledevice / iMazing / 3uTools) prints the `*** Terminating app due to uncaught
   exception '<name>', reason: ...` line that the `.ips` omits.
4. Open question: **does a `development` (dev client) build launch?** If yes, the fault is
   release-mode bundling; if no, it is native/config. Decides where to look next.
5. Still worth adding: `@sentry/react-native`, which installs a native uncaught-exception
   handler and would have reported this on build 3.

## Note
`tasks/todo.md` has unresolved merge-conflict markers (`<<<<<<< Updated upstream`) at the
top and was left untouched.

## Recurrence on 1.0.5 (2026-09-27)

The startup path (`index.js`, `_layout.tsx`, `boot-trace.ts`, `query-client.ts`) is unchanged
since the 1.0.3 build that launched fine, apart from two added query keys. The item-returns
work adds no module-scope code that could throw at launch (checked the new zod schema,
enums, error map, notification icon map). No cause found by reading.

### What 1.0.3 actually tells us
The global handler installed in `index.js` records fatal JS errors and does **not** forward
them to React Native's default handler. That default handler calls
`ExceptionsManager.reportFatalException` — a *void* TurboModule method — which raises an
NSException via `RCTFatal`. That is exactly the original crash stack
(`performVoidMethodInvocation` -> `objc_exception_rethrow` -> `abort`). So 1.0.3 most likely
"worked" because it **swallowed** a startup JS fatal, not because anything was fixed.

`expo-router`'s splash util and `Expo.fx` also install global handlers, but both wrap and
forward to the existing one, so the chain still ends in ours.

Consequence for 1.0.5: a JS fatal raised *after* our handler is installed cannot abort. So
the 1.0.5 crash is either a JS fatal raised before it is installed (InitializeCore, the
Metro polyfills, or evaluating `boot-trace.ts` itself), or a genuinely native exception.

Also a side effect worth knowing: because fatals are swallowed, a fatal JS error anywhere in
the app now leaves it running in a possibly broken state (e.g. a blank screen) instead of
crashing. That was acceptable for diagnosis; it should be revisited once this is resolved.

### Change in 1.0.6: the trace is readable without the app running
`UIFileSharingEnabled` + `LSSupportsOpeningDocumentsInPlace` expose the app's Documents
folder in the iOS **Files** app (On My iPhone -> Little Stepz). `boot-trace.txt` is the only
file the app writes there. If the app dies before it can render the trace screen, the trace
can still be opened on the phone — no Mac needed. Remove these keys once diagnosed.
