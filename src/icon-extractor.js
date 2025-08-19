const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const execAsync = promisify(exec);

class IconExtractor {
  constructor() {
    this.iconCache = new Map();
    this.tempIconsDir = path.join(__dirname, '..', 'temp-icons');
    this.ensureTempDir();
  }

  ensureTempDir() {
    if (!fs.existsSync(this.tempIconsDir)) {
      fs.mkdirSync(this.tempIconsDir, { recursive: true });
    }
  }

  async extractIconFromExe(exePath, gameName) {
    try {
      console.log(`🔍 Extraction d'icône depuis ${path.basename(exePath)}`);
      
      // Vérifier le cache
      const cacheKey = exePath;
      if (this.iconCache.has(cacheKey)) {
        console.log(`  📦 Icône trouvée en cache`);
        return this.iconCache.get(cacheKey);
      }

      // Vérifier que le fichier existe
      if (!fs.existsSync(exePath)) {
        console.log(`  ❌ Fichier .exe n'existe pas: ${exePath}`);
        return null;
      }

      // Méthode 1: Via nativeImage d'Electron (priorité - plus fiable)
      if (this.isElectronContext()) {
        console.log(`  ⚡ Tentative Electron nativeImage...`);
        const electronIcon = await this.extractWithElectron(exePath, gameName);
        if (electronIcon) {
          this.iconCache.set(cacheKey, electronIcon);
          return electronIcon;
        }
      } else {
        console.log(`  ⚠️ Contexte Node.js détecté, Electron nativeImage non disponible`);
      }

      // Méthode 2: Via PowerShell (fallback)
      console.log(`  🔧 Tentative PowerShell...`);
      const iconPath = await this.extractWithPowerShell(exePath, gameName);
      if (iconPath) {
        this.iconCache.set(cacheKey, iconPath);
        return iconPath;
      }

      console.log(`  ❌ Impossible d'extraire l'icône de ${path.basename(exePath)}`);
      return null;

    } catch (error) {
      console.error(`  ❌ Erreur extraction icône:`, error.message);
      return null;
    }
  }

