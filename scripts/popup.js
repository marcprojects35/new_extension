// ════════════════════════════════════════════════════════════════════════════
// COFRE DE SENHAS FGF - POPUP SCRIPT v3.1
// ════════════════════════════════════════════════════════════════════════════

class TeamPassAPI {
    constructor(baseUrl) {
        this.baseUrl = baseUrl.replace(/\/$/, '');
        this.apiUrl = `${this.baseUrl}/api/index.php`;
        this.token = null;
        this.apikey = null;
        this.authMode = null;
    }

    async authenticate(username, password, apikey) {
        this.apikey = apikey;
        const authUrl = `${this.apiUrl}/authorize`;

        console.log('[TeamPass] Autenticando em:', authUrl);

        const attempt1 = await this._tryAuth(authUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ login: username, password, apikey })
        }, 'form-urlencoded', username);
        if (attempt1.success) return attempt1;

        const attempt2 = await this._tryAuth(authUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: username, password, apikey })
        }, 'json', username);
        if (attempt2.success) return attempt2;

        const attempt3 = await this._tryAuth(authUrl, {
            method: 'POST',
            body: JSON.stringify({ login: username, password, apikey })
        }, 'json-sem-header', username);
        if (attempt3.success) return attempt3;

        console.log('[TeamPass] Tentando API legada (apikey na URL)...');
        try {
            const legacyUrl = `${this.apiUrl}/read/userpw/${encodeURIComponent(username)}?apikey=${encodeURIComponent(apikey)}`;
            const legacyResponse = await fetch(legacyUrl);
            if (legacyResponse.ok) {
                this.authMode = 'apikey';
                this.token = null;
                return { success: true, user: { username }, mode: 'apikey' };
            }
        } catch (e) {
            console.log('[TeamPass] API legada falhou:', e.message);
        }

        const lastError = attempt2.error || attempt1.error || 'Todas as tentativas falharam';
        return { success: false, error: lastError };
    }

    async _tryAuth(url, options, label, username) {
        try {
            console.log(`[TeamPass] Tentativa ${label}...`);
            const response = await fetch(url, options);
            const responseText = await response.text();
            console.log(`[TeamPass] ${label} - Status: ${response.status}`);

            if (response.ok) {
                let result;
                try { result = JSON.parse(responseText); } catch (e) {
                    return { success: false, error: `Resposta inválida (${label})` };
                }
                if (result.token) {
                    this.token = result.token;
                    this.authMode = 'jwt';
                    const payload = JSON.parse(atob(result.token.split('.')[1]));
                    return { success: true, user: { username: payload.username || username }, mode: 'jwt' };
                }
                return { success: false, error: result.error || 'Token ausente na resposta' };
            }

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
            return { success: false, error: `Erro de conexão (${label}): ${error.message}` };
        }
    }

    async getItemById(itemId) {
        try {
            let response;
            if (this.authMode === 'apikey') {
                response = await fetch(`${this.apiUrl}/read/items/${itemId}?apikey=${encodeURIComponent(this.apikey)}`);
            } else if (this.token) {
                response = await fetch(`${this.apiUrl}/item/get?id=${itemId}`, {
                    headers: { 'Authorization': `Bearer ${this.token}` }
                });
            } else return null;

            if (response.ok) {
                const result = await response.json();
                if (Array.isArray(result) && result.length > 0) return result[0];
                if (result && result.id) return result;
            }
        } catch (error) {
            console.error('Erro ao buscar item:', error);
        }
        return null;
    }

    async getAllItems(progressCallback) {
        if (this.authMode === 'apikey') return this._getAllItemsLegacy(progressCallback);
        return this._getAllItemsJWT(progressCallback);
    }

    async createItem({ label, login, password, url, folderId }) {
        console.log('[TeamPass] Criando item:', { label, login, url, folderId });

        if (this.authMode === 'apikey') {
            return this._createItemLegacy({ label, login, password, url, folderId });
        }
        return this._createItemJWT({ label, login, password, url, folderId });
    }

    async _createItemJWT({ label, login, password, url, folderId }) {
        if (!this.token) return { success: false, error: 'Token JWT ausente' };

        const body = {
            label: label || url,
            login,
            pwd: password,
            url: url || '',
            folder_id: folderId || 0
        };

        // Estrategia 1: POST /item com JSON
        try {
            const response = await fetch(`${this.apiUrl}/item`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('[TeamPass] Item criado (JWT json):', result);
                return { success: true, itemId: result.id || result.item_id || null };
            }
            console.log('[TeamPass] JWT json falhou:', response.status);
        } catch (e) {
            console.log('[TeamPass] Erro JWT json:', e.message);
        }

        // Estrategia 2: POST /item com form-urlencoded
        try {
            const response = await fetch(`${this.apiUrl}/item`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: new URLSearchParams(body)
            });

            if (response.ok) {
                const result = await response.json();
                console.log('[TeamPass] Item criado (JWT form):', result);
                return { success: true, itemId: result.id || result.item_id || null };
            }
            console.log('[TeamPass] JWT form falhou:', response.status);
        } catch (e) {
            console.log('[TeamPass] Erro JWT form:', e.message);
        }

        return { success: false, error: 'Nao foi possivel criar item via JWT' };
    }

    async _createItemLegacy({ label, login, password, url, folderId }) {
        // API legada: POST /add/item/{base64_encoded_data}?apikey=...
        try {
            const itemData = JSON.stringify({
                label: label || url,
                login,
                pwd: password,
                url: url || '',
                folder_id: folderId || 0
            });
            const encoded = btoa(new TextEncoder().encode(itemData).reduce((s, b) => s + String.fromCharCode(b), ''));
            const addUrl = `${this.apiUrl}/add/item/${encoded}?apikey=${encodeURIComponent(this.apikey)}`;

            const response = await fetch(addUrl, { method: 'POST' });
            if (response.ok) {
                const result = await response.json();
                console.log('[TeamPass] Item criado (legacy):', result);
                return { success: true, itemId: result.id || result.item_id || null };
            }
            console.log('[TeamPass] Legacy falhou:', response.status);
        } catch (e) {
            console.log('[TeamPass] Erro legacy:', e.message);
        }

        return { success: false, error: 'Nao foi possivel criar item via API legada' };
    }

    async _getAllItemsLegacy(progressCallback) {
        const items = [];
        try {
            const foldersUrl = `${this.apiUrl}/read/userfolders/all?apikey=${encodeURIComponent(this.apikey)}`;
            const foldersResponse = await fetch(foldersUrl);
            if (foldersResponse.ok) {
                const folders = await foldersResponse.json();
                const folderIds = Array.isArray(folders)
                    ? folders.map(f => f.id).filter(Boolean)
                    : Object.keys(folders).filter(k => !isNaN(k));
                if (folderIds.length > 0) {
                    const itemsResponse = await fetch(`${this.apiUrl}/read/folder/${folderIds.join(';')}?apikey=${encodeURIComponent(this.apikey)}`);
                    if (itemsResponse.ok) {
                        const rawItems = await itemsResponse.json();
                        (Array.isArray(rawItems) ? rawItems : [rawItems]).forEach(item => {
                            if (item && item.login && (item.pw || item.pwd)) {
                                items.push({
                                    id: item.id, label: item.label || '', description: item.description || '',
                                    login: item.login, password: item.pw || item.pwd,
                                    url: item.url || '', folder: item.folder_label || item.folder || ''
                                });
                            }
                        });
                    }
                }
            }
        } catch (error) {
            console.error('[TeamPass] Erro API legada:', error);
        }
        if (items.length === 0) return this._getAllItemsJWT(progressCallback);
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
                        id: item.id, label: item.label || '', description: item.description || '',
                        login: item.login, password: item.pwd || item.pw,
                        url: item.url || '', folder: item.folder_label || ''
                    });
                }
                if (progressCallback && id % 10 === 0) progressCallback(id, maxId);
            } catch (error) {}
        }
        return items;
    }
}

