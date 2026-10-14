# AHK Egypt · 75th Anniversary Photobooth

Portrait Electron kiosk for the German-Arab Chamber of Industry and Commerce's 75th anniversary. Uses the provided AHK artwork, era cards, fonts, animated background and anniversary frame.

Visitor-facing copy must follow the supplied references and factual operating instructions. Do not add slogans, quotes, promotional claims, or decorative copy without the user's approval.

## Git credentials protection

Local env files/backups, operator configuration, credential files, private keys, build outputs and test artifacts are ignored. Only `.env.example` is intended for Git, with credential fields left blank. `npm run check:secrets` checks tracked and untracked commit candidates against local env credentials and common token formats without printing their values. Enable the repository's staged-file pre-commit check on another checkout with `git config core.hooksPath .githooks`. This supplements `.gitignore`, which does not remove already-tracked files. Keep `package-lock.json` tracked.

## Run

Requires Node.js 22.17+ and npm. All assets are stored in `public/`; no FFmpeg or asset-generation step is required. `npm run assets` validates the required files.

`public/assets/` contains the app images, video, fonts, frame and preview samples. `public/ui/` contains the SVG controls. `public/references/` preserves the supplied screen references, generation references, font mapping and project description. These files are intended for Git; edit the app assets directly in `public/assets/`.

```powershell
git submodule update --init --recursive
npm ci
npm run assets
npm run desktop
```

`npm run dev` opens the local browser trial at http://127.0.0.1:5173. It supports live GPT Image editing and Cloudinary/QR sharing directly from the browser, following the previous photobooth's `.env.local` approach. There are no server API routes. Local automatic archiving, printer selection and silent printing run in Electron. Visitors download photos through the QR viewer; the result screen has no direct save button.

## Local browser credentials

The project-root `.env.local` is git-ignored. `.env.example` lists the supported variables. Set `VITE_OPENAI_API_KEY` to the event's OpenAI key, set `VITE_OPENAI_MODEL=gpt-image-2.5-flare`, and either set `VITE_PREVIEW_MODE=false` or disable preview mode in F2. For Nano Banana 2.1, set `VITE_GEMINI_API_KEY` and choose **Nano Banana 2.1 (Gemini)** in F2. Each provider uses its own key.

Cloudinary uses `VITE_CLOUDINARY_CLOUD_NAME`, `VITE_CLOUDINARY_API_KEY`, `VITE_CLOUDINARY_API_SECRET`, and `VITE_CLOUDINARY_FOLDER=AHK-75-Anniversary`. This project has its own folder and does not reuse another event's dashboard ID. Restart `npm run dev` after editing `.env.local`.

F2 overrides are saved in browser localStorage, like the previous project; they take priority over env defaults and survive refreshes. F2 does not edit the env file. To return to env defaults, clear this site's browser storage. Direct `VITE_*` credential access exists only in the local development trial. The production build excludes that code and env values, and runs a credential scan on its output.

Both `npm run desktop` and the portable EXE open in fullscreen kiosk mode. Set the event display to **1080 × 1920, Portrait** in Windows. The UI is designed at that exact 9:16 size and also scales proportionally for higher-resolution portrait displays. Browser previews fill the viewport with the animated background while fitting all controls inside the available area; browser chrome/window sizing does not create navy letterboxing. Tapping anywhere in the browser experience requests fullscreen and also performs the tapped control's usual action. Escape exits browser fullscreen; another tap re-enters it. Fullscreen requests are paused while F2 settings are open. F2 opens operator settings and exposes the native window controls in Electron.

## Build a Windows portable EXE

```powershell
npm run electron:build
```

Output: `release/AHK-75-Photobooth-1.0.0-Portable.exe`. The executable includes all fonts and visitor-facing assets; no installation or separate web server is needed. `npm run electron:unpacked` builds a directory version.

## Visitor flow

Start → choose era → live camera → animated 3–2–1 → captured photo and 5-second retake window → time portal → framed portrait, QR download and print. Era/camera screens reset after 60 seconds without a tap. Results reset after 90 seconds by default, paused during printing. Camera streams stop when leaving capture. Countdown and retake timers are cancelled on navigation. Failed AI requests stay on an error screen with explicit retry/new photo controls.

## Operator setup (F2)

F2 exits kiosk mode and opens settings. Five taps in the upper-right corner also open the panel. Returning from settings restores kiosk mode.

