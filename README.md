# LPL505: Launchpadless 505

LPL505 is a small but powerful desktop application built to fully unlock and control the Boss RC-505mk2 loop station via USB MIDI. 

It can be used to replicate the [infinite fx changes technique](https://www.youtube.com/watch?v=-gfB4Krj22I) without the need of a Novation Launchpad Pro MK3.

YT Tutorial on how to set it up and use it. (WIP)

## Features

- **Customisable Workspace:** Build an unlimited array of trigger buttons and faders on a free-form, scalable UI canvas.
- **RC-505mk2-Specific design:** Buttons for the Infinite FX changes technique, general MIDI messages, or [MIDI program changes](https://www.youtube.com/watch?v=67y-oijQv1A)
- **Save & Load Templates:** Share templates with your friends and load them up whenever you want.
- **Responsive & Smart UI:**
  - Fully resizable window with intelligent coordinate scaling.
  - A smooth **Grid Lock** system with instant "Snap-All" capability.
  - Rubber-band multi-select and group dragging.
- **Aesthetic Customization:** 
  - Complete "Dark mode" & "Light mode"
  - Custom user-imported background images.
  - Native OS Color Pickers for every widget, combined with a "Glow Intensity" shader system for live visual trigger feedback.
- **MIDI Clock Quantization:** Sequence your macros! Delay a trigger impact until the "Next Beat" or "Next Bar", or quantize to stay perfectly in time with the mk2's internal clock.

## Installation

### 1. Download the App
You can download the installers from the **[Releases](https://github.com/JMakesMusic/Launchpadless505/releases)** page. Under the "Assets" section, pick the correct file for your computer:

| Device | File to Download |
| :--- | :--- |
| **Windows PC** | `LPL505_x64-setup.exe` (Recommended) or `.msi` |
| **Mac (M1 / M2 / M3)** | `LPL505_aarch64.dmg` |
| **Mac (Intel / Older)** | `LPL505_x64.dmg` |
| **Linux (Ubuntu / Debian)** | `LPL505_amd64.deb` |
| **Linux (Fedora / RedHat)** | `LPL505_x86_64.rpm` |
| **Linux (General)** | `LPL505_amd64.AppImage` |

> [!TIP]
> **Mac Users:** You may need to right-click the app and select **"Open"** the very first time you run it to bypass the security warning.

### 2. Install MK2 Presets (Required)
This app works specifically with a Boss RC-505mk2 connected via USB. You **must** install the provided `.RC0` memory files to your loop station for the app markers to function correctly.

1. Connect your RC-505mk2 to your computer in **Storage Mode**.
2. Navigate to the `ROLAND/DATA` folder on the RC-505mk2 drive.
3. Copy the 2 memory files from the **[resources/boss-rc505mk2-presets](./resources/boss-rc505mk2-presets)** folder of this repository into your machine.

## Building From Source

LPL505 was built with React, TypeScript, and **[Tauri v2](https://v2.tauri.app/)** with a Rust backend.

### Prerequisites
- Node.js (v20+)
- Rust (`rustup` toolchain)
- macOS: Xcode / Command Line Tools
- Windows: Visual Studio C++ Build Tools

### Development Setup
```bash
git clone https://github.com/JMakesMusic/Launchpadless505.git
cd Launchpadless505

# Install JS dependencies
npm install

# Run application in development mode
npm run tauri dev

# Compile final production executable
npm run tauri build
```

## Credits

Developed by [@jmakesmusicx](https://www.youtube.com/@JMakesMusicx).
If you found this software useful for your looping performances, consider tossing a tip to my **[Ko-fi page](https://ko-fi.com/jmakesmusicx)**!