// ════════════════════════════════════════════════════════════════════════════
// MATCHING
// ════════════════════════════════════════════════════════════════════════════

function deduplicateCredentials(creds) {
    const seen = new Map();
    for (let i = creds.length - 1; i >= 0; i--) {
        const cred = creds[i];
        let domain = '';
        try {
            domain = new URL(cred.url || '').hostname.replace('www.', '').toLowerCase();
        } catch (e) {
            domain = (cred.url || '').replace(/https?:\/\//, '').split('/')[0].replace('www.', '').toLowerCase();
        }
        const key = `${(cred.login || '').toLowerCase()}|${domain}`;
        if (!seen.has(key)) {
            seen.set(key, cred);
        }
    }
    return Array.from(seen.values()).reverse();
}

function matchCredential(credential, currentUrl) {
    if (!currentUrl) return 0;
    const credUrl = (credential.url || '').toLowerCase();
    const credLabel = (credential.label || '').toLowerCase();
    let domain = '';
    try { domain = new URL(currentUrl).hostname.replace('www.', '').toLowerCase(); } catch (e) { domain = currentUrl.toLowerCase(); }

    let score = 0;
    if (credUrl && credUrl.includes(domain)) score = Math.max(score, 100);
    const credDomain = credUrl.replace(/https?:\/\//, '').split('/')[0];
    if (credDomain && domain.includes(credDomain)) score = Math.max(score, 80);
    const domainBase = domain.split('.')[0];
    if (domainBase.length > 2 && credLabel.includes(domainBase)) score = Math.max(score, 50);
    if (domainBase.length > 2 && credUrl.includes(domainBase)) score = Math.max(score, 40);
    return score;
}

// ════════════════════════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════════════════════════

class AppState {
    static async load() {
        return new Promise(resolve => chrome.storage.local.get(['config', 'session', 'credentials'], resolve));
    }
    static async save(key, value) {
        return new Promise(resolve => chrome.storage.local.set({ [key]: value }, resolve));
    }
    static async clear(key) {
        return new Promise(resolve => chrome.storage.local.remove(key, resolve));
    }
}

// ════════════════════════════════════════════════════════════════════════════
// UI CONTROLLER
// ════════════════════════════════════════════════════════════════════════════

class PopupUI {
    constructor() {
        this.api = null;
        this.credentials = [];
        this.currentUrl = '';
        this.init();
    }

    async init() {
        const state = await AppState.load();

        if (!state.config || !state.config.api_url || !state.config.username || !state.config.password || !state.config.apikey) {
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

        document.getElementById('server-url').value = state.config.api_url;
        document.getElementById('config-username').value = state.config.username;
        document.getElementById('config-password').value = state.config.password;
        document.getElementById('config-apikey').value = state.config.apikey;

        if (state.session && state.session.token) {
            this.api = new TeamPassAPI(state.config.api_url);
            this.api.token = state.session.token;
            if (state.credentials && state.credentials.length > 0) {
                this.credentials = deduplicateCredentials(state.credentials);
                this.showMainScreen(state.session.user);
            } else {
                this.showMainScreen(state.session.user);
                await this.refreshCredentials();
            }
        } else {
            this.api = new TeamPassAPI(state.config.api_url);
            this.showScreen('config');
            this.showStatus('config', 'Conectando automaticamente...', 'info');
            await this.autoLogin(state.config);
        }

        this.setupEventListeners();
    }

    setupEventListeners() {
        document.getElementById('test-connection')?.addEventListener('click', () => this.testConnection());
        document.getElementById('save-config')?.addEventListener('click', () => this.saveConfig());
        document.getElementById('logout-btn')?.addEventListener('click', () => this.logout());
        document.getElementById('refresh-btn')?.addEventListener('click', () => this.refreshCredentials());
        document.getElementById('settings-btn')?.addEventListener('click', () => {
            this.showScreen('config');
            this.renderBlacklist();
        });
        document.getElementById('search-box')?.addEventListener('input', (e) => this.renderAllTab(e.target.value));

        ['config-username', 'config-password', 'config-apikey'].forEach(id => {
            document.getElementById(id)?.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.saveConfig();
            });
        });

        // Tab navigation
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => this.switchTab(tab.dataset.tab));
        });

        // Blacklist: limpar todos
        document.getElementById('blacklist-clear-all')?.addEventListener('click', () => this.clearBlacklist());

        // Carregar blacklist na tela de config
        this.renderBlacklist();
    }

    switchTab(tabName) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.querySelector(`.tab[data-tab="${tabName}"]`)?.classList.add('active');
        document.getElementById(`tab-${tabName}`)?.classList.add('active');
    }

    showScreen(screenName) {
        ['config-screen', 'main-screen'].forEach(id => {
            document.getElementById(id).style.display = 'none';
        });
        document.getElementById(`${screenName}-screen`).style.display = 'flex';
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

        if (!url) { this.showStatus('config', 'Digite a URL do servidor', 'error'); return; }

        this.showStatus('config', 'Testando conexão...', 'info');
        try {
            const testApi = new TeamPassAPI(url);
            let pingOk = false;
            try {
                const pingResponse = await fetch(`${testApi.apiUrl}/authorize`, { method: 'GET' });
                pingOk = [200, 400, 401, 405, 422].includes(pingResponse.status);
                if (!pingOk) { this.showStatus('config', `Servidor retornou erro ${pingResponse.status}`, 'error'); return; }
            } catch (e) { this.showStatus('config', 'Servidor inacessível: ' + e.message, 'error'); return; }

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
                this.showStatus('config', 'Servidor acessível! Preencha as credenciais.', 'success');
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
            this.showStatus('config', 'Preencha todos os campos', 'error'); return;
        }

        const config = { api_url: url, username, password, apikey };
        await AppState.save('config', config);
        this.api = new TeamPassAPI(url);
        this.showStatus('config', 'Conectando ao TeamPass...', 'info');
        await this.autoLogin(config);
    }

    async autoLogin(config) {
        if (!this.api) this.api = new TeamPassAPI(config.api_url);
        const result = await this.api.authenticate(config.username, config.password, config.apikey);
        if (result.success) {
            await AppState.save('session', { token: this.api.token, user: result.user });
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

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url) {
            this.currentUrl = tab.url;
            try {
                const hostname = new URL(tab.url).hostname;
                document.getElementById('site-url-text').textContent = hostname;
                document.getElementById('site-url-bar').style.display = 'flex';
            } catch (e) {}
        }

        this.renderAll();
    }

    async refreshCredentials() {
        const siteEl = document.getElementById('site-credentials');
        const allEl = document.getElementById('all-credentials');
        const foldersEl = document.getElementById('folders-list');

        const loadingHtml = '<div class="loading"><div class="loading-spinner"></div><div>Carregando credenciais...</div></div>';
        siteEl.innerHTML = loadingHtml;
        allEl.innerHTML = loadingHtml;
        foldersEl.innerHTML = loadingHtml;

        try {
            const rawCredentials = await this.api.getAllItems((current, total) => {
                const msg = `<div class="loading"><div class="loading-spinner"></div><div>Carregando... ${current}/${total}</div></div>`;
                siteEl.innerHTML = msg;
            });
            this.credentials = deduplicateCredentials(rawCredentials);
            await AppState.save('credentials', this.credentials);
            this.renderAll();
        } catch (error) {
            const errHtml = `<div class="empty-state"><div class="empty-state-text">Erro ao carregar credenciais<br>${this.escapeHtml(error.message)}</div></div>`;
            siteEl.innerHTML = errHtml;
            allEl.innerHTML = errHtml;
        }
    }

    renderAll() {
        this.renderSiteTab();
        this.renderFoldersTab();
        this.renderAllTab();
        document.getElementById('credentials-count').textContent = `${this.credentials.length} credencia${this.credentials.length !== 1 ? 'is' : 'l'}`;
    }

    // ── Tab: Para este site ──
    renderSiteTab() {
        const el = document.getElementById('site-credentials');
        if (this.credentials.length === 0) {
            el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">Nenhuma credencial carregada</div></div>';
            return;
        }

        const withScores = this.credentials.map(c => ({ ...c, matchScore: matchCredential(c, this.currentUrl) }));
        const matched = withScores.filter(c => c.matchScore > 0).sort((a, b) => b.matchScore - a.matchScore);

        if (matched.length === 0) {
            el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🌐</div><div class="empty-state-text">Nenhuma credencial corresponde a este site.<br>Use a aba "Todas" para buscar.</div></div>';
            return;
        }

        el.innerHTML = matched.map(c => this.renderCredItem(c, true)).join('');
        this.attachListeners(el);
    }

    // ── Tab: Pastas ──
    renderFoldersTab() {
        const el = document.getElementById('folders-list');
        if (this.credentials.length === 0) {
            el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📁</div><div class="empty-state-text">Nenhuma credencial carregada</div></div>';
            return;
        }

        // Agrupar por pasta
        const folders = {};
        this.credentials.forEach(c => {
            const folder = c.folder || 'Sem pasta';
            if (!folders[folder]) folders[folder] = [];
            folders[folder].push(c);
        });

        // Ordenar pastas alfabeticamente
        const sortedFolders = Object.keys(folders).sort((a, b) => {
            if (a === 'Sem pasta') return 1;
            if (b === 'Sem pasta') return -1;
            return a.localeCompare(b);
        });

        el.innerHTML = sortedFolders.map(folderName => {
            const items = folders[folderName];
            return `
                <div class="folder-group">
                    <div class="folder-header">
                        <span class="folder-icon">📁</span>
                        <span class="folder-name">${this.escapeHtml(folderName)}</span>
                        <span class="folder-count">${items.length}</span>
                        <span class="folder-arrow">▶</span>
                    </div>
                    <div class="folder-items">
                        ${items.map(c => this.renderCredItem(c, false)).join('')}
                    </div>
                </div>`;
        }).join('');

        // Toggle folders
        el.querySelectorAll('.folder-header').forEach(header => {
            header.addEventListener('click', () => {
                header.parentElement.classList.toggle('open');
            });
        });

        this.attachListeners(el);
    }

    // ── Tab: Todas ──
    renderAllTab(filter = '') {
        const el = document.getElementById('all-credentials');
        if (this.credentials.length === 0) {
            el.innerHTML = '<div class="empty-state"><div class="empty-state-icon">🔐</div><div class="empty-state-text">Nenhuma credencial carregada</div></div>';
            return;
        }

        let filtered = this.credentials;
        if (filter) {
            const f = filter.toLowerCase();
            filtered = this.credentials.filter(c =>
                c.label.toLowerCase().includes(f) ||
                c.login.toLowerCase().includes(f) ||
                (c.url || '').toLowerCase().includes(f) ||
                (c.folder || '').toLowerCase().includes(f)
            );
        }

        if (filtered.length === 0) {
            el.innerHTML = '<div class="empty-state"><div class="empty-state-text">Nenhum resultado encontrado</div></div>';
            return;
        }

        el.innerHTML = filtered.map(c => this.renderCredItem(c, false)).join('');
        this.attachListeners(el);
    }

    // ── Render credential item ──
    renderCredItem(cred, showScore) {
        const scoreHtml = showScore && cred.matchScore > 0
            ? `<span class="cred-item-score">${cred.matchScore}%</span>` : '';
        const isMatched = showScore && cred.matchScore > 30;

        return `
            <div class="cred-item ${isMatched ? 'matched' : ''}" data-id="${cred.id}">
                <div class="cred-item-top">
                    <span class="cred-item-label">${this.escapeHtml(cred.label || cred.login)}</span>
                    ${scoreHtml}
                </div>
                <div class="cred-item-user">${this.escapeHtml(cred.login)}</div>
                ${cred.folder ? `<div class="cred-item-folder">📁 ${this.escapeHtml(cred.folder)}</div>` : ''}
                <div class="cred-item-actions">
                    <button class="cred-action" data-type="both">Preencher</button>
                    <button class="cred-action" data-type="user">Usuário</button>
                    <button class="cred-action" data-type="password">Senha</button>
                </div>
            </div>`;
    }

    attachListeners(container) {
        container.querySelectorAll('.cred-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = e.target.closest('.cred-item');
                const credId = item.dataset.id;
                const fillType = e.target.dataset.type;
                this.autofillCredential(credId, fillType);
            });
        });
    }

    async autofillCredential(credId, fillType) {
        const cred = this.credentials.find(c => c.id == credId);
        if (!cred) return;

        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        try {
            await chrome.tabs.sendMessage(tab.id, {
                action: 'autofill',
                data: { login: cred.login, password: cred.password, fillType }
            });
            this.showToast('Credencial preenchida!');
            setTimeout(() => window.close(), 600);
        } catch (error) {
            this.showToast('Erro ao preencher. Verifique se está em uma página web.');
        }
    }

    showToast(message) {
        const existing = document.querySelector('.copy-toast');
        if (existing) existing.remove();
        const toast = document.createElement('div');
        toast.className = 'copy-toast';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }

    // ── Blacklist de sites excluidos ──
    async renderBlacklist() {
        const el = document.getElementById('blacklist-list');
        if (!el) return;

        const data = await new Promise(resolve => chrome.storage.local.get('save_password_blacklist', resolve));
        const blacklist = data.save_password_blacklist || [];

        if (blacklist.length === 0) {
            el.innerHTML = '<div class="blacklist-empty">Nenhum site excluido</div>';
            return;
        }

        el.innerHTML = blacklist.map(domain => `
            <div class="blacklist-item" data-domain="${this.escapeHtml(domain)}">
                <span class="blacklist-item-domain">${this.escapeHtml(domain)}</span>
                <button class="blacklist-item-remove" title="Remover">&times;</button>
            </div>
        `).join('');

        el.querySelectorAll('.blacklist-item-remove').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const item = e.target.closest('.blacklist-item');
                const domain = item.dataset.domain;
                this.removeFromBlacklist(domain);
            });
        });
    }

    async removeFromBlacklist(domain) {
        const data = await new Promise(resolve => chrome.storage.local.get('save_password_blacklist', resolve));
        const blacklist = (data.save_password_blacklist || []).filter(d => d !== domain);
        await new Promise(resolve => chrome.storage.local.set({ save_password_blacklist: blacklist }, resolve));
        this.renderBlacklist();
        this.showToast(`${domain} removido da lista`);
    }

    async clearBlacklist() {
        await new Promise(resolve => chrome.storage.local.set({ save_password_blacklist: [] }, resolve));
        this.renderBlacklist();
        this.showToast('Lista de excluidos limpa');
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
