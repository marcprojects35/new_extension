// ════════════════════════════════════════════════════════════════════════════
// COFRE DE SENHAS FGF - BACKGROUND SERVICE WORKER
// ════════════════════════════════════════════════════════════════════════════

console.log('Cofre de Senhas FGF: Background service worker iniciado');

// ════════════════════════════════════════════════════════════════════════════
// EVENTOS DE INSTALAÇÃO
// ════════════════════════════════════════════════════════════════════════════

chrome.runtime.onInstalled.addListener((details) => {
    console.log('Extensão instalada:', details.reason);
    
    if (details.reason === 'install') {
        // Primeira instalação
        console.log('Primeira instalação - bem-vindo!');
        
        // Abrir popup de configuração
        chrome.action.openPopup();
    } else if (details.reason === 'update') {
        // Atualização
        console.log('Extensão atualizada para versão:', chrome.runtime.getManifest().version);
    }
});

// ════════════════════════════════════════════════════════════════════════════
// GERENCIAMENTO DE SESSÃO
// ════════════════════════════════════════════════════════════════════════════

// Verificar token periodicamente (a cada hora)
setInterval(async () => {
    const { session, config } = await chrome.storage.local.get(['session', 'config']);

    if (session && session.token) {
        try {
            const payload = JSON.parse(atob(session.token.split('.')[1]));
            const expiration = payload.exp * 1000;

            if (Date.now() > expiration) {
                console.log('Token expirado - tentando re-autenticar');
                await chrome.storage.local.remove(['session', 'credentials']);

                // Tentar re-autenticar com credenciais salvas na config
                if (config && config.username && config.password && config.apikey) {
                    try {
                        const apiUrl = config.api_url.replace(/\/$/, '') + '/api/index.php';
                        const authUrl = `${apiUrl}/authorize`;

                        // Tentar form-urlencoded primeiro (contorna bug TeamPass #3893)
                        let response = await fetch(authUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: new URLSearchParams({
                                login: config.username,
                                password: config.password,
                                apikey: config.apikey
                            })
                        });

                        // Fallback para JSON se form-urlencoded não funcionar
                        if (!response.ok) {
                            response = await fetch(authUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    login: config.username,
                                    password: config.password,
                                    apikey: config.apikey
                                })
                            });
                        }

                        if (response.ok) {
                            const result = await response.json();
                            if (result.token) {
                                const newPayload = JSON.parse(atob(result.token.split('.')[1]));
                                await chrome.storage.local.set({
                                    session: {
                                        token: result.token,
                                        user: {
                                            username: newPayload.username || config.username
                                        }
                                    }
                                });
                                console.log('Re-autenticação automática bem-sucedida');
                            }
                        }
                    } catch (reAuthError) {
                        console.error('Erro na re-autenticação:', reAuthError);
                    }
                }
            }
        } catch (error) {
            console.error('Erro ao verificar token:', error);
        }
    }
}, 3600000); // 1 hora

// ════════════════════════════════════════════════════════════════════════════
// ATALHOS DE TECLADO
// ════════════════════════════════════════════════════════════════════════════

chrome.commands.onCommand.addListener((command) => {
    console.log('Comando recebido:', command);
    
    if (command === 'open-popup') {
        chrome.action.openPopup();
    }
});

// ════════════════════════════════════════════════════════════════════════════
// MENSAGENS
// ════════════════════════════════════════════════════════════════════════════

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log('Mensagem recebida no background:', message);

    if (message.action === 'notify') {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Cofre de Senhas FGF',
            message: message.message
        });
    }

    if (message.action === 'save_credential') {
        saveCredentialToTeamPass(message.data).then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        return true;
    }

    if (message.action === 'get_folders') {
        fetchTeamPassFolders().then(result => {
            sendResponse(result);
        }).catch(error => {
            sendResponse({ success: false, folders: [], error: error.message });
        });
        return true;
    }

    return true;
});

// ════════════════════════════════════════════════════════════════════════════
// SALVAR CREDENCIAL NO TEAMPASS
// ════════════════════════════════════════════════════════════════════════════

