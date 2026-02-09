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
    const { session } = await chrome.storage.local.get('session');
    
    if (session && session.token) {
        // Verificar se o token ainda é válido
        try {
            const payload = JSON.parse(atob(session.token.split('.')[1]));
            const expiration = payload.exp * 1000; // Converter para ms
            
            if (Date.now() > expiration) {
                console.log('Token expirado - limpando sessão');
                await chrome.storage.local.remove(['session', 'credentials']);
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
