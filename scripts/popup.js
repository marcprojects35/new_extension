// ════════════════════════════════════════════════════════════════════════════
// COFRE DE SENHAS FGF - POPUP SCRIPT
// ════════════════════════════════════════════════════════════════════════════

class TeamPassAPI {
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.apiUrl = `${this.baseUrl}/api/index.php`;
        this.token = null;
        this.apikey = null;
        this.authMode = null; // 'jwt' ou 'apikey'
    }

    // Tenta autenticar com múltiplos formatos (bug conhecido do TeamPass #3893)
    async authenticate(username, password, apikey) {
        this.apikey = apikey;
        const authUrl = `${this.apiUrl}/authorize`;

        console.log('[TeamPass] Autenticando em:', authUrl);

        // Estratégia 1: POST com form-urlencoded (contorna bug do Content-Type JSON)
        const attempt1 = await this._tryAuth(authUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ login: username, password, apikey })
        }, 'form-urlencoded', username);
        if (attempt1.success) return attempt1;

        // Estratégia 2: POST com JSON (formato padrão documentado)
        const attempt2 = await this._tryAuth(authUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: username, password, apikey })
        }, 'json', username);
        if (attempt2.success) return attempt2;

        // Estratégia 3: POST JSON sem Content-Type explícito
        const attempt3 = await this._tryAuth(authUrl, {
            method: 'POST',
            body: JSON.stringify({ login: username, password, apikey })
        }, 'json-sem-header', username);
        if (attempt3.success) return attempt3;

        // Estratégia 4: Testar API legada (sem JWT, só apikey na URL)
        console.log('[TeamPass] Tentando API legada (apikey na URL)...');
        try {
            const legacyUrl = `${this.apiUrl}/read/userpw/${encodeURIComponent(username)}?apikey=${encodeURIComponent(apikey)}`;
            const legacyResponse = await fetch(legacyUrl);
            console.log('[TeamPass] API legada status:', legacyResponse.status);

            if (legacyResponse.ok) {
                const data = await legacyResponse.json();
                console.log('[TeamPass] API legada funcionou! Itens:', Array.isArray(data) ? data.length : 'N/A');
                this.authMode = 'apikey';
                this.token = null;
                return {
                    success: true,
                    user: { username },
                    mode: 'apikey'
                };
            }
        } catch (e) {
            console.log('[TeamPass] API legada falhou:', e.message);
        }

        // Todas as tentativas falharam - retornar o erro mais informativo
        const lastError = attempt2.error || attempt1.error || 'Todas as tentativas falharam';
        return { success: false, error: lastError };
    }

    async _tryAuth(url, options, label, username) {
        try {
            console.log(`[TeamPass] Tentativa ${label}...`);
            const response = await fetch(url, options);
            const responseText = await response.text();
            console.log(`[TeamPass] ${label} - Status: ${response.status}, Resposta: ${responseText.substring(0, 200)}`);

            if (response.ok) {
                let result;
                try {
                    result = JSON.parse(responseText);
                } catch (e) {
                    return { success: false, error: `Resposta inválida (${label})` };
                }

                if (result.token) {
                    this.token = result.token;
                    this.authMode = 'jwt';
                    const payload = JSON.parse(atob(result.token.split('.')[1]));
                    console.log(`[TeamPass] Autenticado via ${label}!`);
                    return {
                        success: true,
                        user: { username: payload.username || username },
                        mode: 'jwt'
                    };
                }
                return { success: false, error: result.error || 'Token ausente na resposta' };
            }

            // Extrair mensagem de erro
            let errorMsg = `Erro ${response.status}`;
            try {
                const errorResult = JSON.parse(responseText);
                if (errorResult.error) errorMsg += ` - ${errorResult.error}`;
                else if (errorResult.message) errorMsg += ` - ${errorResult.message}`;
            } catch (e) {
                if (responseText) errorMsg += ` - ${responseText.substring(0, 100)}`;
            }
            return { success: false, error: errorMsg };
        } catch (error) {
            console.error(`[TeamPass] Erro ${label}:`, error);
            return { success: false, error: `Erro de conexão (${label}): ${error.message}` };
        }
    }

    async getItemById(itemId) {
        try {
            let response;
            if (this.authMode === 'apikey') {
                // API legada: apikey como query parameter
                response = await fetch(`${this.apiUrl}/read/items/${itemId}?apikey=${encodeURIComponent(this.apikey)}`);
            } else if (this.token) {
                // API JWT: token no header
                response = await fetch(`${this.apiUrl}/item/get?id=${itemId}`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
            } else {
                return null;
            }

            if (response.ok) {
                const result = await response.json();
                if (Array.isArray(result) && result.length > 0) {
                    return result[0];
                }
                // API legada pode retornar objeto direto
                if (result && result.id) {
                    return result;
                }
            }
        } catch (error) {
            console.error('Erro ao buscar item:', error);
        }
        return null;
    }

    async getAllItems(progressCallback) {
        // Se modo apikey, tentar buscar via endpoint de usuário primeiro
        if (this.authMode === 'apikey') {
            return this._getAllItemsLegacy(progressCallback);
        }
        return this._getAllItemsJWT(progressCallback);
    }

    async _getAllItemsLegacy(progressCallback) {
        const items = [];

        // Tentar buscar pastas do usuário e itens de cada pasta
        try {
            const foldersUrl = `${this.apiUrl}/read/userfolders/all?apikey=${encodeURIComponent(this.apikey)}`;
            const foldersResponse = await fetch(foldersUrl);

            if (foldersResponse.ok) {
                const folders = await foldersResponse.json();
                const folderIds = Array.isArray(folders)
                    ? folders.map(f => f.id).filter(Boolean)
                    : Object.keys(folders).filter(k => !isNaN(k));

                if (folderIds.length > 0) {
                    const folderIdStr = folderIds.join(';');
                    const itemsUrl = `${this.apiUrl}/read/folder/${folderIdStr}?apikey=${encodeURIComponent(this.apikey)}`;
                    const itemsResponse = await fetch(itemsUrl);

                    if (itemsResponse.ok) {
                        const rawItems = await itemsResponse.json();
                        const itemList = Array.isArray(rawItems) ? rawItems : [rawItems];

                        for (const item of itemList) {
                            if (item && item.login && (item.pw || item.pwd)) {
                                items.push({
                                    id: item.id,
                                    label: item.label || '',
                                    description: item.description || '',
                                    login: item.login,
                                    password: item.pw || item.pwd,
                                    url: item.url || '',
                                    folder: item.folder_label || item.folder || ''
                                });
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.error('[TeamPass] Erro ao buscar via API legada:', error);
        }

        // Se não conseguiu via pastas, tentar por IDs sequenciais
        if (items.length === 0) {
            return this._getAllItemsJWT(progressCallback);
        }

        if (progressCallback) progressCallback(items.length, items.length);
        return items;
    }

    async _getAllItemsJWT(progressCallback) {
        const items = [];
        const maxId = 200;

        for (let id = 1; id <= maxId; id++) {
            try {
                const item = await this.getItemById(id);
                if (item && item.login && (item.pwd || item.pw)) {
                    items.push({
                        id: item.id,
                        label: item.label || '',
                        description: item.description || '',
                        login: item.login,
                        password: item.pwd || item.pw,
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
        const username = document.getElementById('config-username').value.trim();
        const password = document.getElementById('config-password').value.trim();
        const apikey = document.getElementById('config-apikey').value.trim();

        if (!url) {
            this.showStatus('config', 'Digite a URL do servidor', 'error');
            return;
        }

        this.showStatus('config', 'Testando conexão...', 'info');

        try {
            const testApi = new TeamPassAPI(url);

            // Verificar se o servidor é alcançável
            let pingOk = false;
            try {
                const pingResponse = await fetch(`${testApi.apiUrl}/authorize`, { method: 'GET' });
                pingOk = [200, 400, 401, 405, 422].includes(pingResponse.status);
                if (!pingOk) {
                    this.showStatus('config', `Servidor retornou erro ${pingResponse.status}`, 'error');
                    return;
                }
            } catch (e) {
                this.showStatus('config', 'Servidor inacessível: ' + e.message, 'error');
                return;
            }

            // Se tem credenciais preenchidas, testar autenticação completa
            if (username && password && apikey) {
                this.showStatus('config', 'Servidor OK. Testando autenticação...', 'info');
                const result = await testApi.authenticate(username, password, apikey);
                if (result.success) {
                    const mode = result.mode === 'apikey' ? ' (API legada)' : ' (JWT)';
                    this.showStatus('config', `Conexão e autenticação OK!${mode}`, 'success');
                } else {
                    this.showStatus('config', `Servidor OK, autenticação falhou: ${result.error}`, 'error');
                }
            } else {
                this.showStatus('config', 'Servidor acessível! Preencha as credenciais para testar.', 'success');
            }
        } catch (error) {
            this.showStatus('config', 'Erro: ' + error.message, 'error');
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
