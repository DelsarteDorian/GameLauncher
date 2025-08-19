const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const IconExtractor = require('./icon-extractor');

class GameScanner {
  constructor() {
    this.games = [];
    this.commonGamePaths = this.getCommonGamePaths();
    this.iconExtractor = new IconExtractor();
  }

  getCommonGamePaths() {
    const paths = [];
    const homeDir = os.homedir();
    
    // Steam installation paths
    const steamPaths = [
      'C:\\Program Files (x86)\\Steam\\steamapps\\common',
      'C:\\Program Files\\Steam\\steamapps\\common',
      path.join(homeDir, 'Steam\\steamapps\\common'),
      'D:\\Steam\\steamapps\\common',
      'E:\\Steam\\steamapps\\common',
      'F:\\Steam\\steamapps\\common'
    ];

    // Epic Games Store paths
    const epicPaths = [
      'C:\\Program Files\\Epic Games',
      'C:\\Program Files (x86)\\Epic Games',
      path.join(homeDir, 'Epic Games'),
      'D:\\Epic Games',
      'E:\\Epic Games',
      'F:\\Epic Games'
    ];

    // Origin/EA launcher paths
    const originPaths = [
      'C:\\Program Files\\Origin Games',
      'C:\\Program Files (x86)\\Origin Games',
      'C:\\Program Files\\EA Games',
      'C:\\Program Files (x86)\\EA Games',
      'D:\\Origin Games',
      'E:\\Origin Games'
    ];

    // GOG Galaxy paths
    const gogPaths = [
      'C:\\GOG Games',
      'C:\\Program Files\\GOG Galaxy\\Games',
      'C:\\Program Files (x86)\\GOG Galaxy\\Games',
      'D:\\GOG Games',
      'E:\\GOG Games'
    ];

    // Generic game directories
    const genericPaths = [
      'C:\\Games',
      'D:\\Games',
      'E:\\Games',
      'F:\\Games',
      'C:\\Program Files\\Games',
      'C:\\Program Files (x86)\\Games',
      'D:\\Program Files\\Games',
      'E:\\Program Files\\Games',
      path.join(homeDir, 'Games'),
      path.join(homeDir, 'Documents\\Games'),
      path.join(homeDir, 'AppData\\Local\\Games')
    ];

    // Platform-specific paths
    const specialPaths = [
      'C:\\Riot Games',     // League of Legends
      'C:\\XboxGames'       // Xbox Game Pass
    ];

    // Combine all paths for comprehensive scanning
    const allPaths = [...steamPaths, ...epicPaths, ...originPaths, ...gogPaths, ...genericPaths, ...specialPaths];
    return allPaths;
  }

  async scanForGames() {
    this.games = [];
    console.log('🔍 Starting game scan...');
    
    try {
      // Scan common game directories
      for (const gamePath of this.commonGamePaths) {
        console.log(`📁 Checking: ${gamePath}`);
        if (fs.existsSync(gamePath)) {
          console.log(`  ✅ Directory exists, scanning...`);
          await this.scanDirectory(gamePath);
        } else {
          console.log(`  ❌ Directory not found`);
        }
      }

      console.log(`📊 Games found after directory scan: ${this.games.length}`);

      // Scan Windows registry for installed programs
      await this.scanWindowsRegistry();

      // Scan Steam library specifically
      await this.scanSteamLibrary();

      // Remove duplicates
      this.games = this.removeDuplicates(this.games);

      console.log(`✅ Scan completed: ${this.games.length} unique games found`);
      
      // Display detected games list
      if (this.games.length > 0) {
        console.log('📋 Detected games:');
        this.games.forEach((game, index) => {
          console.log(`  ${index + 1}. ${game.name} (${game.path})`);
        });
      }
      
      return this.games;
    } catch (error) {
      console.error('Error scanning games:', error);
      return this.games;
    }
  }