function extractDomain(url) {
    if (!url) return '';
    try {
        return new URL(url).hostname.replace('www.', '').toLowerCase();
    } catch (e) {
        return url.replace(/https?:\/\//, '').split('/')[0].replace('www.', '').toLowerCase();
    }
}

async function fetchTeamPassFolders() {
    const { config, session } = await chrome.storage.local.get(['config', 'session']);

    if (!config || !config.api_url) {
        return { success: false, folders: [] };
    }

    const baseUrl = config.api_url.replace(/\/$/, '');
    const apiUrl = `${baseUrl}/api/index.php`;
    let token = session ? session.token : null;

    // Se nao tem token, tentar autenticar
    if (!token && config.username && config.password && config.apikey) {
        const authResult = await backgroundAuthenticate(apiUrl, config);
        if (authResult.token) token = authResult.token;
    }

    const folders = [];

    // Estrategia 1: API legada - /read/userfolders/all
    if (config.apikey) {
        try {
            const foldersUrl = `${apiUrl}/read/userfolders/all?apikey=${encodeURIComponent(config.apikey)}`;
            const response = await fetch(foldersUrl);
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    data.forEach(f => {
                        if (f && (f.id || f.id === 0)) {
                            folders.push({ id: f.id, title: f.title || f.name || f.label || `Pasta ${f.id}` });
                        }
                    });
                } else if (typeof data === 'object') {
                    Object.entries(data).forEach(([key, val]) => {
                        if (!isNaN(key)) {
                            folders.push({ id: parseInt(key), title: (typeof val === 'string' ? val : val.title || val.name || `Pasta ${key}`) });
                        }
                    });
                }
            }
        } catch (e) {
            console.log('[Background] Erro ao buscar pastas (legacy):', e.message);
        }
    }

    // Estrategia 2: JWT - /folders
    if (folders.length === 0 && token) {
        try {
            const response = await fetch(`${apiUrl}/folders`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                if (Array.isArray(data)) {
                    data.forEach(f => {
                        if (f && (f.id || f.id === 0)) {
                            folders.push({ id: f.id, title: f.title || f.name || f.label || `Pasta ${f.id}` });
                        }
                    });
                }
            }
        } catch (e) {
            console.log('[Background] Erro ao buscar pastas (JWT):', e.message);
        }
    }

    // Estrategia 3: Extrair pastas unicas das credenciais salvas localmente
    if (folders.length === 0) {
        const { credentials } = await chrome.storage.local.get('credentials');
        if (credentials && credentials.length > 0) {
            const seen = new Set();
            credentials.forEach(cred => {
                if (cred.folder && !seen.has(cred.folder)) {
                    seen.add(cred.folder);
                    folders.push({ id: cred.folder, title: cred.folder });
                }
            });
        }
    }

    console.log(`[Background] ${folders.length} pastas encontradas`);
    return { success: true, folders };
}

async function saveCredentialToTeamPass(data) {
    const { label, login, password, url, folderId } = data;
    console.log('[Background] Salvando credencial:', { label, login, url, folderId });

    const { config, session } = await chrome.storage.local.get(['config', 'session']);

    if (!config || !config.api_url) {
        return { success: false, error: 'Extensao nao configurada' };
    }

    const baseUrl = config.api_url.replace(/\/$/, '');
    const apiUrl = `${baseUrl}/api/index.php`;
    let token = session ? session.token : null;
    let authMode = token ? 'jwt' : (config.apikey ? 'apikey' : null);

    // Se nao tem token, tentar autenticar
    if (!token && config.username && config.password && config.apikey) {
        const authResult = await backgroundAuthenticate(apiUrl, config);
        if (authResult.token) {
            token = authResult.token;
            authMode = 'jwt';
        } else if (authResult.apikey) {
            authMode = 'apikey';
        } else {
            return { success: false, error: 'Falha na autenticacao' };
        }
    }

    const itemData = {
        label: label || url,
        login,
        pwd: password,
        url: url || '',
        folder_id: folderId || 0
    };

    // Tentar salvar via API
    let saveResult = null;

    if (authMode === 'jwt' && token) {
        // Estrategia 1: JWT + JSON
        try {
            const response = await fetch(`${apiUrl}/item`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(itemData)
            });
            if (response.ok) {
                const result = await response.json();
                saveResult = { success: true, itemId: result.id || result.item_id || null };
            }
        } catch (e) {
            console.log('[Background] JWT json falhou:', e.message);
        }

        // Estrategia 2: JWT + form-urlencoded
        if (!saveResult) {
            try {
                const response = await fetch(`${apiUrl}/item`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/x-www-form-urlencoded'
                    },
                    body: new URLSearchParams(itemData)
                });
                if (response.ok) {
                    const result = await response.json();
                    saveResult = { success: true, itemId: result.id || result.item_id || null };
                }
            } catch (e) {
                console.log('[Background] JWT form falhou:', e.message);
            }
        }
    }

    if (!saveResult && authMode === 'apikey' && config.apikey) {
        // Estrategia 3: API legada
        try {
            const encoded = btoa(new TextEncoder().encode(JSON.stringify(itemData)).reduce((s, b) => s + String.fromCharCode(b), ''));
            const addUrl = `${apiUrl}/add/item/${encoded}?apikey=${encodeURIComponent(config.apikey)}`;
            const response = await fetch(addUrl, { method: 'POST' });
            if (response.ok) {
                const result = await response.json();
                saveResult = { success: true, itemId: result.id || result.item_id || null };
            }
        } catch (e) {
            console.log('[Background] Legacy falhou:', e.message);
        }
    }

    if (!saveResult) {
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Cofre de Senhas FGF',
            message: 'Erro ao salvar credencial no TeamPass'
        });
        return { success: false, error: 'Nao foi possivel salvar no TeamPass' };
    }

    // Atualizar cache local de credenciais (com deduplicacao)
    const { credentials } = await chrome.storage.local.get('credentials');
    let currentCreds = credentials || [];

    const newCred = {
        id: saveResult.itemId || `local-${Date.now()}`,
        label: itemData.label,
        login: itemData.login,
        password: itemData.pwd,
        url: itemData.url,
        folder: data.folderName || ''
    };

    // Remover duplicatas: mesmo login + mesmo dominio
    const newDomain = extractDomain(newCred.url);
    currentCreds = currentCreds.filter(existing => {
        if (existing.login !== newCred.login) return true;
        const existingDomain = extractDomain(existing.url);
        return existingDomain !== newDomain;
    });

    currentCreds.push(newCred);
    await chrome.storage.local.set({ credentials: currentCreds });

    chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon128.png',
        title: 'Cofre de Senhas FGF',
        message: `Credencial para ${login} salva com sucesso!`
    });

    return saveResult;
}

