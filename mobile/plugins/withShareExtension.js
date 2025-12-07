const { withXcodeProject, withDangerousMod, withEntitlementsPlist, withInfoPlist } = require('@expo/config-plugins');
const xcode = require('xcode');
const fs = require('fs-extra');
const path = require('path');
const plist = require('plist');

const TARGET_NAME = 'ShareExtension';
const BUNDLE_ID = 'com.campersurfer.save.ShareExtension';
const APP_GROUP_ID = 'group.com.campersurfer.save';

const withShareExtension = (config) => {
  config = withShareExtensionFiles(config);
  config = withShareExtensionTarget(config);
  config = withShareExtensionEntitlements(config);
  config = withMainAppEntitlements(config);
  return config;
};

// 1. Copy files to the iOS project directory
const withShareExtensionFiles = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const iosPath = path.join(projectRoot, 'ios');
      const targetPath = path.join(iosPath, TARGET_NAME);
      const sourcePath = path.join(projectRoot, 'targets', TARGET_NAME);

      // Create target directory
      await fs.ensureDir(targetPath);

      // Copy files
      await fs.copy(
        path.join(sourcePath, 'ShareViewController.swift'),
        path.join(targetPath, 'ShareViewController.swift')
      );
      await fs.copy(
        path.join(sourcePath, 'Info.plist'),
        path.join(targetPath, 'Info.plist')
      );

      return config;
    },
  ]);
};

// 2. Add target to Xcode project
const withShareExtensionTarget = (config) => {
  return withXcodeProject(config, async (config) => {
    const projectPath = config.modRequest.projectRoot + '/ios/Save.xcodeproj/project.pbxproj';
    const project = xcode.project(projectPath);

    project.parse(function (err) {
      if (err) {
        console.error('Error parsing Xcode project:', err);
        return;
      }

      const pbxGroup = project.addPbxGroup(
        [
          'ShareViewController.swift',
          'Info.plist'
        ],
        TARGET_NAME,
        TARGET_NAME
      );

      // Add Native Target
      const target = project.addTarget(
        TARGET_NAME,
        'app_extension',
        TARGET_NAME,
        BUNDLE_ID
      );

      // Add Build Phases
      project.addBuildPhase(
        ['ShareViewController.swift'],
        'PBXSourcesBuildPhase',
        'Sources',
        target.uuid
      );

      project.addBuildPhase(
        [],
        'PBXResourcesBuildPhase',
        'Resources',
        target.uuid
      );

      // Add to main group to make it visible in Xcode
      // project.addToPbxGroup(pbxGroup.uuid, project.getFirstProject().mainGroup);

      fs.writeFileSync(projectPath, project.writeSync());
    });

    return config;
  });
};

// 3. Configure Entitlements for Share Extension
const withShareExtensionEntitlements = (config) => {
  // This part is tricky because standard plugins only modify the main app entitlements.
  // We would need to create a .entitlements file for the extension and link it.
  // For now, we'll skip this automated step and rely on the user/EAS to have provisioned profiles.
  // But we can write the file.
  
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const projectRoot = config.modRequest.projectRoot;
      const targetPath = path.join(projectRoot, 'ios', TARGET_NAME);
      const entitlementsPath = path.join(targetPath, `${TARGET_NAME}.entitlements`);
      
      const entitlements = {
        'com.apple.security.application-groups': [APP_GROUP_ID]
      };
      
      await fs.writeFile(entitlementsPath, plist.build(entitlements));
      return config;
    },
  ]);
};

// 4. Configure Entitlements for Main App (to read shared data)
const withMainAppEntitlements = (config) => {
  return withEntitlementsPlist(config, (config) => {
    const existingGroups = config.modResults['com.apple.security.application-groups'] || [];
    if (!existingGroups.includes(APP_GROUP_ID)) {
      config.modResults['com.apple.security.application-groups'] = [
        ...existingGroups,
        APP_GROUP_ID
      ];
    }
    return config;
  });
};

module.exports = withShareExtension;