  async scanDirectory(dirPath, depth = 0) {
    if (depth > 3) return; // Limiter la profondeur de recherche

    try {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const fullPath = path.join(dirPath, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          // Pour Epic Games, scanner seulement les sous-dossiers de jeux
          if (dirPath.toLowerCase().includes('epic games')) {
            // Ignorer les dossiers système d'Epic
            if (item.toLowerCase().includes('launcher') || 
                item.toLowerCase().includes('portal') ||
                item.toLowerCase() === 'prereqs' ||
                item.toLowerCase() === 'tools') {
              continue;
            }
          }
          
          // Scanner les sous-dossiers
          await this.scanDirectory(fullPath, depth + 1);
        } else if (stat.isFile() && this.isGameExecutable(item, fullPath)) {
          const game = await this.createGameObject(fullPath);
          if (game && this.isValidGame(game)) {
            this.games.push(game);
          }
        }
      }
    } catch (error) {
      // Ignorer les erreurs d'accès aux dossiers
    }
  }

  isGameExecutable(filename, fullPath = '') {
    const gameExtensions = ['.exe'];
    
    const ext = path.extname(filename).toLowerCase();
    if (!gameExtensions.includes(ext)) return false;

    // Éviter SEULEMENT les fichiers système évidents
    const excludeKeywords = [
      'unins', 'setup', 'install', 'update', 'patch',
      'config', 'settings', 'crash', 'report', 'log', 'debug',
      // Services Epic Games spécifiques
      'epiconlineserviceshost', 'epiconlineservicesuihelper', 'epiconlineservicesuserhelper',
      // Services Steam évidents
      'steamservice', 'steamwebhelper', 'steamerrorhandler',
      // Services Riot/League of Legends
      'leagueclientuxrender', 'riotclientelectron', 'riotclientservices',
      'riotclientcrashhandler', 'leagueclientux', 'riot client',
      // Utilitaires spécifiques (pas "launcher" général)
      'start_protected_game', 'apexlauncher',
      // Outils système évidents
      'vcredist', 'directx', 'redist'
    ];

    const name = filename.toLowerCase();
    const pathLower = fullPath.toLowerCase();
    
    // Log pour debug
    console.log(`Vérification: ${filename} dans ${fullPath}`);
    
    // Vérifier si c'est un fichier à exclure
    if (excludeKeywords.some(keyword => name.includes(keyword))) {
      console.log(`  ❌ Exclu par mot-clé: ${name}`);
      return false;
    }

    // Exclure seulement si c'est clairement dans un dossier de services
    if (pathLower.includes('\\launcher\\') || 
        pathLower.includes('\\portal\\') ||
        pathLower.includes('\\prereqs\\') ||
        pathLower.includes('\\redist\\')) {
      console.log(`  ❌ Exclu par dossier de service: ${pathLower}`);
      return false;
    }

    // Logique spéciale pour League of Legends - garder seulement le client principal
    if (pathLower.includes('riot games\\league of legends')) {
      if (name === 'leagueclient.exe') {
        console.log(`  ✅ League of Legends client principal accepté: ${name}`);
        return true;
      } else {
        console.log(`  ❌ Service League of Legends exclu: ${name}`);
        return false;
      }
    }

    // Logique spéciale pour Riot Client - toujours exclure
    if (pathLower.includes('riot games\\riot client')) {
      console.log(`  ❌ Riot Client (pas un jeu) exclu: ${name}`);
      return false;
    }

    // Logique spéciale pour Apex Legends - garder seulement le vrai jeu
    if (pathLower.includes('apex legends')) {
      if (name === 'r5apex.exe' || name === 'r5apex_dx12.exe') {
        console.log(`  ✅ Apex Legends jeu principal accepté: ${name}`);
        return true;
      } else {
        console.log(`  ❌ Utilitaire Apex Legends exclu: ${name}`);
        return false;
      }
    }

    console.log(`  ✅ Accepté: ${name}`);
    return true;
  }

  isValidGame(game) {
    // Temporairement permissif pour diagnostic
    console.log(`Validation du jeu: ${game.name} (${game.path})`);
    
    // Vérifier que ce n'est pas dans un dossier de services évidents
    const pathLower = game.path.toLowerCase();
    const servicesFolders = [
      '\\launcher\\', '\\portal\\', '\\prereqs\\', '\\redist\\'
    ];

    if (servicesFolders.some(folder => pathLower.includes(folder))) {
      console.log(`  ❌ Rejeté: dans un dossier de service`);
      return false;
    }

    console.log(`  ✅ Validé: ${game.name}`);
    return true;
  }

  async createGameObject(executablePath) {
    try {
      const name = this.extractGameName(executablePath);
      const directory = path.dirname(executablePath);
      const tags = this.detectGameTags(directory);
      const platform = this.detectPlatform(executablePath);
      
      let icon = null;
      
      // ÉTAPE 1: Recherche d'icônes existantes (plus fiable)
      console.log(`📁 Recherche d'icônes existantes pour ${name}`);
      icon = await this.iconExtractor.findIconNearExe(executablePath);
      
      // ÉTAPE 2: Si échec, tenter extraction depuis .exe (expérimental)
      if (!icon) {
        console.log(`🎯 Tentative d'extraction depuis le .exe`);
        icon = await this.iconExtractor.extractIconFromExe(executablePath, name);
      }
      
      // ÉTAPE 3: Si échec, chercher dans les dossiers (méthode précédente)
      if (!icon) {
        console.log(`  📂 Recherche d'icône dans les dossiers`);
        icon = await this.findGameIcon(directory, name);
      }
      
      // ÉTAPE 4: Si toujours rien, pas d'icône (comme demandé par l'utilisateur - SEULEMENT les icônes des .exe)
      if (!icon) {
        console.log(`  ❌ Aucune icône trouvée pour ${name} - pas d'icône par défaut`);
      }
      
      const gameObject = {
        id: this.generateGameId(executablePath),
        name: name,
        path: executablePath,
        directory: directory,
        icon: icon,
        customIcon: null,
        lastPlayed: null,
        playTime: 0,
        isHidden: false,
        isFavorite: false,
        tags: tags,
        platform: platform,
        launchMethod: this.detectLaunchMethod(executablePath)
      };
      
      // Log final avec type d'icône
      const iconType = icon ? (
        icon.includes('temp-icons') ? 'Extraite du .exe' :
        icon.startsWith('data:image/png') ? 'PNG du .exe' :
        'Fichier trouvé'
      ) : 'Aucune';
      
      console.log(`✅ Jeu créé: ${name} | Tags: [${tags.join(', ')}] | Icône: ${iconType}`);
      return gameObject;
    } catch (error) {
      console.error('Erreur lors de la création de l\'objet jeu:', error);
      return null;
    }
  }

  extractGameName(executablePath) {
    const filename = path.basename(executablePath, '.exe');
    const parentDir = path.basename(path.dirname(executablePath));
    
    // Utiliser le nom du dossier parent si il semble plus approprié
    if (parentDir.length > filename.length && 
        !parentDir.toLowerCase().includes('bin') &&
        !parentDir.toLowerCase().includes('game')) {
      return this.cleanGameName(parentDir);
    }
    
    return this.cleanGameName(filename);
  }

  cleanGameName(name) {
    return name
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim();
  }

  async findGameIcon(directory, gameName) {
    console.log(`🔍 Recherche d'icône pour ${gameName} dans ${directory}`);
    
    const iconExtensions = ['.ico', '.png', '.jpg', '.jpeg', '.bmp', '.webp'];
    const gameNameClean = gameName.toLowerCase().replace(/[^a-z0-9]/g, '');
    const dirNameClean = path.basename(directory).toLowerCase().replace(/[^a-z0-9]/g, '');
    
    const iconNames = [
      'icon', 'game', 'logo', 'app', 'launcher',
      gameNameClean,
      dirNameClean,
      gameName.toLowerCase().replace(/\s+/g, ''),
      // Noms spéciaux pour certains jeux
      gameName.toLowerCase() === 'league of legends' ? 'leagueoflegends' : '',
      gameName.toLowerCase() === 'league of legends' ? 'lol' : ''
    ].filter(name => name.length > 0);

    // Chercher dans le dossier du jeu
    for (const name of iconNames) {
      for (const ext of iconExtensions) {
        const iconPath = path.join(directory, name + ext);
        if (fs.existsSync(iconPath)) {
          console.log(`  ✅ Icône trouvée: ${iconPath}`);
          return iconPath;
        }
      }
    }

    // Chercher des fichiers ico/png dans le dossier
    try {
      const files = fs.readdirSync(directory);
      console.log(`  📁 Fichiers dans le dossier: ${files.length}`);
      
      // Lister quelques fichiers pour debug
      console.log(`  📋 Quelques fichiers: ${files.slice(0, 5).join(', ')}${files.length > 5 ? '...' : ''}`);
      
      // Chercher des images avec des noms pertinents d'abord
      const priorityPatterns = [
        /icon/i, /logo/i, /game/i, /app/i, 
        new RegExp(gameName.replace(/[^a-z0-9]/gi, ''), 'i'),
        new RegExp(path.basename(directory).replace(/[^a-z0-9]/gi, ''), 'i')
      ];
      
      for (const pattern of priorityPatterns) {
        for (const file of files) {
          if (iconExtensions.includes(path.extname(file).toLowerCase()) && 
              pattern.test(file)) {
            const iconPath = path.join(directory, file);
            console.log(`  ✅ Icône prioritaire trouvée: ${file} → ${iconPath}`);
            return iconPath;
          }
        }
      }
      
      // Si rien trouvé, prendre n'importe quelle image
      for (const file of files) {
        if (iconExtensions.includes(path.extname(file).toLowerCase())) {
          const iconPath = path.join(directory, file);
          console.log(`  ✅ Icône générique trouvée: ${file} → ${iconPath}`);
          return iconPath;
        }
      }
      
      console.log(`  ⚠️ Aucune image trouvée parmi ${files.length} fichiers`);
    } catch (error) {
      console.log(`  ❌ Erreur lecture dossier: ${error.message}`);
    }

    // Chercher dans les sous-dossiers (pour certains jeux)
    try {
      const subDirs = ['assets', 'images', 'icons', 'resources', 'data', 'img', 'graphics', 'Game'];
      console.log(`  📂 Recherche dans sous-dossiers: ${subDirs.join(', ')}`);
      
      for (const subDir of subDirs) {
        const subPath = path.join(directory, subDir);
        if (fs.existsSync(subPath)) {
          console.log(`    ✅ Sous-dossier ${subDir} existe`);
          try {
            const subFiles = fs.readdirSync(subPath);
            console.log(`    📋 ${subFiles.length} fichiers dans ${subDir}`);
            
            // Chercher des images dans ce sous-dossier
            for (const file of subFiles) {
              if (iconExtensions.includes(path.extname(file).toLowerCase())) {
                const iconPath = path.join(subPath, file);
                console.log(`  ✅ Icône dans sous-dossier trouvée: ${file} → ${iconPath}`);
                return iconPath;
              }
            }
            
            // Chercher récursivement dans les sous-sous-dossiers (max 1 niveau)
            for (const file of subFiles) {
              const subSubPath = path.join(subPath, file);
              try {
                if (fs.statSync(subSubPath).isDirectory()) {
                  const subSubFiles = fs.readdirSync(subSubPath);
                  for (const subFile of subSubFiles) {
                    if (iconExtensions.includes(path.extname(subFile).toLowerCase())) {
                      const iconPath = path.join(subSubPath, subFile);
                      console.log(`  ✅ Icône dans sous-sous-dossier trouvée: ${subFile} → ${iconPath}`);
                      return iconPath;
                    }
                  }
                }
              } catch (e) {
                // Ignorer erreurs de sous-dossiers
              }
            }
          } catch (e) {
            console.log(`    ❌ Erreur lecture ${subDir}: ${e.message}`);
          }
        }
      }
    } catch (error) {
      console.log(`  ❌ Erreur recherche sous-dossiers: ${error.message}`);
    }

    // Recherche spéciale pour fichiers zip d'icônes
    try {
      const files = fs.readdirSync(directory);
      const zipFiles = files.filter(f => f.toLowerCase().includes('icon') && f.endsWith('.zip'));
      if (zipFiles.length > 0) {
        console.log(`  📦 Fichier ZIP d'icônes détecté: ${zipFiles[0]} (non extrait)`);
        // Note: On pourrait extraire le zip ici mais c'est complexe
      }
    } catch (error) {
      // Ignorer
    }

    console.log(`  ❌ Aucune icône trouvée pour ${gameName} - utilisation du placeholder`);
    return null;
  }

  detectGameTags(directory) {
    const tags = [];
    const dirPath = directory.toLowerCase();

    if (dirPath.includes('steam')) tags.push('Steam');
    if (dirPath.includes('epic')) tags.push('Epic Games');
    if (dirPath.includes('origin') || dirPath.includes('ea games')) tags.push('EA/Origin');
    if (dirPath.includes('gog')) tags.push('GOG');
    if (dirPath.includes('ubisoft') || dirPath.includes('uplay')) tags.push('Ubisoft');
    if (dirPath.includes('riot games')) tags.push('Riot Games');
    if (dirPath.includes('xboxgames')) tags.push('Xbox Game Pass');

    return tags;
  }

  detectPlatform(executablePath) {
    const pathLower = executablePath.toLowerCase();
    
    if (pathLower.includes('steam')) return 'steam';
    if (pathLower.includes('epic')) return 'epic';
    if (pathLower.includes('origin') || pathLower.includes('ea games')) return 'origin';
    if (pathLower.includes('gog')) return 'gog';
    if (pathLower.includes('ubisoft') || pathLower.includes('uplay')) return 'ubisoft';
    if (pathLower.includes('riot games')) return 'riot';
    if (pathLower.includes('xboxgames')) return 'xbox';
    
    return 'standalone';
  }

  detectLaunchMethod(executablePath) {
    const platform = this.detectPlatform(executablePath);
    
    switch (platform) {
      case 'steam':
        // Pour Steam, il faudrait idéalement utiliser steam://rungameid/[appid]
        // Mais pour l'instant, lancement direct
        return 'direct';
      case 'epic':
        // Epic Games nécessite généralement le launcher
        return 'epic-launcher';
      case 'origin':
        // Origin peut nécessiter le launcher
        return 'origin-launcher';
      case 'gog':
        // GOG games sont généralement DRM-free
        return 'direct';
      case 'riot':
        // Riot Games (League of Legends) se lance directement
        return 'direct';
      case 'xbox':
        // Xbox Game Pass games
        return 'direct';
      default:
        return 'direct';
    }
  }

  async scanWindowsRegistry() {
    try {
      // Scanner le registre Windows pour les programmes installés
      if (process.platform === 'win32') {
        try {
          const winreg = require('winreg');
          const regKey = new winreg({
            hive: winreg.HKLM,
            key: '\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
          });

          // Cette partie nécessiterait plus de développement
          // pour parser correctement le registre Windows
        } catch (winregError) {
          console.log('Winreg non disponible, scan du registre ignoré');
        }
      }
    } catch (error) {
      console.error('Erreur lors du scan du registre:', error);
    }
  }

  async scanSteamLibrary() {
    try {
      const steamPath = 'C:\\Program Files (x86)\\Steam';
      const configPath = path.join(steamPath, 'config', 'libraryfolders.vdf');
      
      if (fs.existsSync(configPath)) {
        // Parser le fichier VDF de Steam pour trouver les bibliothèques
        // Cette partie nécessiterait un parser VDF approprié
      }
    } catch (error) {
      console.error('Erreur lors du scan Steam:', error);
    }
  }

  generateGameId(executablePath) {
    return Buffer.from(executablePath).toString('base64').substring(0, 16);
  }

  removeDuplicates(games) {
    const seen = new Set();
    return games.filter(game => {
      const key = `${game.name}_${game.path}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
}

module.exports = {
  scanForGames: async () => {
    const scanner = new GameScanner();
    return await scanner.scanForGames();
  }
};