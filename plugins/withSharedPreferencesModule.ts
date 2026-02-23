import { ConfigPlugin, withMainApplication } from '@expo/config-plugins';

const withSharedPreferencesModule: ConfigPlugin = (config) => {
  return withMainApplication(config, async (config) => {
    const contents = config.modResults.contents;

    // Add import for SharedPreferencesPackage
    if (!contents.includes('import com.safenet.app.SharedPreferencesPackage;')) {
      const importIndex = contents.lastIndexOf('import');
      const endOfLine = contents.indexOf('\n', importIndex);
      const insertIndex = contents.lastIndexOf('\n', endOfLine) + 1;
      
      const newImport = 'import com.safenet.app.SharedPreferencesPackage;\n';
      config.modResults.contents = 
        contents.substring(0, insertIndex) + 
        newImport + 
        contents.substring(insertIndex);
    }

    // Add package to getPackages() method
    if (!contents.includes('new SharedPreferencesPackage()')) {
      const packagesIndex = contents.indexOf('getPackages()');
      const arrayStart = contents.indexOf('[', packagesIndex);
      const arrayEnd = contents.indexOf(']', arrayStart);
      
      const packagesList = contents.substring(arrayStart + 1, arrayEnd).trim();
      const newPackagesList = packagesList.length > 0 
        ? packagesList + ',\n        new SharedPreferencesPackage()'
        : 'new SharedPreferencesPackage()';
      
      config.modResults.contents = 
        contents.substring(0, arrayStart + 1) + 
        '\n        ' + newPackagesList + '\n      ' + 
        contents.substring(arrayEnd);
    }

    return config;
  });
};

export default withSharedPreferencesModule;
