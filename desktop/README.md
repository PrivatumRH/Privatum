# PRIVATUM Desktop Client

Cross-platform native desktop client built on **Tauri v2** for macOS, Windows, and Linux.

## Features
- **Local Shard A Security**: Encrypted at rest via native OS keystores (macOS Keychain, Windows Credential Manager, Linux Secret Service).
- **Frontier Asset Management**: Send and stealth-receive USDG and ETH on Robinhood Chain (Chain ID: 4663).
- **Passkey Recovery**: Hardware WebAuthn / Passkey enrollment.
- **Lightweight**: Native OS WebViews, no bulky Chromium runtime.

## Running Locally

```bash
cd desktop
bun install
bun run tauri dev
```

## Building

```bash
bun run tauri build
```
