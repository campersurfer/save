# Expo Config Plugins

This directory contains custom Config Plugins to automate native project configuration.

## withShareExtension.js
**Status: Planned**

This plugin will:
1. Automate the creation of the "ShareExtension" target in the Xcode project.
2. Link the `ShareViewController.swift` and `Info.plist` from `mobile/targets/ShareExtension`.
3. Configure App Groups (`group.com.campersurfer.save`) for both the main app and the extension.

## Usage
Once implemented, add to `app.json`:
```json
"plugins": [
  "./plugins/withShareExtension"
]
```

This allows building the app with the Share Extension using `eas build -p ios` without needing to open Xcode manually.