- **Preview mode:** enabled initially. It uses samples in `public/assets/demo-1.jpg` through `demo-3.jpg`, derived from `public/references/generations/Ref1.jpeg` and clearly marked as previews. It does not call OpenAI, upload samples or increment metrics. It tries the real camera first, then offers a sample camera feed if no camera is connected. Disable preview mode after configuring the OpenAI key.
- **OpenAI:** add the key in F2 settings. GPT Image 2.5 Flare is the default for new settings, optimized for faster generation; GPT Image 2 and GPT Image 1.5 remain selectable (1.5 uses high input fidelity). Existing saved model selections are preserved: choose **GPT Image 2.5 Flare** in F2 and save to switch an existing booth or browser trial. Image edits include the captured photo and an era-specific identity-preserving prompt. Requests time out after 180 seconds and are never automatically retried. `OPENAI_API_KEY` is also supported in the main-process environment. Production Electron keys are not bundled in the renderer or saved in browser storage. The separate local browser trial follows the env/localStorage workflow above.
- **Gemini / Nano Banana 2.1:** enter a Gemini API key in F2 and select **Nano Banana 2.1 (Gemini)**. Desktop also accepts `GEMINI_API_KEY`; the local browser trial accepts `VITE_GEMINI_API_KEY`. Desktop stores this key in the portable config alongside the OpenAI key. Live mode checks the key for the selected provider. Nano Banana uses Google's Interactions API with the captured photo, the shared era prompt, JPEG output, a 2:3 portrait at 1K, and minimal thinking for latency. The GPT quality selector is disabled for this model. The final framed photo remains 1200 ? 1800. Generation keeps the existing 180-second timeout, cancellation, and no automatic retries.
- **Camera:** select the physical device; choose −90°, 0°, 90° or 180° and mirrored/unmirrored. −90° is the shared skill's sideways kiosk default. The displayed canvas is exactly what is captured. Use 0° for a normal upright webcam.
- **Printers:** select two or more installed photo printers in F2, reorder them with the arrow buttons, and save. Each request checks Windows printer status and pending jobs, then sends exactly one silent job to the first ready selected printer. If all usable selected printers are busy, it queues on the first one in priority order. Missing, offline, paused and errored printers are skipped; if none are usable, the operator gets an error. If Windows status cannot be read, routing uses the first installed selected printer and logs `status-unknown`. Refresh printers in F2 to see current reported status. Existing single-printer settings are migrated automatically. Printer order is saved in the build-folder `operator-config.json`. Configure its Windows driver for 4 × 6 inch / borderless photo printing. Canon SELPHY CP1300/CP1500 and DNP DP-QW410 follow the shared printing skill. A hidden Electron window sends one silent portrait print job, with no margins. The button locks after a successful dispatch. Physical borderless coverage depends on the printer driver and must be calibrated on-site.
- **QR delivery:** configure Cloudinary cloud name, API key, secret and event folder. The final framed PNG is uploaded with a main-process SHA-1 signature, up to 3 attempts with 2/4-second backoff. QR codes link to the configurable HTTPS photo viewer with `url` and `branded=true`. Without storage configuration, photos remain available locally and for printing; no dummy QR is displayed. Failed uploads can be retried from the result screen.
- **Metrics:** optionally set the AHK event's own dashboard project UUID. Only successful live image generation reports a non-blocking metric. No other event's default UUID is reused.


## Final image

Compositing uses a **1200 × 1800 PNG (2:3)**. The generated 1024 × 1536 portrait is drawn first, then `Frame.png` is overlaid. The frame's baked first-era label is updated for the other eras. The same finished image is displayed, uploaded, saved and printed at 4 × 6 inches (300 pixels/inch).

Electron photos are archived in `Pictures/AHK-75-Photobooth`; previews go into its `Previews` subfolder. Archives are retained until the operator removes them. Browser trials keep the current portrait in memory for cloud delivery and retry. The result screen shows gentle automatic portrait parallax, an anniversary-frame sheen, a fixed QR pattern with an animated gold surround, and an auto-reset progress line. The actual composite, upload and print data remain unchanged by these display effects.

## Shared skills applied

The Git submodule at `skills/5dvr-photobooth-skills` supplies screen-flow, Electron packaging, photo printing, identity-preserving prompt crafting, QR generation, Cloudinary uploads, metrics and 3D optimization guidance. Project requirements override its Gemini-specific examples. Production Electron credentials are managed in the main process and stored in the local portable config. The local browser trial uses the previous project's env/localStorage approach. Browser and Electron generation share the same era prompts in `shared/prompts.json`. The photobooth-face-prompt-crafting skill is applied using local SSD MobileNet V1, 68-point landmarks, and age/gender weights copied from `Google-5DVR-Photobooth/public/models` into `public/models`. Models warm up on startup; the upright, mirrored capture is analyzed during the retake window. People count and confident gender estimates guide era-appropriate attire for each person; estimated children and uncertain classifications remain distinct. Browser and desktop pass the same summary to GPT and Gemini prompts. The photo takes precedence over estimates; missing models, no detections, or an 8-second analysis timeout use neutral preservation instructions without inventing a person or gender. Retakes replace the pending summary. Models are bundled and loaded locally without CDN downloads; summaries remain in memory and are not archived with settings or metrics.

