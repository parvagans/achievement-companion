# Achievement Companion SteamOS Preview

This is an internal-only standalone SteamOS preview package for developer and tester validation.

It is **not** the Decky release ZIP, and it is **not** a final installer, AppImage, Flatpak, or app-store package.

## Requirements

- Python 3
- SteamOS Desktop Mode or another Linux environment
- a local browser

The built SteamOS frontend asset is already included in this preview package, so `node` and `npm` are not required on the Steam Deck.

## Quick Start

Run the doctor first:

```bash
./scripts/doctor-steamos.sh
```

Start the standalone shell:

```bash
./scripts/start-steamos.sh
```

Both scripts default to:

```text
.tmp-steamos-preview
```

To use a different validation root, pass it as the first argument:

```bash
./scripts/doctor-steamos.sh .tmp-steamos-deck
./scripts/start-steamos.sh .tmp-steamos-deck
```

Then open the shell URL printed in the terminal.

## Safety Notes

- do not paste API keys
- do not paste runtime tokens
- do not paste provider config or provider secrets contents
- do not paste full request URLs
- review logs and issue summaries before sharing them

The Decky release ZIP remains separate and Decky-only.
