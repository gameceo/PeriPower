# PeriPower MVP

Fork base: JKWTCN/BatteryMonitor 50f628c1ae1ced004e9fa03737cee9d6a561d80e.

## Scope

Windows desktop application + optional always-on-top desktop panel + Elgato Stream Deck keypad action.
Keep the original capture providers. Add a separate HeadsetControl process adapter for one Logitech PRO X 2
LIGHTSPEED receiver (046d:0af7). No sidetone, EQ, driver, lighting or power settings are changed.

Priority devices: Razer DeathAdder V4 Pro (1532:00bf), Logitech MX Master 3S via Bluetooth,
Logitech PRO X 2 LIGHTSPEED. Other upstream device adapters remain available but unverified locally.

## Local evidence (2026-11-10)

- Razer one-shot feature-report query: raw 143, 56%, charging false.
- HeadsetControl official 4.2.0: headset initially unavailable; after user powered it on,
  BATTERY_AVAILABLE, 32%. This validates the helper path, not the complete native application.
- MX Master 3S: first live GATT query returned disconnected/unreachable; awaiting a connected retest.
- Node 24.11.1; installed Stream Deck executable 7.6.0.23012.
- Native cloud build: MSVC 19.44, Qt 6.8.3, Windows SDK 10.0.26100.0 compiled successfully;
  rpc_model CTest passed. First packaging attempt failed because Qt requires an absolute install prefix;
  workflow now uses an absolute path. Packaging retest pending.
- Local C++ build not yet run: Qt/MSVC/SDK unavailable; automatic approval blocked the
  official Build Tools installer invocation even after user permission.

## Build

Use VS2022 recent MSVC x64, Windows SDK cppwinrt, CMake >=3.25, Qt >=6.5 MSVC x64
(Core, Widgets, Network, WebSockets, Sql, LinguistTools, Test). C++20 and C11 are required.

```powershell
./scripts/fetch-headsetcontrol.ps1
cmake -S . -B build -G "Visual Studio 17 2022" -A x64 -DCMAKE_PREFIX_PATH=C:/Qt/6.8.3/msvc2022_64
cmake --build build --config Release --parallel
$env:PATH = "C:/Qt/6.8.3/msvc2022_64/bin;$env:PATH"
ctest --test-dir build -C Release --output-on-failure
cmake --install build --config Release --prefix "$PWD/dist"
./dist/bin/PeriPower.exe --websocket_server --port 19211
```

Executable output is build/bin/Release/PeriPower.exe for the VS multi-config generator.
The internal CMake target remains BatteryMonitor for upstream merge compatibility.
The helper is downloaded with a pinned executable checksum, its license and corresponding release source.
It remains a separate executable, not statically or dynamically linked GPL source in the MIT application.

```powershell
cd integrations/streamdeck
npm ci
npm run build
npm test
npm run validate
npm run pack
```

Double-click the generated .streamDeckPlugin package to install. Open PeriPower, enable the local
WebSocket service and select a device in the action property inspector. The port and optional token
are plugin-wide; device/channel/threshold are per key. Token is stored in Stream Deck global settings,
never added to the server URL or diagnostic logs. One local connection serves all visible keys.
Pressing a key requests an asynchronous refresh, coalesced to at most one request per 1.5 seconds.
The client handles immediate notifications before subscribe replies and resubscribes after reconnect.
A 15-second snapshot read also catches unchanged readings, lastSeen changes and aliases.

Desktop panel: use the main window's “桌面电量面板” menu action. Position, visible state and selected
IDs persist in PeriPower's own settings. Empty selection means show all. Close hides the panel.
The original application's settings, autostart name, mutex and history directory are not migrated.

## API differences

- getInfo.name is PeriPower; startedAt/uptime begin when the RPC object is constructed.
- getInfo.providers contains the actual registered provider names; capabilities remains the legacy list.
- settings.app.get/set return rpc.tokenConfigured instead of echoing rpc.token. Writing a token remains supported.
- Alias changes participate in the RPC signature and cause current snapshots to be republished.
- refresh.completed remains upstream's per-publication event, not an all-provider completion barrier.
  refresh.now(wait=true) is not a freshness guarantee. The plugin does not use either for freshness.
- Original upstream JS-plugin updater is retained intentionally. It downloads upstream master plugins;
  it is not a PeriPower application updater and does not update the headset helper.

## Acceptance still requiring real hardware

- Native packaged runtime on this PC; complete desktop panel -> RPC -> physical Stream Deck flow.
- Razer charge cable, sleep/wake, receiver unplug/replug, Synapse coexistence.
- PRO X 2 on/off, charging, G HUB coexistence, long-run trend and repeated reconnects.
- MX Master 3S current Bluetooth battery service and mouse sleep/wake.
- Multiple keys/channel settings; missing device binding must never select another same-name device.
- Eight-hour soak, resume from system sleep and restart recovery.

Unknown is not 0%. Discrete levels are not precise percentages. Cached device values are marked cached;
backend disconnection is shown separately. Hardware broadcast and polling latency is distinct from UI latency.

## Licensing

Retain upstream MIT and quickjs-ng notices. external/hidapi uses the selected BSD license, included in
THIRD_PARTY_NOTICES.md. Qt dynamically linked deployment needs its applicable license notices.
HeadsetControl has its own GPL license/source distributed alongside its executable, with no protocol
implementation copied into the MIT sources. npm license metadata remains in package-lock dependencies;
the packaged plugin contains bundled JS and should retain generated source license comments.
