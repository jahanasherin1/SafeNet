const { withMainApplication } = require('@expo/config-plugins');

/**
 * Expo plugin to register the SharedPreferencesModule with the React Native app
 * This allows the app to access Android SharedPreferences for native components
 */
const withSharedPreferencesModule = (config) => {
  return withMainApplication(config, async (config) => {
    const contents = config.modResults.contents;

    // Add import for SharedPreferencesPackage
    if (!contents.includes('import com.safenet.app.SharedPreferencesPackage;')) {
      const packageImportIndex = contents.lastIndexOf('import com.facebook');
      const endOfPackageImportLine = contents.indexOf('\n', packageImportIndex);
      
      const newImport = 'import com.safenet.app.SharedPreferencesPackage;\n';
      config.modResults.contents = 
        contents.substring(0, endOfPackageImportLine + 1) + 
        newImport + 
        contents.substring(endOfPackageImportLine + 1);
    }

    // Add package to getPackages() method
    if (!contents.includes('new SharedPreferencesPackage()')) {
      const packagesIndex = contents.indexOf('protected List<ReactPackage> getPackages()');
      const arrayStart = contents.indexOf('{', packagesIndex);
      const returnIndex = contents.indexOf('return', arrayStart);
      const arrayStartBracket = contents.indexOf('[', returnIndex);
      const arrayEndBracket = contents.indexOf(']', arrayStartBracket);
      
      const beforeArray = contents.substring(0, arrayEndBracket);
      const afterArray = contents.substring(arrayEndBracket);
      
      if (!beforeArray.includes('new SharedPreferencesPackage()')) {
        const newPackage = ',\n        new SharedPreferencesPackage()';
        config.modResults.contents = beforeArray + newPackage + afterArray;
      }
    }

    console.log('✅ SharedPreferencesModule plugin applied');
    return config;
  });
};

module.exports = withSharedPreferencesModule;