The countdown/loading gyroscope is procedural Three.js geometry with non-PBR materials, steady lights, 1200 loading particles, a limited pixel ratio and a CSS fallback on WebGL failure. Era photos use restrained paper drift; reduced-motion preferences disable decorative motion.

## Validation

```powershell
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
```

End-to-end tests cover the countdown, retake cancellation, five-second auto-proceed, cancellation during loading, synthetic live camera capture, generation failure/retry, QR display, 1200 × 1800 composition, missing desktop print handling, settings and timed reset. The review screen offers only Retake; otherwise it proceeds automatically after five seconds. A production `file://` Electron integration check validates portable settings, IPC generation/delivery, local PNG archival and silent print dispatch with mocked API responses and a virtual printer. No integration test contacts paid image APIs or physical printers. Screenshots and the composed image are written to `artifacts/` for visual review.

Live API identity quality and Cloudinary/QR downloads need the event credentials. Physical printing needs the event hardware and will be tested after browser approval. Preview mode validates the experience but is not evidence of an actual AI transformation.

References: [Nano Banana 2.1](https://ai.google.dev/gemini-api/docs/models/gemini-nano-banana-2.1), [Gemini image generation](https://ai.google.dev/gemini-api/docs/image-generation), [OpenAI image edits](https://developers.openai.com/api/reference/resources/images/methods/edit), [Electron printing](https://www.electronjs.org/docs/latest/api/web-contents#contentsprintoptions-callback), [AHK Egypt](https://aegypten.ahk.de/en/).

## Prompt logs

Every live AI request logs the exact final crafted prompt in an expanded colored console group, along with the model, era, variation, timestamp, output format and local people/gender counts (or fallback status). Browser trials: open DevTools ? Console. Desktop: F2 ? **Open prompt console** ? Console; development runs also print colored logs in the terminal. Open the console before taking the photo. API keys, request headers and captured photo data are excluded. Preview mode sends no AI request and has no request prompt log.

Each era has five matched scene/outfit variations. Successful live generations cycle 1 ? 2 ? 3 ? 4 ? 5 ? 1 in both browser and desktop mode. Selecting a different era resets its sequence to variation 1; failed requests retain their variation for retry.

Printer readiness depends on the status reported by the Windows driver and spooler. Validate both event printers on-site, including busy, offline and paper-out conditions. A successful dispatch means Windows accepted the job, not that the physical print has finished. No automatic rerouting occurs after dispatch, to avoid duplicate photos.

The application icon combines the original AHK logo and gold anniversary artwork in `public/icons/`. Windows builds use the multi-size ICO; the Electron window uses the 512px PNG. Browser tabs use the SVG/ICO favicon, with PNG home-screen icons referenced by the web manifest. `npm run icons` regenerates the exports from the original assets using Chromium.



## Portable desktop configuration

Desktop credentials are stored as plain strings in the `secrets` object of `operator-config.json` beside the EXE. This is the project-authorized portable configuration format. Build commands prefill both output folders from `.env.local` and preserve existing operator changes; the operator can edit keys, camera, printers and other settings in F2. Copy the complete `win-unpacked` folder to another laptop: credentials no longer depend on the Windows user, computer or `.electron-data` profile. The original env file is not required on the destination when the config is complete. The config remains excluded from Git and credentials are never returned to the renderer or written into prompt logs. `.electron-data` holds only runtime browser data. Legacy encrypted configs are converted once using readable old keys or the local env file.


F2 offers separate **Print top padding (pixels)** and **Print bottom padding (pixels)** controls, each defaulting to 0 with a range of 0?300. They add black space around the print-only image. The full image fills the print width and compresses vertically inside the remaining height; 60 pixels is approximately 5 mm at 300 DPI. Archives, displayed portraits and QR downloads are unchanged.

`npm run electron:build` prepares a fresh config from project-root `.env.local` before packaging and bundles it as `resources/operator-defaults.json`, including inside the single-file portable EXE. Startup creates `operator-config.json` beside the EXE and fills missing keys from that bundled config; copying only the portable EXE is supported. Existing non-empty keys and operator preferences are retained. The build verifies that bundled credentials match the prepared env configuration and fails if the selected provider key is missing.
