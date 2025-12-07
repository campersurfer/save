# iOS Share Extension Implementation Guide

Since you are working with an Expo project that has been prebuilt (`npx expo prebuild`), you can now open the project in Xcode and add the native Share Extension.

## Step 1: Open Project in Xcode
1. Open `mobile/ios/Save.xcodeproj` (or `.xcworkspace` if available) in Xcode.

## Step 2: Create Share Extension Target
1. In Xcode, go to **File > New > Target...**
2. Select **iOS** tab, search for **Share Extension**.
3. Click **Next**.
4. **Product Name**: `ShareExtension`
5. **Team**: Select your development team.
6. **Language**: Swift.
7. Click **Finish**.
8. When asked to activate the scheme, click **Activate**.

## Step 3: Configure App Groups
To share data between the Extension and the Main App, you need App Groups.

1. Select the **Save** target (main app) in the project navigator.
2. Go to **Signing & Capabilities**.
3. Click **+ Capability** and select **App Groups**.
4. Click **+** to add a new group.
5. Name it `group.com.campersurfer.save` (must match your Bundle ID prefix).
6. Repeat steps 1-5 for the **ShareExtension** target, selecting the *same* group.

## Step 4: Implement the UI
I have created a template file at `mobile/ios/ShareViewController_template.swift`.

1. In Xcode, locate the `ShareExtension` folder in the Project Navigator.
2. Open `ShareViewController.swift`.
3. Replace the entire contents of `ShareViewController.swift` with the contents of `mobile/ios/ShareViewController_template.swift`.

## Step 5: Update Info.plist
1. Open `ShareExtension/Info.plist`.
2. Ensure `NSExtensionActivationRule` is set to support URLs.
   - Expand `NSExtension` > `NSExtensionAttributes` > `NSExtensionActivationRule`.
   - Change it from `TRUEPREDICATE` (string) to a Dictionary if you want specific rules, or keep `TRUEPREDICATE` for testing (allows everything).
   - Recommended for Web URLs:
     ```xml
     <key>NSExtensionActivationRule</key>
     <dict>
         <key>NSExtensionActivationSupportsWebURLWithMaxCount</key>
         <integer>1</integer>
     </dict>
     ```

## Step 6: Run
1. Select the **ShareExtension** scheme in Xcode.
2. Click Run (Cmd+R).
3. Choose **Safari** as the app to run.
4. In Safari, navigate to a website, tap the Share button, and select "ShareExtension" (or "Save").
5. You should see the dark-themed UI we designed!
