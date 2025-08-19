const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class SettingsManager {
  constructor() {
    this.settingsPath = path.join(app.getPath('userData'), 'settings.json');
    this.defaultSettings = {
      customGamePaths: [],
      scanDepth: 3,
      autoScan: true,
      showHiddenGames: false,
      iconQuality: 'high',
      language: 'en'
    };
    this.settings = this.loadSettings();
  }

  loadSettings() {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const data = fs.readFileSync(this.settingsPath, 'utf8');
        return { ...this.defaultSettings, ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
    return { ...this.defaultSettings };
  }

  saveSettings() {
    try {
      const dir = path.dirname(this.settingsPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(this.settingsPath, JSON.stringify(this.settings, null, 2));
      return true;
    } catch (error) {
      console.error('Error saving settings:', error);
      return false;
    }
  }

  getCustomGamePaths() {
    return this.settings.customGamePaths || [];
  }

  addCustomGamePath(customPath) {
    if (!this.settings.customGamePaths.includes(customPath)) {
      this.settings.customGamePaths.push(customPath);
      this.saveSettings();
      return true;
    }
    return false;
  }

  removeCustomGamePath(customPath) {
    const index = this.settings.customGamePaths.indexOf(customPath);
    if (index > -1) {
      this.settings.customGamePaths.splice(index, 1);
      this.saveSettings();
      return true;
    }
    return false;
  }

  getAllGamePaths() {
    return this.settings.customGamePaths;
  }

  updateSetting(key, value) {
    if (this.settings.hasOwnProperty(key)) {
      this.settings[key] = value;
      this.saveSettings();
      return true;
    }
    return false;
  }

  getSetting(key) {
    return this.settings[key];
  }

  resetToDefaults() {
    this.settings = { ...this.defaultSettings };
    this.saveSettings();
    return true;
  }
}

module.exports = SettingsManager; 