async function backgroundAuthenticate(apiUrl, config) {
    const authUrl = `${apiUrl}/authorize`;
    const strategies = [
        { label: 'form-urlencoded', options: {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ login: config.username, password: config.password, apikey: config.apikey })
        }},
        { label: 'json', options: {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: config.username, password: config.password, apikey: config.apikey })
        }}
    ];

    for (const strategy of strategies) {
        try {
            const response = await fetch(authUrl, strategy.options);
            if (response.ok) {
                const result = await response.json();
                if (result.token) {
                    // Atualizar sessao
                    const payload = JSON.parse(atob(result.token.split('.')[1]));
                    await chrome.storage.local.set({
                        session: { token: result.token, user: { username: payload.username || config.username } }
                    });
                    return { token: result.token };
                }
            }
        } catch (e) {
            console.log(`[Background] Auth ${strategy.label} falhou:`, e.message);
        }
    }

    // Fallback legada
    if (config.apikey) {
        try {
            const legacyUrl = `${apiUrl}/read/userpw/${encodeURIComponent(config.username)}?apikey=${encodeURIComponent(config.apikey)}`;
            const response = await fetch(legacyUrl);
            if (response.ok) return { apikey: true };
        } catch (e) {}
    }

    return {};
}

// ════════════════════════════════════════════════════════════════════════════
// BADGE (CONTADOR NO ÍCONE)
// ════════════════════════════════════════════════════════════════════════════

async function updateBadge() {
    const { credentials } = await chrome.storage.local.get('credentials');
    
    if (credentials && credentials.length > 0) {
        chrome.action.setBadgeText({ 
            text: credentials.length > 99 ? '99+' : credentials.length.toString() 
        });
        chrome.action.setBadgeBackgroundColor({ color: '#0077b6' });
    } else {
        chrome.action.setBadgeText({ text: '' });
    }
}

// Atualizar badge quando credenciais mudarem
chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.credentials) {
        updateBadge();
    }
});

// Atualizar badge ao iniciar
updateBadge();

// ════════════════════════════════════════════════════════════════════════════
// CONTEXTO MENU (MENU DE CONTEXTO/DIREITO)
// ════════════════════════════════════════════════════════════════════════════

chrome.runtime.onInstalled.addListener(() => {
    // Criar item no menu de contexto
    chrome.contextMenus.create({
        id: 'cofre-senhas-autofill',
        title: 'Preencher com Cofre de Senhas FGF',
        contexts: ['editable']
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === 'cofre-senhas-autofill') {
        // Abrir popup para selecionar credencial
        chrome.action.openPopup();
    }
});

// ════════════════════════════════════════════════════════════════════════════
// MANTER ALIVE (Service Worker)
// ════════════════════════════════════════════════════════════════════════════

// Service workers podem ser encerrados pelo Chrome após inatividade
// Este código mantém o service worker ativo
let keepAliveInterval;

function keepAlive() {
    if (keepAliveInterval) {
        clearInterval(keepAliveInterval);
    }
    
    keepAliveInterval = setInterval(() => {
        console.log('Keep alive ping');
    }, 20000); // 20 segundos
}

keepAlive();

chrome.runtime.onStartup.addListener(() => {
    console.log('Chrome iniciado - reativando service worker');
    keepAlive();
});
