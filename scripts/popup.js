// ════════════════════════════════════════════════════════════════════════════
// COFRE DE SENHAS FGF - POPUP SCRIPT
// ════════════════════════════════════════════════════════════════════════════

class TeamPassAPI {
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.apiUrl = `${this.baseUrl}/api/index.php`;
        this.token = null;
    }

    async authenticate(username, password, apikey) {
        try {
            const response = await fetch(`${this.apiUrl}/authorize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ login: username, password, apikey })
            });

            if (response.ok) {
                const result = await response.json();
                if (result.token) {
                    this.token = result.token;
                    // Decodificar token JWT para pegar info do usuário
                    const payload = JSON.parse(atob(result.token.split('.')[1]));
                    return {
                        success: true,
                        user: {
                            username: payload.username || username
                        }
                    };
                }
                return { success: false, error: result.error || 'Erro na autenticação' };
            }
            return { success: false, error: `Erro ${response.status}` };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getItemById(itemId) {
        if (!this.token) return null;
        try {
            const response = await fetch(`${this.apiUrl}/item/get?id=${itemId}`, {
                headers: { 'Authorization': `Bearer ${this.token}` }
            });
            if (response.ok) {
                const result = await response.json();
                return Array.isArray(result) && result.length > 0 ? result[0] : null;
            }
        } catch (error) {
            console.error('Erro ao buscar item:', error);
        }
        return null;
    }

    async getAllItems(progressCallback) {
        const items = [];
        const maxId = 200; // Mesmo valor do Python
        
        for (let id = 1; id <= maxId; id++) {
            try {
                const item = await this.getItemById(id);
                if (item && item.login && item.pwd) {
                    items.push({
                        id: item.id,
                        label: item.label || '',
                        description: item.description || '',
                        login: item.login,
                        password: item.pwd,
                        url: item.url || '',
                        folder: item.folder_label || ''
                    });
                }
                
                if (progressCallback && id % 10 === 0) {
                    progressCallback(id, maxId);
                }
            } catch (error) {
                console.error(`Erro ao buscar item ${id}:`, error);
            }
        }
        
        return items;
    }
}

// ════════════════════════════════════════════════════════════════════════════
// FUZZY MATCHING (mesma lógica do Python)
// ════════════════════════════════════════════════════════════════════════════

function fuzzyMatch(str1, str2) {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    
    let matches = 0;
    let maxMatches = 0;
    
    for (let i = 0; i < s1.length; i++) {
        for (let j = 0; j < s2.length; j++) {
            let k = 0;
            while (s1[i + k] && s2[j + k] && s1[i + k] === s2[j + k]) {
                k++;
            }
            if (k > maxMatches) {
                maxMatches = k;
            }
        }
    }
    
    const ratio = (2.0 * maxMatches) / (s1.length + s2.length);
    return ratio;
}

function matchCredential(credential, currentUrl) {
    if (!currentUrl) return 0;
    
    const credUrl = credential.url || '';
    const credLabel = credential.label || '';
    const credDesc = credential.description || '';
    
    // Extrair domínio da URL atual
    let domain = '';
    try {
        const url = new URL(currentUrl);
        domain = url.hostname.replace('www.', '');
    } catch (e) {
        domain = currentUrl;
    }
    
    // Calcular scores
    const urlScore = fuzzyMatch(credUrl, currentUrl);
    const domainScore = fuzzyMatch(credUrl, domain);
    const labelScore = fuzzyMatch(credLabel, domain);
    const descScore = fuzzyMatch(credDesc, domain);
    
    // Retornar o maior score
    return Math.max(urlScore, domainScore, labelScore * 0.8, descScore * 0.6);
}

// ════════════════════════════════════════════════════════════════════════════
// GERENCIAMENTO DE ESTADO
// ════════════════════════════════════════════════════════════════════════════

class AppState {
    static async load() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['config', 'session', 'credentials'], (data) => {
                resolve(data);
            });
        });
    }

    static async save(key, value) {
        return new Promise((resolve) => {
            chrome.storage.local.set({ [key]: value }, resolve);
        });
    }

    static async clear(key) {
        return new Promise((resolve) => {
            chrome.storage.local.remove(key, resolve);
        });
    }
}

// ════════════════════════════════════════════════════════════════════════════
// UI CONTROLLER
// ════════════════════════════════════════════════════════════════════════════

class PopupUI {
    constructor() {
        this.currentScreen = null;
        this.api = null;
        this.credentials = [];
        this.currentUrl = '';
        this.init();
    }

    async init() {
        // Carregar estado
        const state = await AppState.load();

        // Verificar se tem configuração completa
        if (!state.config || !state.config.api_url || !state.config.username || !state.config.password || !state.config.apikey) {
            // Preencher campos com valores salvos parcialmente
            if (state.config) {
                if (state.config.api_url) document.getElementById('server-url').value = state.config.api_url;
                if (state.config.username) document.getElementById('config-username').value = state.config.username;
                if (state.config.password) document.getElementById('config-password').value = state.config.password;
                if (state.config.apikey) document.getElementById('config-apikey').value = state.config.apikey;
            }
            this.showScreen('config');
            this.setupEventListeners();
            return;
        }

        // Preencher campos da config com valores salvos
        document.getElementById('server-url').value = state.config.api_url;
        document.getElementById('config-username').value = state.config.username;
        document.getElementById('config-password').value = state.config.password;
        document.getElementById('config-apikey').value = state.config.apikey;

        // Verificar se tem sessão ativa
        if (state.session && state.session.token) {
            this.api = new TeamPassAPI(state.config.api_url);
            this.api.token = state.session.token;

            // Carregar credenciais do cache ou buscar novas
            if (state.credentials && state.credentials.length > 0) {
                this.credentials = state.credentials;
                this.showMainScreen(state.session.user);
            } else {
                this.showMainScreen(state.session.user);
                await this.refreshCredentials();
            }
        } else {
            // Tentar auto-login com credenciais salvas
            this.api = new TeamPassAPI(state.config.api_url);
            this.showScreen('config');
            this.showStatus('config', 'Conectando automaticamente...', 'info');
            await this.autoLogin(state.config);
        }

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Config screen
        document.getElementById('test-connection')?.addEventListener('click', () => this.testConnection());
        document.getElementById('save-config')?.addEventListener('click', () => this.saveConfig());

        // Main screen
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
        document.getElementById('refresh-btn')?.addEventListener('click', () => this.refreshCredentials());
        document.getElementById('search-box')?.addEventListener('input', (e) => this.filterCredentials(e.target.value));

        // Enter key nos inputs da config
        ['config-username', 'config-password', 'config-apikey'].forEach(id => {
            document.getElementById(id)?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.saveConfig();
            });
        });
    }

    showScreen(screenName) {
        ['config-screen', 'main-screen'].forEach(id => {
            document.getElementById(id).style.display = 'none';
        });
        document.getElementById(`${screenName}-screen`).style.display = 'flex';
        this.currentScreen = screenName;
    }

    showStatus(screenName, message, type = 'info') {
        const statusEl = document.getElementById(`${screenName}-status`);
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = `status ${type}`;
        }
    }

    async testConnection() {
        const url = document.getElementById('server-url').value.trim();
        if (!url) {
            this.showStatus('config', 'Digite a URL do servidor', 'error');
            return;
        }

        this.showStatus('config', 'Testando conexão...', 'info');
        
        try {
            const testApi = new TeamPassAPI(url);
            const response = await fetch(`${testApi.apiUrl}/authorize`, { method: 'GET' });
            
            if ([200, 400, 401, 405].includes(response.status)) {
                this.showStatus('config', '✓ Conexão OK!', 'success');
            } else {
                this.showStatus('config', `Erro ${response.status}`, 'error');
            }
        } catch (error) {
            this.showStatus('config', error.message, 'error');
        }
    }

    async saveConfig() {
        const url = document.getElementById('server-url').value.trim();
        const username = document.getElementById('config-username').value.trim();
        const password = document.getElementById('config-password').value.trim();
        const apikey = document.getElementById('config-apikey').value.trim();

        if (!url || !username || !password || !apikey) {
            this.showStatus('config', 'Preencha todos os campos', 'error');
            return;
        }

        const config = { api_url: url, username, password, apikey };
        await AppState.save('config', config);
        this.api = new TeamPassAPI(url);

        this.showStatus('config', 'Conectando ao TeamPass...', 'info');
        await this.autoLogin(config);
    }

    async autoLogin(config) {
        if (!this.api) {
            this.api = new TeamPassAPI(config.api_url);
        }

        const result = await this.api.authenticate(config.username, config.password, config.apikey);

        if (result.success) {
            await AppState.save('session', {
                token: this.api.token,
                user: result.user
            });

            this.showMainScreen(result.user);
            await this.refreshCredentials();
        } else {
            this.showStatus('config', 'Falha na autenticação: ' + result.error, 'error');
        }
    }

    async logout() {
        await AppState.clear('session');
        await AppState.clear('credentials');
        this.credentials = [];
        if (this.api) this.api.token = null;
        this.showScreen('config');
    }

    async showMainScreen(user) {
        this.showScreen('main');
        document.getElementById('user-name').textContent = user.username;
        
        // Pegar URL da aba ativa
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url) {
            this.currentUrl = tab.url;
            document.getElementById('current-url').textContent = this.currentUrl;
            document.getElementById('current-url-info').style.display = 'block';
        }

        this.renderCredentials();
    }

    async refreshCredentials() {
        const listEl = document.getElementById('credentials-list');
        listEl.innerHTML = '<div class="loading">🔄 Carregando credenciais...</div>';

        try {
            this.credentials = await this.api.getAllItems((current, total) => {
                listEl.innerHTML = `<div class="loading">Carregando... ${current}/${total}</div>`;
            });

            await AppState.save('credentials', this.credentials);
            this.renderCredentials();
        } catch (error) {
            listEl.innerHTML = `<div class="no-credentials"><p>❌ Erro ao carregar credenciais</p><p>${error.message}</p></div>`;
        }
    }

    renderCredentials(filter = '') {
        const listEl = document.getElementById('credentials-list');
        
        if (this.credentials.length === 0) {
            listEl.innerHTML = '<div class="no-credentials"><p>Nenhuma credencial encontrada</p></div>';
            return;
        }

        // Filtrar credenciais
        let filtered = this.credentials;
        if (filter) {
            const filterLower = filter.toLowerCase();
            filtered = this.credentials.filter(c => 
                c.label.toLowerCase().includes(filterLower) ||
                c.url.toLowerCase().includes(filterLower) ||
                c.login.toLowerCase().includes(filterLower)
            );
        }

        // Calcular match scores e ordenar
        const withScores = filtered.map(cred => ({
            ...cred,
            matchScore: matchCredential(cred, this.currentUrl)
        }));

        withScores.sort((a, b) => b.matchScore - a.matchScore);

        // Renderizar
        listEl.innerHTML = withScores.map(cred => this.renderCredentialItem(cred)).join('');

        // Atualizar contador
        document.getElementById('credentials-count').textContent = 
            `${filtered.length} credencia${filtered.length !== 1 ? 'is' : 'l'}`;

        // Adicionar event listeners
        this.attachCredentialListeners();
    }

    renderCredentialItem(cred) {
        const isMatched = cred.matchScore > 0.3;
        const showScore = cred.matchScore > 0;

        return `
            <div class="credential-item ${isMatched ? 'matched' : ''}" data-id="${cred.id}">
                <div class="credential-header">
                    <div class="credential-label">${this.escapeHtml(cred.label)}</div>
                    ${showScore ? `<div class="match-score">${Math.round(cred.matchScore * 100)}%</div>` : ''}
                </div>
                <div class="credential-details">
                    👤 ${this.escapeHtml(cred.login)}
                    ${cred.folder ? `<br>📁 ${this.escapeHtml(cred.folder)}` : ''}
                </div>
                ${cred.url ? `<div class="credential-url">🔗 ${this.escapeHtml(cred.url)}</div>` : ''}
                <div class="credential-actions">
                    <button class="action-btn autofill-btn" data-type="both">🔐 Preencher Tudo</button>
                    <button class="action-btn autofill-btn" data-type="user">👤 Usuário</button>
                    <button class="action-btn autofill-btn" data-type="password">🔑 Senha</button>
                </div>
            </div>
        `;
    }

    attachCredentialListeners() {
        document.querySelectorAll('.autofill-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = e.target.closest('.credential-item');
                const credId = item.dataset.id;
                const fillType = e.target.dataset.type;
                this.autofillCredential(credId, fillType);
            });
        });
    }

    async autofillCredential(credId, fillType) {
        const cred = this.credentials.find(c => c.id == credId);
        if (!cred) return;

        // Pegar aba ativa
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        // Enviar mensagem para o content script
        try {
            await chrome.tabs.sendMessage(tab.id, {
                action: 'autofill',
                data: {
                    login: cred.login,
                    password: cred.password,
                    fillType: fillType
                }
            });

            // Fechar popup após autofill
            window.close();
        } catch (error) {
            console.error('Erro ao autofill:', error);
            alert('Erro ao preencher. Certifique-se de que está em uma página web válida.');
        }
    }

    filterCredentials(searchTerm) {
        this.renderCredentials(searchTerm);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// ════════════════════════════════════════════════════════════════════════════
// INICIALIZAÇÃO
// ════════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
    new PopupUI();
});
