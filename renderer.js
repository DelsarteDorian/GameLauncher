const { ipcRenderer } = require('electron');

class GameLauncher {
    constructor() {
        this.games = [];
        this.filteredGames = [];
        this.currentView = 'grid';
        this.currentFilter = 'all';
        this.currentSort = 'name';
        this.searchQuery = '';
        this.selectedGame = null;
        
        this.initializeEventListeners();
        this.loadSavedGames();
    }

    initializeEventListeners() {
        // Boutons de scan
        document.getElementById('scanBtn').addEventListener('click', () => this.scanForGames());
        document.getElementById('startScanBtn').addEventListener('click', () => this.scanForGames());

        // Recherche
        const searchInput = document.getElementById('searchInput');
        searchInput.addEventListener('input', (e) => this.handleSearch(e.target.value));
        
        document.getElementById('clearSearch').addEventListener('click', () => {
            searchInput.value = '';
            this.handleSearch('');
        });

        // Contrôles de vue
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentView = e.target.dataset.view;
                this.renderGames();
            });
        });

        // Filtres
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.applyFilters();
            });
        });

        // Tri
        document.getElementById('sortSelect').addEventListener('change', (e) => {
            this.currentSort = e.target.value;
            this.sortGames();
        });

        // Modal
        document.getElementById('modalClose').addEventListener('click', () => this.closeModal());
        document.getElementById('modalCancel').addEventListener('click', () => this.closeModal());
        document.getElementById('modalSave').addEventListener('click', () => this.saveGameChanges());
        document.getElementById('changeImageBtn').addEventListener('click', () => this.changeGameImage());
        document.getElementById('resetImageBtn').addEventListener('click', () => this.resetGameImage());

        // Fermer la modal en cliquant à l'extérieur
        document.getElementById('gameModal').addEventListener('click', (e) => {
            if (e.target.id === 'gameModal') {
                this.closeModal();
            }
        });

        // Contrôles de fenêtre
        document.querySelector('.control-btn.minimize').addEventListener('click', () => {
            ipcRenderer.send('window-minimize');
        });

        document.querySelector('.control-btn.maximize').addEventListener('click', () => {
            ipcRenderer.send('window-maximize');
        });

        document.querySelector('.control-btn.close').addEventListener('click', () => {
            ipcRenderer.send('window-close');
        });
    }

    async loadSavedGames() {
        try {
            const savedGames = await ipcRenderer.invoke('load-game-data');
            if (savedGames && savedGames.length > 0) {
                this.games = savedGames;
                this.applyFilters();
                this.updateStats();
                this.hideLoadingState();
            } else {
                this.showEmptyState();
            }
        } catch (error) {
            console.error('Erreur lors du chargement des jeux sauvegardés:', error);
            this.showEmptyState();
        }
    }

    async scanForGames() {
        this.showLoadingOverlay('Recherche des jeux en cours...');
        
        try {
            const foundGames = await ipcRenderer.invoke('scan-games');
            console.log('Jeux trouvés:', foundGames.length, foundGames);
            
            // Fusionner avec les jeux existants
            const existingGames = new Map(this.games.map(game => [game.id, game]));
            
            foundGames.forEach(newGame => {
                const existingGame = existingGames.get(newGame.id);
                if (existingGame) {
                    // Conserver les données personnalisées
                    newGame.customIcon = existingGame.customIcon;
                    newGame.lastPlayed = existingGame.lastPlayed;
                    newGame.playTime = existingGame.playTime;
                    newGame.isHidden = existingGame.isHidden;
                    newGame.isFavorite = existingGame.isFavorite;
                }
            });

            this.games = foundGames;
            console.log('Jeux après fusion:', this.games.length);
            
            await this.saveGamesData();
            this.applyFilters();
            this.updateStats();
            this.hideLoadingOverlay();
            
            if (this.games.length === 0) {
                this.showEmptyState();
            } else {
                this.hideLoadingState();
                this.renderGames(); // Force le rendu
            }
            
        } catch (error) {
            console.error('Erreur lors du scan des jeux:', error);
            this.hideLoadingOverlay();
            this.showError('Erreur lors de la recherche des jeux');
        }
    }

    applyFilters() {
        console.log('Application des filtres sur', this.games.length, 'jeux');
        console.log('Filtre actuel:', this.currentFilter, 'Recherche:', this.searchQuery);
        
        this.filteredGames = this.games.filter(game => {
            // Filtre de recherche
            if (this.searchQuery && !game.name.toLowerCase().includes(this.searchQuery.toLowerCase())) {
                return false;
            }

            // Filtre par catégorie
            switch (this.currentFilter) {
                case 'recent':
                    return game.lastPlayed !== null;
                case 'favorites':
                    return game.isFavorite === true;
                case 'steam':
                    return game.tags && game.tags.includes('Steam');
                case 'epic':
                    return game.tags && game.tags.includes('Epic Games');
                case 'riot':
                    return game.tags && game.tags.includes('Riot Games');
                case 'xbox':
                    return game.tags && game.tags.includes('Xbox Game Pass');
                case 'origin':
                    return game.tags && game.tags.includes('EA/Origin');
                case 'gog':
                    return game.tags && game.tags.includes('GOG');
                case 'all':
                default:
                    return !game.isHidden; // Afficher tous les jeux non cachés
            }
        });

        console.log('Jeux après filtrage:', this.filteredGames.length);
        this.sortGames();
    }

    sortGames() {
        this.filteredGames.sort((a, b) => {
            switch (this.currentSort) {
                case 'name':
                    return a.name.localeCompare(b.name);
                case 'name-desc':
                    return b.name.localeCompare(a.name);
                case 'recent':
                    return new Date(b.lastPlayed || 0) - new Date(a.lastPlayed || 0);
                case 'playtime':
                    return (b.playTime || 0) - (a.playTime || 0);
                default:
                    return 0;
            }
        });

        this.renderGames();
    }

    renderGames() {
        console.log('Rendu des jeux:', this.filteredGames.length, 'jeux à afficher');
        
        const gamesGrid = document.getElementById('gamesGrid');
        const gamesList = document.getElementById('gamesList');

        if (this.currentView === 'grid') {
            gamesGrid.style.display = 'grid';
            gamesList.style.display = 'none';
            this.renderGridView(gamesGrid);
        } else {
            gamesGrid.style.display = 'none';
            gamesList.style.display = 'block';
            this.renderListView(gamesList);
        }
        
        // S'assurer que la zone de contenu est visible
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('emptyState').style.display = 'none';
    }

    renderGridView(container) {
        container.innerHTML = '';

        this.filteredGames.forEach(game => {
            const gameCard = this.createGameCard(game);
            container.appendChild(gameCard);
        });
    }

    renderListView(container) {
        container.innerHTML = '';

        this.filteredGames.forEach(game => {
            const gameItem = this.createGameListItem(game);
            container.appendChild(gameItem);
        });
    }

    createGameCard(game) {
        const card = document.createElement('div');
        card.className = 'game-card';
        card.dataset.gameId = game.id;

        // Sécuriser les propriétés
        const gameName = game.name || 'Jeu sans nom';
        const gameTags = game.tags || [];
        const gameIcon = game.customIcon || game.icon;
        const isFavorite = game.isFavorite || false;
        const lastPlayed = game.lastPlayed || null;
        const playTime = game.playTime || 0;

        console.log('Création de la carte pour:', gameName, 'Icône:', gameIcon);

        // Gestion des icônes (fichiers locaux ou data URLs)
        let imageElement;
        if (gameIcon) {
            let iconUrl;
            
            // Vérifier si c'est une data URL (icône par défaut) ou un fichier
            if (gameIcon.startsWith('data:')) {
                iconUrl = gameIcon;
                console.log(`🖼️ Icône par défaut pour ${gameName}: ${gameIcon.substring(0, 50)}...`);
            } else {
                // Fichier local - convertir les backslashes
                iconUrl = `file:///${gameIcon.replace(/\\/g, '/')}`;
                console.log(`🖼️ Icône fichier pour ${gameName}: ${iconUrl}`);
            }
            
            imageElement = `
                <img src="${iconUrl}" 
                     alt="${gameName}" 
                     style="width: 100%; height: 100%; object-fit: cover;"
                     onerror="console.log('Erreur chargement icône: ${iconUrl}'); this.style.display='none'; this.nextElementSibling.style.display='flex';"
                     onload="console.log('Icône chargée avec succès pour ${gameName}');">
                <div class="game-image-placeholder" style="display: none;"><i class="fas fa-gamepad"></i></div>`;
        } else {
            console.log(`🖼️ Aucune icône pour ${gameName}, utilisation du placeholder`);
            imageElement = `<div class="game-image-placeholder"><i class="fas fa-gamepad"></i></div>`;
        }

        card.innerHTML = `
            <div class="game-image">
                ${imageElement}
                <div class="game-actions">
                    <button class="action-btn favorite ${isFavorite ? 'active' : ''}" title="Favori">
                        <i class="fas fa-star"></i>
                    </button>
                    <button class="action-btn settings" title="Paramètres">
                        <i class="fas fa-cog"></i>
                    </button>
                </div>
            </div>
            <div class="game-info">
                <div class="game-name">${gameName}</div>
                <div class="game-tags">
                    ${gameTags.map(tag => `<span class="game-tag">${tag}</span>`).join('')}
                </div>
                <div class="game-meta">
                    <span>${lastPlayed ? 'Joué récemment' : 'Jamais joué'}</span>
                    <span>${this.formatPlayTime(playTime)}</span>
                </div>
            </div>
        `;

        // Événements
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.game-actions')) {
                this.launchGame(game);
            }
        });

        card.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showGameModal(game);
        });

        const favoriteBtn = card.querySelector('.action-btn.favorite');
        favoriteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFavorite(game);
        });

        const settingsBtn = card.querySelector('.action-btn.settings');
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.showGameModal(game);
        });

        return card;
    }

    createGameListItem(game) {
        const item = document.createElement('div');
        item.className = 'game-list-item';
        item.dataset.gameId = game.id;

        const gameIcon = game.customIcon || game.icon;
        let listImageElement;
        
        if (gameIcon) {
            let iconUrl;
            
            // Vérifier si c'est une data URL ou un fichier
            if (gameIcon.startsWith('data:')) {
                iconUrl = gameIcon;
            } else {
                iconUrl = `file:///${gameIcon.replace(/\\/g, '/')}`;
            }
            
            listImageElement = `<img src="${iconUrl}" alt="${game.name}" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.parentElement.innerHTML='<div style=\\'display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 24px; color: #444;\\\'><i class=\\'fas fa-gamepad\\'></i></div>';">`;
        } else {
            listImageElement = `<div style="display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-size: 24px; color: #444;"><i class="fas fa-gamepad"></i></div>`;
        }

        item.innerHTML = `
            <div class="game-list-image">${listImageElement}</div>
            <div class="game-list-info">
                <div class="game-list-name">${game.name}</div>
                <div class="game-list-meta">
                    ${(game.tags || []).join(' • ')} • ${game.lastPlayed ? 'Joué récemment' : 'Jamais joué'}
                </div>
            </div>
            <div class="game-list-actions">
                <button class="action-btn favorite ${game.isFavorite ? 'active' : ''}" title="Favori">
                    <i class="fas fa-star"></i>
                </button>
            </div>
        `;

        // Événements
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.game-list-actions')) {
                this.launchGame(game);
            }
        });

        item.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showGameModal(game);
        });

        const favoriteBtn = item.querySelector('.action-btn.favorite');
        favoriteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFavorite(game);
        });

        return item;
    }

    async launchGame(game) {
        try {
            // Mettre à jour la dernière fois joué
            game.lastPlayed = new Date().toISOString();
            await this.saveGamesData();

            // Lancer le jeu avec l'objet complet
            const result = await ipcRenderer.invoke('launch-game', game);
            
            if (result.success) {
                console.log(`Lancement de ${game.name}: ${result.message}`);
                this.updateStats();
                
                // Afficher un message de succès avec la méthode utilisée
                if (result.message) {
                    this.showSuccess(`${game.name}: ${result.message}`);
                }
            } else {
                console.error('Erreur lors du lancement:', result.error);
                this.showError(`Impossible de lancer ${game.name}: ${result.error}`);
            }
        } catch (error) {
            console.error('Erreur lors du lancement du jeu:', error);
            this.showError(`Erreur lors du lancement de ${game.name}`);
        }
    }

    async toggleFavorite(game) {
        game.isFavorite = !game.isFavorite;
        await this.saveGamesData();
        this.renderGames();
        this.updateStats();
    }

    showGameModal(game) {
        this.selectedGame = game;
        
        document.getElementById('modalGameName').textContent = game.name;
        document.getElementById('modalGameNameEdit').value = game.name;
        document.getElementById('modalGamePath').value = game.path;
        document.getElementById('modalGameFavorite').checked = game.isFavorite || false;

        const gameIcon = game.customIcon || game.icon;
        const modalImage = document.getElementById('modalGameImage');
        
        if (gameIcon) {
            let iconUrl;
            
            // Vérifier si c'est une data URL ou un fichier
            if (gameIcon.startsWith('data:')) {
                iconUrl = gameIcon;
            } else {
                iconUrl = `file:///${gameIcon.replace(/\\/g, '/')}`;
            }
            
            modalImage.src = iconUrl;
            modalImage.style.display = 'block';
        } else {
            modalImage.style.display = 'none';
        }

        // Afficher les tags
        const tagsContainer = document.getElementById('modalGameTags');
        tagsContainer.innerHTML = game.tags.map(tag => 
            `<span class="game-tag">${tag}</span>`
        ).join('');

        document.getElementById('gameModal').style.display = 'flex';
    }

    closeModal() {
        document.getElementById('gameModal').style.display = 'none';
        this.selectedGame = null;
    }

    async saveGameChanges() {
        if (!this.selectedGame) return;

        const newName = document.getElementById('modalGameNameEdit').value.trim();
        const isFavorite = document.getElementById('modalGameFavorite').checked;

        if (newName) {
            this.selectedGame.name = newName;
        }
        this.selectedGame.isFavorite = isFavorite;

        await this.saveGamesData();
        this.applyFilters();
        this.updateStats();
        this.closeModal();
    }

    async changeGameImage() {
        try {
            const imagePath = await ipcRenderer.invoke('select-custom-icon');
            if (imagePath && this.selectedGame) {
                this.selectedGame.customIcon = imagePath;
                document.getElementById('modalGameImage').src = `file://${imagePath}`;
                document.getElementById('modalGameImage').style.display = 'block';
            }
        } catch (error) {
            console.error('Erreur lors de la sélection de l\'image:', error);
        }
    }

    resetGameImage() {
        try {
            if (this.selectedGame) {
                // Supprimer l'icône personnalisée
                this.selectedGame.customIcon = null;
                
                // Utiliser l'icône automatique si disponible
                if (this.selectedGame.icon) {
                    let iconUrl;
                    if (this.selectedGame.icon.startsWith('data:')) {
                        iconUrl = this.selectedGame.icon;
                    } else {
                        iconUrl = `file:///${this.selectedGame.icon.replace(/\\/g, '/')}`;
                    }
                    document.getElementById('modalGameImage').src = iconUrl;
                    document.getElementById('modalGameImage').style.display = 'block';
                    
                    this.showSuccess('Icône réinitialisée vers l\'icône automatique');
                } else {
                    // Aucune icône automatique disponible
                    document.getElementById('modalGameImage').style.display = 'none';
                    this.showSuccess('Icône personnalisée supprimée');
                }
                
                console.log(`🔄 Icône réinitialisée pour ${this.selectedGame.name}`);
            }
        } catch (error) {
            console.error('Erreur lors de la réinitialisation de l\'image:', error);
            this.showError('Erreur lors de la réinitialisation de l\'icône');
        }
    }

    handleSearch(query) {
        this.searchQuery = query.trim();
        this.applyFilters();
    }

    formatPlayTime(minutes) {
        if (!minutes || minutes === 0) return '0h';
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
    }

    updateStats() {
        document.getElementById('gameCount').textContent = this.games.length;
        
        const recentGame = this.games
            .filter(game => game.lastPlayed)
            .sort((a, b) => new Date(b.lastPlayed) - new Date(a.lastPlayed))[0];
        
        document.getElementById('lastPlayed').textContent = recentGame ? recentGame.name : '-';
    }

    async saveGamesData() {
        try {
            await ipcRenderer.invoke('save-game-data', this.games);
        } catch (error) {
            console.error('Erreur lors de la sauvegarde:', error);
        }
    }

    showLoadingState() {
        document.getElementById('loadingState').style.display = 'flex';
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('gamesGrid').style.display = 'none';
        document.getElementById('gamesList').style.display = 'none';
    }

    hideLoadingState() {
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('gamesGrid').style.display = this.currentView === 'grid' ? 'grid' : 'none';
        document.getElementById('gamesList').style.display = this.currentView === 'list' ? 'block' : 'none';
    }

    showEmptyState() {
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('emptyState').style.display = 'flex';
        document.getElementById('gamesGrid').style.display = 'none';
        document.getElementById('gamesList').style.display = 'none';
    }

    showLoadingOverlay(text) {
        document.getElementById('loadingText').textContent = text;
        document.getElementById('loadingOverlay').style.display = 'flex';
    }

    hideLoadingOverlay() {
        document.getElementById('loadingOverlay').style.display = 'none';
    }

    showError(message) {
        console.error(message);
        this.showNotification(message, 'error');
    }

    showSuccess(message) {
        console.log(message);
        this.showNotification(message, 'success');
    }

    showNotification(message, type = 'info') {
        // Créer une notification temporaire
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        // Styles inline pour la notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            max-width: 400px;
            word-wrap: break-word;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            ${type === 'error' ? 'background: #ff4757;' : ''}
            ${type === 'success' ? 'background: #2ed573;' : ''}
            ${type === 'info' ? 'background: #00d4ff;' : ''}
        `;
        
        document.body.appendChild(notification);
        
        // Animation d'entrée
        notification.style.transform = 'translateX(100%)';
        notification.style.transition = 'transform 0.3s ease';
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        // Suppression automatique après 5 secondes
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
        
        // Clic pour fermer
        notification.addEventListener('click', () => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        });
    }
}

// Initialiser l'application quand le DOM est chargé
document.addEventListener('DOMContentLoaded', () => {
    new GameLauncher();
});