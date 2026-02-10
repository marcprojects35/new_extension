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
        // Criar notificação
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icons/icon128.png',
            title: 'Cofre de Senhas FGF',
            message: message.message
        });
    }
    
    return true;
});

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
