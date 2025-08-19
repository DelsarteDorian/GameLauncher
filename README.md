# Multi Game Launcher

A modern and elegant game launcher that automatically scans your PC to find and organize all your installed games in an intuitive interface.

[![GitHub](https://img.shields.io/badge/GitHub-Repository-blue?logo=github)](https://github.com/DelsarteDorian/GameLauncher)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Electron](https://img.shields.io/badge/Built%20with-Electron-47848f?logo=electron)](https://www.electronjs.org/)

## 🎮 Features

### Automatic Scanner
- **Multi-Platform Detection**: Automatically finds games from Steam, Epic Games, Origin/EA, GOG and more
- **Smart Scanning**: Searches common directories and standard installation locations
- **Icon Extraction**: Automatically extracts game icons from executable files

### Modern Interface
- **Grid & List View**: Switch between a modern grid view and detailed list view
- **Responsive Design**: Adaptive interface with elegant dark theme
- **Quick Search**: Instantly find your games with the search bar
- **Advanced Filters**: Filter by platform, favorites, recently played games

### Customization
- **Custom Images**: Replace game icons with your own images
- **Favorites System**: Mark your favorite games for quick access
- **Automatic Tags**: Automatic organization by platform of origin
- **Game History**: Track recently played games

### Quick Launch
- **Direct Launch**: Start your games with a single click
- **Shortcut Management**: Support for executables and links
- **System Integration**: Works with all types of games

## 🚀 Installation

### Prerequisites
- Windows 10/11
- Node.js (version 16 or higher)
- npm or yarn

### Installation Steps

1. **Clone the repository**
   ```bash
   git clone https://github.com/DelsarteDorian/GameLauncher.git
   cd GameLauncher
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Run in development mode**
   ```bash
   npm start
   ```

4. **Build the application**
   ```bash
   npm run build
   ```

5. **Create installer**
   ```bash
   npm run dist
   ```

## 📖 Usage

### First Launch
1. **Initial Scan**: Click "Scan" to detect all your games
2. **Automatic Discovery**: The application searches standard installation locations
3. **Configuration**: Customize names and icons according to your preferences

### Navigation
- **Single Click**: Launch the game
- **Right Click**: Open game options
- **Star**: Add/remove favorites
- **Gear**: Game settings

### Search and Filters
- **Search Bar**: Type to filter in real-time
- **Quick Filters**: All, Recent, Favorites
- **Platform Filters**: Steam, Epic, Origin, GOG
- **Sorting**: By name, date, playtime

### Customization
1. **Change Image**: Right click → Settings → Change image
2. **Rename**: Modify display name
3. **Favorites**: Click the star to mark as favorite

## 🛠️ Technical Configuration

### File Structure
```
GameLauncher/
├── main.js                 # Electron main process
├── index.html              # User interface
├── styles.css              # Styles and theme
├── renderer.js             # Frontend logic
├── src/
│   ├── game-scanner.js     # Game detection engine
│   └── icon-extractor.js   # Icon extraction utility
├── assets/                 # Icons and resources
└── package.json            # Project configuration
```

### Scan Locations
The application automatically searches in:

**Steam**
- `C:\Program Files (x86)\Steam\steamapps\common`
- `C:\Program Files\Steam\steamapps\common`
- `%USERPROFILE%\Steam\steamapps\common`

**Epic Games**
- `C:\Program Files\Epic Games`
- `C:\Program Files (x86)\Epic Games`

**Origin/EA**
- `C:\Program Files\Origin Games`
- `C:\Program Files\EA Games`

**GOG**
- `C:\GOG Games`
- `C:\Program Files\GOG Galaxy\Games`

**Generic Locations**
- `C:\Games`
- `D:\Games`
- `E:\Games`

### Data Storage
- **Configuration**: `%APPDATA%\multi-game-launcher\games.json`
- **Custom Images**: Referenced by absolute path
- **Settings**: Automatically saved

## 🎨 Advanced Customization

### Themes
The design uses CSS variables for easy customization:
```css
--primary-color: #00d4ff;
--background-gradient: linear-gradient(135deg, #0c0c0c 0%, #1a1a1a 100%);
--card-background: rgba(255, 255, 255, 0.05);
```

### Custom Filters
Add new filters by modifying `renderer.js`:
```javascript
// Example custom filter
case 'indie':
    return game.tags.includes('Indie') || game.directory.includes('indie');
```

## 🐛 Troubleshooting

### Common Issues

**Games not detected**
- Verify games are installed in standard locations
- Use custom paths if necessary
- Re-run scan after installing new games

**Missing icons**
- Manually add custom images
- Check that icon files exist
- Use supported formats (PNG, JPG, ICO)

**Game won't launch**
- Verify the executable still exists
- Check access permissions
- Try launching from Windows Explorer

### Debug Logs
Enable logs in development mode:
```bash
npm run dev
```

## 🤝 Contributing

Contributions are welcome! To contribute:

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is under the MIT license. See the `LICENSE` file for more details.

## 🙏 Acknowledgments

- Electron for the desktop application framework
- Font Awesome for the icons
- The gaming community for the inspiration

---

**Developed with ❤️ for gamers by gamers**