  isElectronContext() {
    // Vérifier si on est dans Electron (processus principal ou renderer)
    try {
      if (typeof process !== 'undefined' && 
          process.versions && 
          process.versions.electron) {
        return true;
      }
      
      // Vérifier si on peut accéder aux modules Electron
      try {
        const { nativeImage } = require('electron');
        return nativeImage !== undefined;
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }

  async extractWithPowerShell(exePath, gameName) {
    try {
      const cleanGameName = gameName.replace(/[^a-z0-9]/gi, '_');
      const outputPath = path.join(this.tempIconsDir, `${cleanGameName}.png`);
      
      // Nettoyer le fichier s'il existe déjà
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      
      // Échapper les chemins pour PowerShell
      const escapedExePath = exePath.replace(/'/g, "''").replace(/"/g, '""');
      const escapedOutputPath = outputPath.replace(/'/g, "''").replace(/"/g, '""');
      
      // Script PowerShell corrigé (sans émojis qui causent des problèmes d'encodage)
      const psScript = `
Add-Type -AssemblyName System.Drawing
try {
    $icon = [System.Drawing.Icon]::ExtractAssociatedIcon("${escapedExePath}")
    if ($icon -eq $null) {
        Write-Output "ERROR: Impossible d'extraire l'icone"
        exit 1
    }
    
    $bitmap = $icon.ToBitmap()
    $bitmap.Save("${escapedOutputPath}", [System.Drawing.Imaging.ImageFormat]::Png)
    
    $bitmap.Dispose()
    $icon.Dispose()
    
    if (Test-Path "${escapedOutputPath}") {
        $size = (Get-Item "${escapedOutputPath}").Length
        Write-Output "SUCCESS: Icone extraite $($icon.Width)x$($icon.Height), $size bytes"
    } else {
        Write-Output "ERROR: Fichier PNG non cree"
    }
} catch {
    Write-Output "ERROR: $($_.Exception.Message)"
}
      `.trim();

      console.log(`    📝 Exécution PowerShell pour ${path.basename(exePath)}...`);

      const { stdout, stderr } = await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -Command "${psScript}"`, {
        timeout: 15000,
        windowsHide: true
      });

      console.log(`    📋 PowerShell stdout: ${stdout.trim()}`);
      
      if (stderr && stderr.trim()) {
        console.log(`    ⚠️ PowerShell stderr: ${stderr.trim()}`);
      }

      if (stdout.includes('SUCCESS:') && fs.existsSync(outputPath)) {
        const fileSize = fs.statSync(outputPath).size;
        console.log(`    ✅ Icône PowerShell créée: ${path.basename(outputPath)} (${fileSize} bytes)`);
        return outputPath;
      }

      console.log(`    ❌ PowerShell n'a pas créé le fichier d'icône`);
      return null;
      
    } catch (error) {
      console.log(`    ❌ PowerShell erreur: ${error.message}`);
      return null;
    }
  }

  async extractWithElectron(exePath, gameName) {
    try {
      const { nativeImage, shell } = require('electron');
      const cleanGameName = gameName.replace(/[^a-z0-9]/gi, '_');
      const outputPath = path.join(this.tempIconsDir, `${cleanGameName}.png`);
      
      console.log(`    📝 Electron: Extraction depuis ${path.basename(exePath)}...`);
      
      // Nettoyer le fichier s'il existe déjà
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
      
      // Méthode 1: Utiliser getFileIcon (Windows spécifique)
      try {
        if (process.platform === 'win32') {
          const { app } = require('electron');
          
          // Obtenir l'icône du fichier via l'API Windows
          const icon = await app.getFileIcon(exePath, { size: 'large' });
          if (!icon.isEmpty()) {
            const pngBuffer = icon.toPNG();
            fs.writeFileSync(outputPath, pngBuffer);
            
            if (fs.existsSync(outputPath)) {
              const fileSize = fs.statSync(outputPath).size;
              console.log(`    ✅ Icône Electron extraite: ${path.basename(outputPath)} (${fileSize} bytes)`);
              return outputPath;
            }
          }
        }
      } catch (error) {
        console.log(`    ⚠️ getFileIcon échec: ${error.message}`);
      }
      
      // Méthode 2: createFromPath (fallback)
      try {
        const icon = nativeImage.createFromPath(exePath);
        if (!icon.isEmpty()) {
          const pngBuffer = icon.toPNG();
          fs.writeFileSync(outputPath, pngBuffer);
          
          if (fs.existsSync(outputPath)) {
            const fileSize = fs.statSync(outputPath).size;
            console.log(`    ✅ Icône Electron (createFromPath): ${path.basename(outputPath)} (${fileSize} bytes)`);
            return outputPath;
          }
        }
      } catch (error) {
        console.log(`    ⚠️ createFromPath échec: ${error.message}`);
      }
      
      console.log(`    ❌ Electron: Impossible d'extraire l'icône de ${path.basename(exePath)}`);
      return null;
      
    } catch (error) {
      console.log(`    ❌ Erreur Electron: ${error.message}`);
      return null;
    }
  }

  // Méthode alternative : chercher fichier .ico à côté de l'exe
  async findIconNearExe(exePath) {
    try {
      const dir = path.dirname(exePath);
      const baseName = path.basename(exePath, '.exe');
      const iconExtensions = ['.ico', '.png', '.jpg', '.jpeg', '.bmp'];
      
      console.log(`    📁 Recherche d'icônes dans ${path.basename(dir)}/`);
      
      // Chercher des fichiers icônes avec différents noms
      const possibleNames = [
        baseName,                    // Même nom que l'exe
        baseName.toLowerCase(),      // Version minuscule
        'icon', 'app', 'game',      // Noms génériques
        'logo', 'launcher'          // Noms alternatifs
      ];
      
      // Tester toutes les combinaisons nom + extension
      for (const name of possibleNames) {
        for (const ext of iconExtensions) {
          const iconPath = path.join(dir, name + ext);
          if (fs.existsSync(iconPath)) {
            console.log(`    ✅ Icône trouvée: ${name}${ext}`);
            return iconPath;
          }
        }
      }
      
      // Recherche dans tous les fichiers du dossier
      try {
        const files = fs.readdirSync(dir);
        const iconFiles = files.filter(file => 
          iconExtensions.includes(path.extname(file).toLowerCase())
        );
        
        if (iconFiles.length > 0) {
          const firstIcon = path.join(dir, iconFiles[0]);
          console.log(`    ✅ Première icône trouvée: ${iconFiles[0]}`);
          return firstIcon;
        }
      } catch (error) {
        // Ignorer erreurs de lecture dossier
      }

      console.log(`    ❌ Aucune icône trouvée dans ${path.basename(dir)}/`);
      return null;
    } catch (error) {
      console.log(`    ❌ Erreur recherche icônes: ${error.message}`);
      return null;
    }
  }

  // Nettoyer le cache et les fichiers temporaires
  cleanup() {
    try {
      if (fs.existsSync(this.tempIconsDir)) {
        const files = fs.readdirSync(this.tempIconsDir);
        files.forEach(file => {
          fs.unlinkSync(path.join(this.tempIconsDir, file));
        });
      }
    } catch (error) {
      console.log('⚠️ Erreur nettoyage cache icônes:', error.message);
    }
  }
}

module.exports = IconExtractor;