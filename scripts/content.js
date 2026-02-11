// ════════════════════════════════════════════════════════════════════════════
// COFRE DE SENHAS FGF - CONTENT SCRIPT ULTRA-AVANÇADO
// Sistema de precisão máxima para autopreenchimento
// ════════════════════════════════════════════════════════════════════════════

(function() {
    'use strict';

    const DEBUG = true; // Ativar logs detalhados
    const MAX_RETRIES = 5; // Máximo de tentativas por campo
    const RETRY_DELAYS = [0, 100, 300, 500, 1000]; // Delays progressivos

    function log(...args) {
        if (DEBUG) console.log('[Cofre FGF v3.0]', ...args);
    }

    log('🚀 Content script carregado - Versão Ultra-Avançada v3.0');

    // ════════════════════════════════════════════════════════════════════════════
    // DETECÇÃO DE FRAMEWORKS
    // ════════════════════════════════════════════════════════════════════════════

    class FrameworkDetector {
        static detect() {
            const frameworks = {
                react: this.detectReact(),
                vue: this.detectVue(),
                angular: this.detectAngular(),
                jquery: this.detectJQuery(),
                backbone: this.detectBackbone(),
                ember: this.detectEmber()
            };

            const detected = Object.keys(frameworks).filter(k => frameworks[k]);
            log('🎯 Frameworks detectados:', detected.length > 0 ? detected : 'Nenhum');

            return frameworks;
        }

        static detectReact() {
            return !!(
                window.React ||
                window.ReactDOM ||
                document.querySelector('[data-reactroot]') ||
                document.querySelector('[data-reactid]') ||
                Array.from(document.querySelectorAll('*')).some(el => {
                    return Object.keys(el).some(key => key.startsWith('__react'));
                })
            );
        }

        static detectVue() {
            return !!(
                window.Vue ||
                document.querySelector('[data-v-]') ||
                document.querySelector('[data-server-rendered]') ||
                Array.from(document.querySelectorAll('*')).some(el => {
                    return el.__vue__ || el.__vue_app__;
                })
            );
        }

        static detectAngular() {
            return !!(
                window.angular ||
                window.ng ||
                document.querySelector('[ng-app]') ||
                document.querySelector('[ng-controller]') ||
                document.querySelector('[ng-version]') ||
                Array.from(document.querySelectorAll('*')).some(el => {
                    return el.getAttribute('ng-version') !== null;
                })
            );
        }

        static detectJQuery() {
            return !!(window.jQuery || window.$);
        }

        static detectBackbone() {
            return !!window.Backbone;
        }

        static detectEmber() {
            return !!window.Ember;
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // SISTEMA DE DETECÇÃO ULTRA-AVANÇADO DE CAMPOS
    // ════════════════════════════════════════════════════════════════════════════

    class FieldDetector {
        constructor() {
            this.frameworks = FrameworkDetector.detect();
            
            // Padrões expandidos para identificação de campos de username
            this.usernamePatterns = {
                exact: ['username', 'user', 'login', 'email', 'userid', 'user-name', 
                        'user_name', 'userName', 'account', 'identifier', 'loginid'],
                partial: ['user', 'login', 'email', 'account', 'id', 'name', 'mail', 
                         'usuario', 'conta', 'acesso', 'identifier'],
                negative: ['search', 'query', 'filter', 'first', 'last', 'display', 
                          'full', 'company', 'organization', 'busca', 'pesqui']
            };

            // Padrões expandidos para identificação de campos de senha
            this.passwordPatterns = {
                exact: ['password', 'passwd', 'pwd', 'pass', 'senha', 'secret', 'pin'],
                partial: ['password', 'passwd', 'pwd', 'pass', 'senha', 'secret', 'pin', 'code'],
                negative: ['captcha', 'confirm', 'repeat', 'new', 'old', 'current', 'retype',
                          'again', 'verificat', 'confirmation', 'confirma']
            };

            // Autocomplete hints expandidos
            this.autocompleteHints = {
                username: ['username', 'email', 'tel', 'email address', 'login'],
                password: ['current-password', 'password', 'new-password']
            };

            // Padrões de label visual (texto próximo ao campo)
            this.visualLabels = {
                username: /\b(user|login|email|e-?mail|account|acesso|usuário|conta)\b/i,
                password: /\b(password|passwd|senha|pass|secret|código|pin)\b/i
            };
        }

        /**
         * Verifica se um elemento está visível
         */
        isVisible(element) {
            if (!element) return false;

            // Verificar display none em toda a cadeia de parents
            let el = element;
            while (el && el !== document.body) {
                const style = window.getComputedStyle(el);
                if (style.display === 'none') return false;
                if (style.visibility === 'hidden') return false;
                if (parseFloat(style.opacity) === 0) return false;
                el = el.parentElement;
            }

            const rect = element.getBoundingClientRect();
            // Aceitar campos com dimensões mínimas (alguns sites usam campos muito pequenos)
            if (rect.width < 1 && rect.height < 1) return false;

            return true;
        }

        /**
         * Verifica se o campo está desabilitado ou readonly
         */
        isEditable(element) {
            return !element.disabled && !element.readOnly && !element.hasAttribute('readonly');
        }

        /**
         * Analisa o contexto visual ao redor do campo (labels, texto próximo)
         */
        getVisualContext(input) {
            const context = [];
            
            // Buscar texto em elementos próximos (siblings, parent, etc)
            let current = input;
            for (let i = 0; i < 3; i++) { // Subir até 3 níveis
                if (!current.parentElement) break;
                
                // Pegar texto de todos os elementos no mesmo container
                const containerText = current.parentElement.textContent || '';
                if (containerText) {
                    context.push(containerText.trim().substring(0, 200));
                }
                
                current = current.parentElement;
            }

            // Buscar labels visuais próximos
            const siblings = Array.from(input.parentElement?.children || []);
            siblings.forEach(sibling => {
                if (sibling !== input && sibling.textContent) {
                    context.push(sibling.textContent.trim().substring(0, 100));
                }
            });

            return context.join(' ').toLowerCase();
        }

        /**
         * Calcula score ULTRA-PRECISO de um campo para username
         */
        scoreUsernameField(input) {
            let score = 0;
            const attrs = this.getFieldAttributes(input);
            const visualContext = this.getVisualContext(input);

            log(`📊 Analisando username field:`, {
                element: input,
                type: attrs.type,
                name: attrs.name,
                id: attrs.id,
                visualContext: visualContext.substring(0, 100)
            });

            // Type correto = +50
            if (attrs.type === 'email') score += 60;
            if (attrs.type === 'text') score += 25;
            if (attrs.type === 'tel') score += 20;

            // Autocomplete = +50 (aumentado)
            if (this.autocompleteHints.username.some(hint => 
                attrs.autocomplete?.toLowerCase().includes(hint))) {
                score += 50;
            }

            // Name exato = +40 (aumentado)
            if (this.usernamePatterns.exact.some(pattern => 
                attrs.name?.toLowerCase() === pattern)) {
                score += 40;
            }

            // ID exato = +40 (aumentado)
            if (this.usernamePatterns.exact.some(pattern => 
                attrs.id?.toLowerCase() === pattern)) {
                score += 40;
            }

            // Name parcial = +20
            if (this.usernamePatterns.partial.some(pattern => 
                attrs.name?.toLowerCase().includes(pattern))) {
                score += 20;
            }

            // ID parcial = +20
            if (this.usernamePatterns.partial.some(pattern => 
                attrs.id?.toLowerCase().includes(pattern))) {
                score += 20;
            }

            // Class parcial = +15
            if (this.usernamePatterns.partial.some(pattern => 
                attrs.className?.toLowerCase().includes(pattern))) {
                score += 15;
            }

            // Placeholder = +15
            if (this.usernamePatterns.partial.some(pattern => 
                attrs.placeholder?.toLowerCase().includes(pattern))) {
                score += 15;
            }

            // Aria-label = +15
            if (this.usernamePatterns.partial.some(pattern => 
                attrs.ariaLabel?.toLowerCase().includes(pattern))) {
                score += 15;
            }

            // Label associado = +20
            const label = this.getAssociatedLabel(input);
            if (label && this.usernamePatterns.partial.some(pattern => 
                label.toLowerCase().includes(pattern))) {
                score += 20;
            }

            // NOVO: Contexto visual = +25
            if (this.visualLabels.username.test(visualContext)) {
                score += 25;
                log('✓ Contexto visual de username detectado');
            }

            // NOVO: Data attributes = +10
            if (attrs.dataAttributes.some(attr => 
                this.usernamePatterns.partial.some(pattern => attr.includes(pattern)))) {
                score += 10;
            }

            // Penalidades por padrões negativos = -30 (aumentado)
            if (this.usernamePatterns.negative.some(pattern => 
                attrs.name?.toLowerCase().includes(pattern) ||
                attrs.id?.toLowerCase().includes(pattern) ||
                attrs.className?.toLowerCase().includes(pattern))) {
                score -= 30;
            }

            // Penalidade se estiver em formulário de registro = -10
            if (this.isSignupForm(input)) {
                score -= 10;
            }

            // BONUS: Primeiro campo de texto em form com senha = +30
            if (this.isFirstTextFieldInFormWithPassword(input)) {
                score += 30;
                log('✓ Primeiro campo de texto em form com senha');
            }

            // BONUS: Único campo de texto antes de senha = +40
            if (this.isOnlyTextFieldBeforePassword(input)) {
                score += 40;
                log('✓ Único campo de texto antes de senha');
            }

            log(`📊 Score final username: ${score}`);
            return Math.max(0, score);
        }

        /**
         * Calcula score ULTRA-PRECISO de um campo para password
         */
        scorePasswordField(input) {
            let score = 0;
            const attrs = this.getFieldAttributes(input);
            const visualContext = this.getVisualContext(input);

            log(`📊 Analisando password field:`, {
                element: input,
                type: attrs.type,
                name: attrs.name,
                id: attrs.id,
                visualContext: visualContext.substring(0, 100)
            });

            // Type correto = +150 (MUITO importante!)
            if (attrs.type === 'password') score += 150;

            // Autocomplete = +40
            if (this.autocompleteHints.password.some(hint => 
                attrs.autocomplete?.toLowerCase().includes(hint))) {
                score += 40;
            }

            // Name exato = +35
            if (this.passwordPatterns.exact.some(pattern => 
                attrs.name?.toLowerCase() === pattern)) {
                score += 35;
            }

            // ID exato = +35
            if (this.passwordPatterns.exact.some(pattern => 
                attrs.id?.toLowerCase() === pattern)) {
                score += 35;
            }

            // Name/ID parcial = +15
            if (this.passwordPatterns.partial.some(pattern => 
                attrs.name?.toLowerCase().includes(pattern) ||
                attrs.id?.toLowerCase().includes(pattern))) {
                score += 15;
            }

            // NOVO: Contexto visual = +20
            if (this.visualLabels.password.test(visualContext)) {
                score += 20;
                log('✓ Contexto visual de senha detectado');
            }

            // Penalidades FORTES - NÃO queremos confirmação, nova senha, etc = -100
            if (this.passwordPatterns.negative.some(pattern => 
                attrs.name?.toLowerCase().includes(pattern) ||
                attrs.id?.toLowerCase().includes(pattern) ||
                attrs.placeholder?.toLowerCase().includes(pattern) ||
                visualContext.includes(pattern))) {
                score -= 100;
                log('⚠️ Padrão negativo detectado em campo de senha');
            }

            // Penalidade forte para formulários de registro = -40
            if (this.isSignupForm(input)) {
                score -= 40;
            }

            // BONUS: Primeiro campo password no form = +30
            if (this.isFirstPasswordFieldInForm(input)) {
                score += 30;
                log('✓ Primeiro campo password no form');
            }

            // BONUS: Único campo password = +40
            if (this.isOnlyPasswordField(input)) {
                score += 40;
                log('✓ Único campo password no form');
            }

            log(`📊 Score final password: ${score}`);
            return Math.max(0, score);
        }

        /**
         * Extrai TODOS os atributos relevantes de um input
         */
        getFieldAttributes(input) {
            // Pegar todos os data-* attributes
            const dataAttributes = [];
            Array.from(input.attributes).forEach(attr => {
                if (attr.name.startsWith('data-')) {
                    dataAttributes.push(attr.name + '=' + attr.value);
                }
            });

            return {
                type: input.type?.toLowerCase(),
                name: input.name,
                id: input.id,
                className: input.className,
                placeholder: input.placeholder,
                autocomplete: input.autocomplete,
                ariaLabel: input.getAttribute('aria-label'),
                title: input.title,
                dataAttributes: dataAttributes,
                role: input.getAttribute('role'),
                pattern: input.pattern,
                required: input.required,
                maxLength: input.maxLength,
                minLength: input.minLength,
                tabIndex: input.tabIndex
            };
        }

        /**
         * Busca label associado ao input (VERSÃO MELHORADA)
         */
        getAssociatedLabel(input) {
            // Label com atributo "for"
            if (input.id) {
                const label = document.querySelector(`label[for="${input.id}"]`);
                if (label) return label.textContent;
            }

            // Label parent
            const parentLabel = input.closest('label');
            if (parentLabel) return parentLabel.textContent;

            // Label irmão anterior
            let sibling = input.previousElementSibling;
            let attempts = 0;
            while (sibling && attempts < 3) {
                if (sibling.tagName === 'LABEL') {
                    return sibling.textContent;
                }
                sibling = sibling.previousElementSibling;
                attempts++;
            }

            // Label irmão posterior (menos comum mas acontece)
            sibling = input.nextElementSibling;
            attempts = 0;
            while (sibling && attempts < 2) {
                if (sibling.tagName === 'LABEL') {
                    return sibling.textContent;
                }
                sibling = sibling.nextElementSibling;
                attempts++;
            }

            return null;
        }

        /**
         * Verifica se é um formulário de registro/signup
         */
        isSignupForm(input) {
            const form = input.closest('form');
            if (!form) return false;

            const formAttrs = [
                form.action,
                form.id,
                form.className,
                form.name,
                form.getAttribute('data-form-type')
            ].join(' ').toLowerCase();

            const signupKeywords = ['signup', 'sign-up', 'register', 'registration', 
                                   'create', 'join', 'novo', 'cadastr', 'regist'];
            
            const hasSignupKeyword = signupKeywords.some(kw => formAttrs.includes(kw));

            // Verificar se tem múltiplos campos password (indicativo de registro)
            if (form.querySelectorAll('input[type="password"]').length > 1) {
                return true;
            }

            return hasSignupKeyword;
        }

        /**
         * NOVO: Verifica se é o primeiro campo de texto em form com senha
         */
        isFirstTextFieldInFormWithPassword(input) {
            const form = input.closest('form');
            if (!form) return false;

            const hasPassword = form.querySelector('input[type="password"]') !== null;
            if (!hasPassword) return false;

            const textInputs = Array.from(form.querySelectorAll('input[type="text"], input[type="email"], input[type="tel"]'))
                .filter(inp => this.isVisible(inp) && this.isEditable(inp));

            return textInputs.length > 0 && textInputs[0] === input;
        }

        /**
         * NOVO: Verifica se é o único campo de texto antes de senha
         */
        isOnlyTextFieldBeforePassword(input) {
            const form = input.closest('form') || document.body;
            
            const allInputs = Array.from(form.querySelectorAll('input'))
                .filter(inp => this.isVisible(inp) && this.isEditable(inp));

            const inputIndex = allInputs.indexOf(input);
            if (inputIndex === -1) return false;

            // Contar campos de texto antes desta entrada
            let textFieldsBefore = 0;
            for (let i = 0; i < inputIndex; i++) {
                const type = allInputs[i].type?.toLowerCase();
                if (type === 'text' || type === 'email' || type === 'tel') {
                    textFieldsBefore++;
                }
            }

            // Verificar se há senha depois
            let hasPasswordAfter = false;
            for (let i = inputIndex + 1; i < allInputs.length; i++) {
                if (allInputs[i].type === 'password') {
                    hasPasswordAfter = true;
                    break;
                }
            }

            return textFieldsBefore === 0 && hasPasswordAfter;
        }

        /**
         * NOVO: Verifica se é o primeiro campo password no form
         */
        isFirstPasswordFieldInForm(input) {
            const form = input.closest('form') || document.body;
            
            const passwordInputs = Array.from(form.querySelectorAll('input[type="password"]'))
                .filter(inp => this.isVisible(inp) && this.isEditable(inp));

            return passwordInputs.length > 0 && passwordInputs[0] === input;
        }

        /**
         * NOVO: Verifica se é o único campo password
         */
        isOnlyPasswordField(input) {
            const form = input.closest('form') || document.body;
            
            const passwordInputs = Array.from(form.querySelectorAll('input[type="password"]'))
                .filter(inp => this.isVisible(inp) && this.isEditable(inp));

            return passwordInputs.length === 1 && passwordInputs[0] === input;
        }

        /**
         * Busca TODOS os campos de input visíveis e editáveis (VERSÃO MELHORADA)
         */
        getAllInputs() {
            const inputs = [];
            const seen = new WeakSet(); // Evitar duplicatas

            // Função auxiliar para adicionar input
            const addInput = (input) => {
                if (seen.has(input)) return;
                if (this.isVisible(input) && this.isEditable(input)) {
                    inputs.push(input);
                    seen.add(input);
                }
            };

            // 1. Buscar em document normal
            document.querySelectorAll('input').forEach(addInput);

            // 2. Buscar em Shadow DOM
            document.querySelectorAll('*').forEach(el => {
                if (el.shadowRoot) {
                    el.shadowRoot.querySelectorAll('input').forEach(addInput);
                }
            });

            // 3. Buscar em iFrames (mesma origem)
            try {
                document.querySelectorAll('iframe').forEach(iframe => {
                    try {
                        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
                        if (iframeDoc) {
                            iframeDoc.querySelectorAll('input').forEach(addInput);
                        }
                    } catch (e) {
                        // Cross-origin iframe, ignorar
                    }
                });
            } catch (e) {
                log('⚠️ Não foi possível acessar iframes:', e.message);
            }

            log(`📋 Total de inputs encontrados: ${inputs.length}`);
            return inputs;
        }

        /**
         * Encontra o melhor campo de username (VERSÃO ULTRA-MELHORADA)
         */
        findUsernameField() {
            log('🔍 Iniciando busca de campo username...');
            const allInputs = this.getAllInputs();
            
            // Filtrar candidatos válidos
            const candidates = allInputs.filter(input => {
                const type = input.type?.toLowerCase();
                return type === 'text' || type === 'email' || type === 'tel';
            });

            if (candidates.length === 0) {
                log('❌ Nenhum candidato a username encontrado');
                return null;
            }

            log(`📊 ${candidates.length} candidatos a username encontrados`);

            // Calcular score para cada candidato
            const scored = candidates.map(input => ({
                input,
                score: this.scoreUsernameField(input)
            })).filter(item => item.score > 0);

            if (scored.length === 0) {
                log('⚠️ Nenhum campo com score positivo, usando primeiro candidato');
                return candidates[0];
            }

            // Ordenar por score (maior primeiro)
            scored.sort((a, b) => b.score - a.score);

            // Log top 3
            const top3 = scored.slice(0, 3);
            log('🏆 Top 3 campos username:', top3.map(s => ({
                score: s.score,
                type: s.input.type,
                name: s.input.name,
                id: s.input.id,
                placeholder: s.input.placeholder
            })));

            const winner = scored[0].input;
            log(`✅ Campo username selecionado (score: ${scored[0].score}):`, {
                name: winner.name,
                id: winner.id,
                type: winner.type
            });

            return winner;
        }

        /**
         * Encontra o melhor campo de password (VERSÃO ULTRA-MELHORADA)
         */
        findPasswordField() {
            log('🔍 Iniciando busca de campo password...');
            const allInputs = this.getAllInputs();
            
            // Filtrar apenas campos password
            const candidates = allInputs.filter(input => 
                input.type?.toLowerCase() === 'password'
            );

            if (candidates.length === 0) {
                log('❌ Nenhum campo password encontrado');
                return null;
            }

            log(`📊 ${candidates.length} candidatos a password encontrados`);

            // Calcular score para cada candidato
            const scored = candidates.map(input => ({
                input,
                score: this.scorePasswordField(input)
            })).filter(item => item.score > 0);

            if (scored.length === 0) {
                log('⚠️ Nenhum campo com score positivo, usando primeiro password');
                return candidates[0];
            }

            // Ordenar por score (maior primeiro)
            scored.sort((a, b) => b.score - a.score);

            // Log top 3
            const top3 = scored.slice(0, 3);
            log('🏆 Top 3 campos password:', top3.map(s => ({
                score: s.score,
                name: s.input.name,
                id: s.input.id,
                placeholder: s.input.placeholder
            })));

            const winner = scored[0].input;
            log(`✅ Campo password selecionado (score: ${scored[0].score}):`, {
                name: winner.name,
                id: winner.id
            });

            return winner;
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // SISTEMA ULTRA-AVANÇADO DE PREENCHIMENTO COM RETRY INTELIGENTE
    // ════════════════════════════════════════════════════════════════════════════

    class FieldFiller {
        /**
         * Preenche um campo usando múltiplas estratégias COM RETRY AUTOMÁTICO
         */
        static async fillField(field, value, frameworks) {
            if (!field || !value) {
                log('❌ Campo ou valor inválido');
                return false;
            }

            log(`🎯 Preenchendo campo: ${field.name || field.id || 'unnamed'}`, { 
                value: value.substring(0, 20) + '...',
                type: field.type
            });

            // Destacar campo visualmente
            this.highlightField(field);

            // Tentar múltiplas vezes com delays
            for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
                log(`🔄 Tentativa ${attempt + 1}/${MAX_RETRIES}`);

                // Aguardar delay se não for primeira tentativa
                if (attempt > 0) {
                    await this.delay(RETRY_DELAYS[attempt]);
                }

                // Focar no campo antes de preencher
                await this.focusField(field);

                // Escolher estratégia baseada no framework e tentativa
                let success = false;

                if (attempt === 0) {
                    // Primeira tentativa: Setter nativo (mais rápido)
                    success = await this.tryNativeSetter(field, value, frameworks);
                } else if (attempt === 1) {
                    // Segunda tentativa: Simulação rápida
                    success = await this.tryFastSimulation(field, value);
                } else if (attempt === 2) {
                    // Terceira tentativa: Simulação completa
                    success = await this.tryFullSimulation(field, value);
                } else if (attempt === 3) {
                    // Quarta tentativa: Força bruta
                    success = await this.tryForceFill(field, value);
                } else {
                    // Última tentativa: Todos os métodos combinados
                    success = await this.tryAllMethods(field, value, frameworks);
                }

                // Verificar se funcionou
                if (success && this.verifyFilled(field, value)) {
                    log(`✅ Campo preenchido com sucesso na tentativa ${attempt + 1}`);
                    await this.blurField(field);
                    return true;
                }

                log(`⚠️ Tentativa ${attempt + 1} falhou`);
            }

            log(`❌ Falha ao preencher campo após ${MAX_RETRIES} tentativas`);
            return false;
        }

        /**
         * Aguarda um delay
         */
        static delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        }

        /**
         * Foca no campo com tratamento especial
         */
        static async focusField(field) {
            try {
                // Scroll para o campo se necessário
                field.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await this.delay(50);

                // Focar
                field.focus();
                await this.delay(50);

                // Clicar (alguns sites precisam)
                const clickEvent = new MouseEvent('click', { bubbles: true, cancelable: true });
                field.dispatchEvent(clickEvent);
                await this.delay(50);

                return true;
            } catch (e) {
                log('⚠️ Erro ao focar campo:', e);
                return false;
            }
        }

        /**
         * Remove foco do campo
         */
        static async blurField(field) {
            try {
                await this.delay(100);
                field.blur();
                return true;
            } catch (e) {
                return false;
            }
        }

        /**
         * Método 1: Setter nativo (MELHORADO para frameworks)
         */
        static async tryNativeSetter(field, value, frameworks) {
            try {
                log('  📝 Estratégia: Setter Nativo');

                // Limpar primeiro
                field.value = '';
                await this.delay(10);

                // Obter o setter nativo do prototype
                const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype,
                    'value'
                )?.set;

                if (nativeInputValueSetter) {
                    nativeInputValueSetter.call(field, value);
                }

                // Também setar diretamente
                field.value = value;

                // Disparar eventos específicos do framework
                if (frameworks.react) {
                    this.triggerReactEvents(field, value);
                } else if (frameworks.vue) {
                    this.triggerVueEvents(field, value);
                } else if (frameworks.angular) {
                    this.triggerAngularEvents(field, value);
                } else {
                    this.triggerStandardEvents(field, value);
                }

                await this.delay(50);
                return true;
            } catch (error) {
                log('  ❌ Erro no setter nativo:', error.message);
                return false;
            }
        }

        /**
         * Método 2: Simulação rápida (sem delays)
         */
        static async tryFastSimulation(field, value) {
            try {
                log('  ⚡ Estratégia: Simulação Rápida');

                field.value = '';

                for (let i = 0; i < value.length; i++) {
                    const char = value[i];
                    field.value += char;

                    // Eventos mínimos
                    field.dispatchEvent(new InputEvent('input', {
                        data: char,
                        inputType: 'insertText',
                        bubbles: true
                    }));
                }

                this.triggerStandardEvents(field, value);
                await this.delay(50);
                return true;
            } catch (error) {
                log('  ❌ Erro na simulação rápida:', error.message);
                return false;
            }
        }

        /**
         * Método 3: Simulação completa (com delays entre caracteres)
         */
        static async tryFullSimulation(field, value) {
            return new Promise(async (resolve) => {
                try {
                    log('  🎬 Estratégia: Simulação Completa');

                    field.value = '';
                    await this.delay(50);

                    for (let i = 0; i < value.length; i++) {
                        const char = value[i];
                        field.value += char;

                        // Eventos completos de teclado
                        this.dispatchKeyboardEvent(field, 'keydown', char);
                        this.dispatchKeyboardEvent(field, 'keypress', char);
                        
                        field.dispatchEvent(new InputEvent('input', {
                            data: char,
                            inputType: 'insertText',
                            bubbles: true,
                            cancelable: true
                        }));
                        
                        this.dispatchKeyboardEvent(field, 'keyup', char);

                        // Delay entre caracteres
                        await this.delay(5);
                    }

                    this.triggerStandardEvents(field, value);
                    await this.delay(50);
                    resolve(true);
                } catch (error) {
                    log('  ❌ Erro na simulação completa:', error.message);
                    resolve(false);
                }
            });
        }

        /**
         * Método 4: Força bruta (TODOS os eventos)
         */
        static async tryForceFill(field, value) {
            try {
                log('  💪 Estratégia: Força Bruta');

                // Limpar
                field.value = '';
                field.setAttribute('value', '');
                await this.delay(10);

                // Múltiplas formas de setar
                field.value = value;
                field.setAttribute('value', value);

                // Property descriptor customizado
                try {
                    const descriptor = Object.getOwnPropertyDescriptor(field, 'value');
                    if (descriptor && descriptor.set) {
                        descriptor.set.call(field, value);
                    }
                } catch (e) {}

                // TODOS os eventos poss��veis
                const allEvents = [
                    'focus', 'click', 'mousedown', 'mouseup',
                    'keydown', 'keypress', 'keyup',
                    'input', 'change', 'textInput',
                    'blur', 'focusout'
                ];

                for (const eventType of allEvents) {
                    try {
                        const event = new Event(eventType, { bubbles: true, cancelable: true });
                        field.dispatchEvent(event);
                    } catch (e) {}
                }

                await this.delay(100);
                return true;
            } catch (error) {
                log('  ❌ Erro na força bruta:', error.message);
                return false;
            }
        }

        /**
         * Método 5: Combinação de todos os métodos
         */
        static async tryAllMethods(field, value, frameworks) {
            try {
                log('  🚀 Estratégia: Combinação Total');

                // Executar TODOS os métodos em sequência
                await this.tryNativeSetter(field, value, frameworks);
                await this.delay(50);
                
                await this.tryFastSimulation(field, value);
                await this.delay(50);
                
                await this.tryForceFill(field, value);
                await this.delay(100);

                return true;
            } catch (error) {
                log('  ❌ Erro na combinação:', error.message);
                return false;
            }
        }

        /**
         * Disparar eventos React-específicos
         */
        static triggerReactEvents(field, value) {
            log('  ⚛️ Disparando eventos React');

            // Limpar value tracker do React
            if (field._valueTracker) {
                field._valueTracker.setValue('');
            }

            // Input event com propriedades React
            const inputEvent = new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                data: value,
                inputType: 'insertText'
            });

            // Adicionar propriedades específicas do React
            Object.defineProperty(inputEvent, 'simulated', { value: false });
            Object.defineProperty(inputEvent, 'isTrusted', { value: true });

            field.dispatchEvent(inputEvent);

            // Change event
            const changeEvent = new Event('change', { bubbles: true, cancelable: true });
            field.dispatchEvent(changeEvent);

            // Blur event
            const blurEvent = new FocusEvent('blur', { bubbles: true, cancelable: true });
            field.dispatchEvent(blurEvent);
        }

        /**
         * Disparar eventos Vue-específicos
         */
        static triggerVueEvents(field, value) {
            log('  🖖 Disparando eventos Vue');

            // Vue usa principalmente input e change
            field.dispatchEvent(new InputEvent('input', {
                bubbles: true,
                cancelable: true,
                data: value
            }));

            field.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Vue 3 pode usar update:modelValue
            try {
                field.dispatchEvent(new CustomEvent('update:modelValue', {
                    detail: value,
                    bubbles: true
                }));
            } catch (e) {}
        }

        /**
         * Disparar eventos Angular-específicos
         */
        static triggerAngularEvents(field, value) {
            log('  🅰️ Disparando eventos Angular');

            // Angular precisa de input, change e blur
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            field.dispatchEvent(new Event('blur', { bubbles: true }));

            // ngModelChange (Angular forms)
            try {
                field.dispatchEvent(new CustomEvent('ngModelChange', {
                    detail: value,
                    bubbles: true
                }));
            } catch (e) {}
        }

        /**
         * Disparar eventos padrão (HTML5)
         */
        static triggerStandardEvents(field, value) {
            log('  📄 Disparando eventos padrão');

            const events = [
                new InputEvent('input', {
                    bubbles: true,
                    cancelable: true,
                    data: value,
                    inputType: 'insertText'
                }),
                new Event('change', { bubbles: true, cancelable: true }),
                new FocusEvent('blur', { bubbles: true, cancelable: true })
            ];

            events.forEach(event => {
                try {
                    field.dispatchEvent(event);
                } catch (e) {
                    log('    ⚠️ Erro ao disparar evento:', e.message);
                }
            });
        }

        /**
         * Dispara evento de teclado
         */
        static dispatchKeyboardEvent(field, type, char) {
            try {
                const event = new KeyboardEvent(type, {
                    key: char,
                    code: `Key${char.toUpperCase()}`,
                    keyCode: char.charCodeAt(0),
                    which: char.charCodeAt(0),
                    bubbles: true,
                    cancelable: true
                });
                field.dispatchEvent(event);
            } catch (e) {
                // Ignorar erros
            }
        }

        /**
         * Verifica se o campo foi preenchido corretamente
         */
        static verifyFilled(field, expectedValue) {
            const actualValue = field.value;
            const filled = actualValue === expectedValue;

            if (!filled) {
                log(`  ⚠️ Verificação falhou. Esperado: "${expectedValue}", Atual: "${actualValue}"`);
            } else {
                log(`  ✅ Verificação OK: Campo contém o valor correto`);
            }

            return filled;
        }

        /**
         * Destaca o campo visualmente
         */
        static highlightField(field) {
            if (!DEBUG) return;

            const originalBorder = field.style.border;
            const originalBoxShadow = field.style.boxShadow;
            const originalBackground = field.style.background;

            field.style.border = '3px solid #0077b6';
            field.style.boxShadow = '0 0 15px rgba(0, 119, 182, 0.6)';
            field.style.background = 'rgba(0, 119, 182, 0.05)';

            setTimeout(() => {
                field.style.border = originalBorder;
                field.style.boxShadow = originalBoxShadow;
                field.style.background = originalBackground;
            }, 2000);
        }
    }

    // ════════════════════════════════════════════════════════════════════════════
    // AUTOPREENCHIMENTO PRINCIPAL ULTRA-AVANÇADO
    // ════════════════════════════════════════════════════════════════════════════

    async function autofill(login, password, fillType) {
        log('═══════════════════════════════════════════════════════════════');
        log('🚀 Iniciando autopreenchimento ULTRA-AVANÇADO v3.0');
        log('═══════════════════════════════════════════════════════════════');
        log('Parâmetros:', { login, fillType });

        // Detectar frameworks
        const frameworks = FrameworkDetector.detect();
        const detector = new FieldDetector();

        // Detectar campos
        log('\n📍 Fase 1: Detecção de Campos');
        const usernameField = detector.findUsernameField();
        const passwordField = detector.findPasswordField();

        if (!usernameField && !passwordField) {
            log('❌ Nenhum campo de formulário encontrado!');
            showFeedback('❌ Nenhum campo de login encontrado nesta página', 'error');
            return false;
        }

        let successCount = 0;
        const results = [];

        // Preencher username
        if ((fillType === 'both' || fillType === 'user') && usernameField) {
            log('\n📍 Fase 2: Preenchendo campo de username');
            const success = await FieldFiller.fillField(usernameField, login, frameworks);
            results.push({ field: 'username', success });
            if (success) successCount++;
        } else if (fillType === 'both' || fillType === 'user') {
            log('⚠️ Campo de username não encontrado');
            results.push({ field: 'username', success: false, reason: 'not_found' });
        }

        // Pequeno delay entre campos
        if (usernameField && passwordField) {
            await FieldFiller.delay(100);
        }

        // Preencher password
        if ((fillType === 'both' || fillType === 'password') && passwordField) {
            log('\n📍 Fase 3: Preenchendo campo de senha');
            const success = await FieldFiller.fillField(passwordField, password, frameworks);
            results.push({ field: 'password', success });
            if (success) successCount++;
        } else if (fillType === 'both' || fillType === 'password') {
            log('⚠️ Campo de senha não encontrado');
            results.push({ field: 'password', success: false, reason: 'not_found' });
        }

        log('\n📊 Resultados Finais:', results);

        // Feedback visual
        if (successCount === 2 && fillType === 'both') {
            showFeedback('✅ Login e senha preenchidos com sucesso!', 'success');
        } else if (successCount === 1) {
            const filledField = results.find(r => r.success)?.field;
            showFeedback(`✅ ${filledField === 'username' ? 'Usuário' : 'Senha'} preenchido com sucesso!`, 'success');
        } else if (successCount === 0) {
            showFeedback('⚠️ Não foi possível preencher os campos', 'warning');
        }

        // Scroll suave para o primeiro campo preenchido
        if (usernameField && (fillType === 'both' || fillType === 'user')) {
            usernameField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else if (passwordField && fillType === 'password') {
            passwordField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }

        log('═══════════════════════════════════════════════════════════════');
        log(`🎯 Autopreenchimento concluído: ${successCount}/${results.length} campos`);
        log('═══════════════════════════════════════════════════════════════');

        return successCount > 0;
    }

    // ════════════════════════════════════════════════════════════════════════════
    // FEEDBACK VISUAL MELHORADO
    // ════════════════════════════════════════════════════════════════════════════

    function showFeedback(message, type = 'success') {
        // Remover feedback anterior se existir
        const existing = document.getElementById('teampass-feedback');
        if (existing) existing.remove();

        // Cores por tipo
        const colors = {
            success: { bg: '#2ecc71', icon: '✅' },
            warning: { bg: '#f39c12', icon: '⚠️' },
            error: { bg: '#e74c3c', icon: '❌' },
            info: { bg: '#3498db', icon: 'ℹ️' }
        };

        const config = colors[type] || colors.info;

        // Criar elemento de feedback
        const feedback = document.createElement('div');
        feedback.id = 'teampass-feedback';
        feedback.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 20px;">${config.icon}</span>
                <span>${message}</span>
            </div>
        `;
        
        // Estilo
        feedback.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${config.bg};
            color: white;
            padding: 16px 24px;
            border-radius: 10px;
            font-family: 'Segoe UI', sans-serif;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 8px 20px rgba(0, 0, 0, 0.3);
            z-index: 2147483647;
            animation: cofre-slideIn 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55);
            max-width: 400px;
        `;

        // Adicionar animação (se ainda não existir)
        if (!document.getElementById('cofre-feedback-styles')) {
            const style = document.createElement('style');
            style.id = 'cofre-feedback-styles';
            style.textContent = `
                @keyframes cofre-slideIn {
                    from {
                        transform: translateX(500px) scale(0.8);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0) scale(1);
                        opacity: 1;
                    }
                }
                @keyframes cofre-slideOut {
                    from {
                        transform: translateX(0) scale(1);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(500px) scale(0.8);
                        opacity: 0;
                    }
                }
                @keyframes cofre-pulse {
                    0%, 100% { transform: scale(1); }
                    50% { transform: scale(1.05); }
                }
            `;
            document.head.appendChild(style);
        }

        // Adicionar pulso inicial
        feedback.style.animation += ', cofre-pulse 0.6s ease-in-out';

        document.body.appendChild(feedback);

        // Remover após 4 segundos
        setTimeout(() => {
            feedback.style.animation = 'cofre-slideOut 0.4s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
            setTimeout(() => feedback.remove(), 400);
        }, 4000);
    }

    // ════════════════════════════════════════════════════════════════════════════
    // LISTENER DE MENSAGENS
    // ════════════════════════════════════════════════════════════════════════════

    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        log('📨 Mensagem recebida:', message);

        if (message.action === 'autofill') {
            const { login, password, fillType } = message.data;
            
            // Executar autofill de forma assíncrona
            autofill(login, password, fillType).then(success => {
                sendResponse({ success });
            }).catch(error => {
                log('❌ Erro no autofill:', error);
                sendResponse({ success: false, error: error.message });
            });

            return true; // Manter canal aberto para resposta assíncrona
        }

        if (message.action === 'detect_fields') {
            // Retornar informações sobre campos detectados (para debug)
            const detector = new FieldDetector();
            const usernameField = detector.findUsernameField();
            const passwordField = detector.findPasswordField();

            sendResponse({
                hasUsername: !!usernameField,
                hasPassword: !!passwordField,
                usernameInfo: usernameField ? {
                    name: usernameField.name,
                    id: usernameField.id,
                    type: usernameField.type
                } : null,
                passwordInfo: passwordField ? {
                    name: passwordField.name,
                    id: passwordField.id,
                    type: passwordField.type
                } : null
            });
        }

        return true;
    });

    // ════════════════════════════════════════════════════════════════════════════
    // DETECÇÃO AUTOMÁTICA E POPUP DE AUTOFILL
    // ════════════════════════════════════════════════════════════════════════════

    let formDetected = false;
    let autofillPopupShown = false;
    let pendingPasswordCred = null; // Credencial aguardando campo de senha (login multi-step)
    let lastDetectedPasswordField = null; // Referência ao último campo de senha detectado

    // Verificar se domain e exatamente candidateHost ou um subdominio dele
    function isDomainMatch(domain, candidateHost) {
        if (!domain || !candidateHost) return false;
        if (domain === candidateHost) return true;
        return domain.endsWith('.' + candidateHost);
    }

    // Verificar se o host e um sufixo publico (com.br, co.uk, etc.)
    function isPublicSuffix(host, ignoredSet) {
        const firstLabel = host.split('.')[0];
        return ignoredSet.has(firstLabel);
    }

    // Buscar credenciais do storage
    // Deduplicar credenciais: manter apenas a mais recente por login+dominio
    function deduplicateCredentials(creds) {
        const seen = new Map();
        // Iterar do fim pro inicio para manter a mais recente (ultimo adicionado)
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
        // Retornar na ordem original (inverter de volta)
        return Array.from(seen.values()).reverse();
    }

    async function getStoredCredentials() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['credentials', 'session', 'config'], (data) => {
                const hasSession = !!(data.session && data.session.token);
                const hasConfig = !!(data.config && data.config.api_url && data.config.username);
                const config = data.config || null;
                const allCreds = deduplicateCredentials(data.credentials || []);

                const currentUrl = window.location.href;
                let domain = '';
                try {
                    domain = new URL(currentUrl).hostname.replace('www.', '');
                } catch (e) {
                    domain = currentUrl;
                }

                // TLDs e partes comuns que nao devem contar no matching
                const ignoredParts = new Set([
                    'com', 'net', 'org', 'edu', 'gov', 'mil', 'int',
                    'br', 'pt', 'us', 'uk', 'eu', 'io', 'co', 'info', 'biz',
                    'www', 'http', 'https', 'auth', 'login', 'signin', 'app',
                    'portal', 'web', 'site', 'page', 'online', 'cloud'
                ]);

                const withScores = allCreds.map(cred => {
                    const credUrl = (cred.url || '').toLowerCase();
                    const credLabel = (cred.label || '').toLowerCase();
                    const domainLower = domain.toLowerCase();

                    let score = 0;

                    // Match exato: URL da credencial contem o dominio completo
                    if (credUrl && credUrl.includes(domainLower)) score += 100;

                    // Match reverso: dominio atual e subdominio do host da credencial
                    const credHost = credUrl.replace(/https?:\/\//, '').split('/')[0].replace('www.', '').toLowerCase();
                    if (credHost && credHost.length > 4 && !isPublicSuffix(credHost, ignoredParts) && isDomainMatch(domainLower, credHost)) {
                        score += 80;
                    }

                    // Match por nome base do dominio (ex: "netshoes" de netshoes.com.br)
                    // Pular prefixos comuns (login, auth, app, etc.) para achar o nome real
                    const domainParts = domainLower.split('.');
                    let domainBase = '';
                    for (const part of domainParts) {
                        if (part.length > 3 && !ignoredParts.has(part)) {
                            domainBase = part;
                            break;
                        }
                    }
                    if (domainBase) {
                        if (credLabel.includes(domainBase)) score += 50;
                        const credHostParts = credHost.split('.');
                        let credDomainBase = '';
                        for (const part of credHostParts) {
                            if (part.length > 3 && !ignoredParts.has(part)) {
                                credDomainBase = part;
                                break;
                            }
                        }
                        if (credDomainBase === domainBase) score += 40;
                    }

                    return { ...cred, matchScore: score };
                });

                const matched = withScores.filter(c => c.matchScore > 0).sort((a, b) => b.matchScore - a.matchScore);
                const all = withScores.sort((a, b) => b.matchScore - a.matchScore);

                resolve({ matched, all, hasSession, hasConfig, config });
            });
        });
    }

    // Autenticar e buscar credenciais diretamente do content script
    async function authenticateAndFetch(config) {
        const baseUrl = config.api_url.replace(/\/$/, '');
        const apiUrl = `${baseUrl}/api/index.php`;
        const authUrl = `${apiUrl}/authorize`;

        log('Autenticando diretamente do content script...');

        // Tentar autenticar com as 3 estratégias
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
            }},
            { label: 'json-no-header', options: {
                method: 'POST',
                body: JSON.stringify({ login: config.username, password: config.password, apikey: config.apikey })
            }}
        ];

        let token = null;
        let authMode = null;

        for (const strategy of strategies) {
            try {
                const response = await fetch(authUrl, strategy.options);
                if (response.ok) {
                    const result = await response.json();
                    if (result.token) {
                        token = result.token;
                        authMode = 'jwt';
                        log(`Autenticado via ${strategy.label}!`);
                        break;
                    }
                }
            } catch (e) {
                log(`Estratégia ${strategy.label} falhou:`, e.message);
            }
        }

        // Fallback: API legada
        if (!token) {
            try {
                const legacyUrl = `${apiUrl}/read/userpw/${encodeURIComponent(config.username)}?apikey=${encodeURIComponent(config.apikey)}`;
                const response = await fetch(legacyUrl);
                if (response.ok) {
                    authMode = 'apikey';
                    log('Autenticado via API legada!');
                }
            } catch (e) {
                log('API legada falhou:', e.message);
            }
        }

        if (!token && authMode !== 'apikey') {
            return { success: false, credentials: [] };
        }

        // Salvar sessão
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1]));
            await new Promise(resolve => chrome.storage.local.set({
                session: { token, user: { username: payload.username || config.username } }
            }, resolve));
        }

        // Buscar credenciais
        log('Buscando credenciais...');
        const items = [];

        if (authMode === 'apikey') {
            // API legada: buscar pastas e itens
            try {
                const foldersUrl = `${apiUrl}/read/userfolders/all?apikey=${encodeURIComponent(config.apikey)}`;
                const foldersRes = await fetch(foldersUrl);
                if (foldersRes.ok) {
                    const folders = await foldersRes.json();
                    const ids = Array.isArray(folders) ? folders.map(f => f.id).filter(Boolean) : Object.keys(folders).filter(k => !isNaN(k));
                    if (ids.length > 0) {
                        const itemsRes = await fetch(`${apiUrl}/read/folder/${ids.join(';')}?apikey=${encodeURIComponent(config.apikey)}`);
                        if (itemsRes.ok) {
                            const raw = await itemsRes.json();
                            (Array.isArray(raw) ? raw : [raw]).forEach(item => {
                                if (item && item.login && (item.pw || item.pwd)) {
                                    items.push({ id: item.id, label: item.label || '', login: item.login, password: item.pw || item.pwd, url: item.url || '', folder: item.folder_label || '' });
                                }
                            });
                        }
                    }
                }
            } catch (e) { log('Erro busca legada:', e.message); }
        }

        if (token && items.length === 0) {
            // API JWT: buscar por IDs
            for (let id = 1; id <= 200; id++) {
                try {
                    const res = await fetch(`${apiUrl}/item/get?id=${id}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                    });
                    if (res.ok) {
                        const result = await res.json();
                        const item = Array.isArray(result) && result.length > 0 ? result[0] : (result && result.id ? result : null);
                        if (item && item.login && (item.pwd || item.pw)) {
                            items.push({ id: item.id, label: item.label || '', login: item.login, password: item.pwd || item.pw, url: item.url || '', folder: item.folder_label || '' });
                        }
                    }
                } catch (e) {}
            }
        }

        // Salvar credenciais no storage (deduplicadas)
        if (items.length > 0) {
            const dedupedItems = deduplicateCredentials(items);
            await new Promise(resolve => chrome.storage.local.set({ credentials: dedupedItems }, resolve));
        }

        log(`${items.length} credenciais carregadas`);
        return { success: true, credentials: items };
    }

    // Criar e mostrar popup flutuante de autofill
    async function showAutofillPopup(usernameField, passwordField) {
        if (autofillPopupShown) return;
        autofillPopupShown = true;

        let { matched, all, hasSession, hasConfig, config } = await getStoredCredentials();
        const credMap = {};

        // Se tem config mas sem credenciais, tentar autenticar e buscar automaticamente
        if (all.length === 0 && hasConfig && config) {
            showLoadingPopup('Conectando ao TeamPass...');
            const result = await authenticateAndFetch(config);
            if (result.success && result.credentials.length > 0) {
                // Recalcular matches com as credenciais carregadas
                const updated = await getStoredCredentials();
                matched = updated.matched;
                all = updated.all;
            }
            removeLoadingPopup();
        }

        // Remover popup anterior
        const existing = document.getElementById('cofre-autofill-popup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.id = 'cofre-autofill-popup';

        let content = '';
        const headerHtml = `
            <div class="cofre-popup-header">
                <span class="cofre-popup-icon">&#128274;</span>
                <span>Cofre de Senhas FGF</span>
                <span class="cofre-popup-close" id="cofre-popup-close">&times;</span>
            </div>`;

        if (matched.length > 0) {
            // Credenciais correspondentes ao site
            const items = matched.slice(0, 5).map((cred, idx) => {
                const credId = `cofre-cred-${idx}`;
                credMap[credId] = { login: cred.login, password: cred.password };
                return `
                    <div class="cofre-cred-item" data-cred-id="${credId}">
                        <div class="cofre-cred-label">${escapeHtmlForPopup(cred.label || cred.login)}</div>
                        <div class="cofre-cred-user">${escapeHtmlForPopup(cred.login)}</div>
                    </div>`;
            }).join('');
            content = `${headerHtml}
                <div class="cofre-popup-body">
                    <div class="cofre-popup-hint">Credenciais para este site:</div>
                    ${items}
                    <div class="cofre-popup-divider"></div>
                    <div class="cofre-cred-item cofre-show-all" id="cofre-show-all">
                        <div class="cofre-cred-label" style="text-align:center;color:#6b9fff;">Ver todas (${all.length})</div>
                    </div>
                </div>`;
        } else if (all.length > 0) {
            // Nenhuma credencial corresponde a este site
            // Nao mostrar popup - o watcher de submit oferecera salvar apos o login
            log('Nenhuma credencial para este site - aguardando submit para oferecer salvar');
            autofillPopupShown = false;
            return;
        } else if (hasConfig) {
            // Tem config mas não conseguiu carregar credenciais
            content = `${headerHtml}
                <div class="cofre-popup-body">
                    <div class="cofre-popup-hint">Nao foi possivel carregar credenciais do TeamPass.</div>
                    <div class="cofre-popup-hint">Verifique usuario, senha e API key na extensao.</div>
                    <div class="cofre-cred-item" id="cofre-retry-auth">
                        <div class="cofre-cred-label" style="text-align:center;color:#f0ad4e;">Tentar novamente</div>
                    </div>
                </div>`;
        } else {
            // Sem config
            content = `${headerHtml}
                <div class="cofre-popup-body">
                    <div class="cofre-popup-hint">Login detectado nesta pagina.</div>
                    <div class="cofre-popup-hint">Configure a extensao para usar o autopreenchimento.</div>
                </div>`;
        }

        popup.innerHTML = content;
        injectPopupStyles();
        document.body.appendChild(popup);

        // Evento: fechar popup
        const closeBtn = document.getElementById('cofre-popup-close');
        if (closeBtn) closeBtn.addEventListener('click', closeAutofillPopup);

        // Evento: tentar novamente
        const retryBtn = document.getElementById('cofre-retry-auth');
        if (retryBtn) {
            retryBtn.addEventListener('click', async () => {
                autofillPopupShown = false;
                closeAutofillPopup();
                setTimeout(() => showAutofillPopup(usernameField, passwordField), 350);
            });
        }

        // Evento: mostrar todas as credenciais
        const showAllBtn = document.getElementById('cofre-show-all');
        if (showAllBtn) {
            showAllBtn.addEventListener('click', () => {
                autofillPopupShown = false;
                closeAutofillPopup();
                setTimeout(() => showAllCredentialsPopup(usernameField, passwordField, all, credMap), 350);
            });
        }

        // Evento: busca de credenciais
        const searchInput = document.getElementById('cofre-popup-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                const term = e.target.value.toLowerCase();
                const listEl = document.getElementById('cofre-cred-list');
                if (!listEl) return;

                const filtered = all.filter(c =>
                    (c.label || '').toLowerCase().includes(term) ||
                    (c.login || '').toLowerCase().includes(term) ||
                    (c.url || '').toLowerCase().includes(term)
                ).slice(0, 8);

                const newItems = filtered.map((cred, idx) => {
                    const credId = `cofre-cred-s-${idx}`;
                    credMap[credId] = { login: cred.login, password: cred.password };
                    return `
                        <div class="cofre-cred-item" data-cred-id="${credId}">
                            <div class="cofre-cred-label">${escapeHtmlForPopup(cred.label || cred.login)}</div>
                            <div class="cofre-cred-user">${escapeHtmlForPopup(cred.login)}</div>
                        </div>`;
                }).join('');

                listEl.innerHTML = newItems || '<div class="cofre-popup-hint">Nenhuma credencial encontrada.</div>';
                attachCredItemListeners(popup, credMap, usernameField, passwordField);
            });
            setTimeout(() => searchInput.focus(), 100);
        }

        attachCredItemListeners(popup, credMap, usernameField, passwordField);

        // Auto-fechar depois de 30 segundos
        setTimeout(closeAutofillPopup, 30000);
    }

    function showAllCredentialsPopup(usernameField, passwordField, allCreds, existingCredMap) {
        autofillPopupShown = false;
        // Simular que não há matched para forçar mostrar todas
        const tempShowAll = async () => {
            autofillPopupShown = true;
            const credMap = { ...existingCredMap };

            const existing = document.getElementById('cofre-autofill-popup');
            if (existing) existing.remove();

            const popup = document.createElement('div');
            popup.id = 'cofre-autofill-popup';

            const items = allCreds.slice(0, 15).map((cred, idx) => {
                const credId = `cofre-cred-all-${idx}`;
                credMap[credId] = { login: cred.login, password: cred.password };
                return `
                    <div class="cofre-cred-item" data-cred-id="${credId}">
                        <div class="cofre-cred-label">${escapeHtmlForPopup(cred.label || cred.login)}</div>
                        <div class="cofre-cred-user">${escapeHtmlForPopup(cred.login)}</div>
                    </div>`;
            }).join('');

            popup.innerHTML = `
                <div class="cofre-popup-header">
                    <span class="cofre-popup-icon">&#128274;</span>
                    <span>Cofre de Senhas FGF</span>
                    <span class="cofre-popup-close" id="cofre-popup-close">&times;</span>
                </div>
                <div class="cofre-popup-body">
                    <div class="cofre-popup-hint">Todas as credenciais:</div>
                    <div class="cofre-popup-search">
                        <input type="text" id="cofre-popup-search" placeholder="Buscar credencial..." />
                    </div>
                    <div id="cofre-cred-list">${items}</div>
                </div>`;

            document.body.appendChild(popup);

            document.getElementById('cofre-popup-close').addEventListener('click', closeAutofillPopup);

            const searchInput = document.getElementById('cofre-popup-search');
            if (searchInput) {
                searchInput.addEventListener('input', (e) => {
                    const term = e.target.value.toLowerCase();
                    const listEl = document.getElementById('cofre-cred-list');
                    if (!listEl) return;
                    const filtered = allCreds.filter(c =>
                        (c.label || '').toLowerCase().includes(term) ||
                        (c.login || '').toLowerCase().includes(term) ||
                        (c.url || '').toLowerCase().includes(term)
                    ).slice(0, 15);

                    const newItems = filtered.map((cred, idx) => {
                        const credId = `cofre-cred-f-${idx}`;
                        credMap[credId] = { login: cred.login, password: cred.password };
                        return `
                            <div class="cofre-cred-item" data-cred-id="${credId}">
                                <div class="cofre-cred-label">${escapeHtmlForPopup(cred.label || cred.login)}</div>
                                <div class="cofre-cred-user">${escapeHtmlForPopup(cred.login)}</div>
                            </div>`;
                    }).join('');

                    listEl.innerHTML = newItems || '<div class="cofre-popup-hint">Nenhuma credencial encontrada.</div>';
                    attachCredItemListeners(popup, credMap, usernameField, passwordField);
                });
                setTimeout(() => searchInput.focus(), 100);
            }

            attachCredItemListeners(popup, credMap, usernameField, passwordField);
            setTimeout(closeAutofillPopup, 30000);
        };

        tempShowAll();
    }

    function attachCredItemListeners(popup, credMap, usernameField, passwordField) {
        popup.querySelectorAll('.cofre-cred-item[data-cred-id]').forEach(item => {
            // Remover listener anterior (evitar duplicatas)
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);

            newItem.addEventListener('click', async () => {
                const cred = credMap[newItem.dataset.credId];
                if (!cred) return;

                log('Preenchendo com:', cred.login);
                const frameworks = FrameworkDetector.detect();

                if (usernameField) {
                    await FieldFiller.fillField(usernameField, cred.login, frameworks);
                }
                if (passwordField) {
                    await FieldFiller.fillField(passwordField, cred.password, frameworks);
                    showFeedback('Credenciais preenchidas!', 'success');
                    setDomainCooldown();
                } else {
                    // Login multi-step: campo de senha ainda não existe
                    // Salvar credencial e aguardar o campo aparecer
                    pendingPasswordCred = cred;
                    log('Campo de senha não encontrado - aguardando campo aparecer (login multi-step)');
                    showFeedback('Login preenchido! Aguardando campo de senha...', 'success');
                    startPasswordFieldWatcher();
                }

                closeAutofillPopup();
            });
        });
    }

    function showLoadingPopup(message) {
        const existing = document.getElementById('cofre-autofill-popup');
        if (existing) existing.remove();

        const popup = document.createElement('div');
        popup.id = 'cofre-autofill-popup';
        popup.innerHTML = `
            <div class="cofre-popup-header">
                <span class="cofre-popup-icon">&#128274;</span>
                <span>Cofre de Senhas FGF</span>
            </div>
            <div class="cofre-popup-body">
                <div class="cofre-popup-hint" style="text-align:center;padding:16px 6px;">
                    <div style="margin-bottom:8px;font-size:20px;">&#9203;</div>
                    ${message}
                </div>
            </div>`;

        // Garantir estilos
        if (!document.getElementById('cofre-popup-styles')) {
            injectPopupStyles();
        }
        document.body.appendChild(popup);
    }

    function removeLoadingPopup() {
        const popup = document.getElementById('cofre-autofill-popup');
        if (popup) popup.remove();
    }

    function injectPopupStyles() {
        if (document.getElementById('cofre-popup-styles')) return;
        const style = document.createElement('style');
        style.id = 'cofre-popup-styles';
        style.textContent = `
            #cofre-autofill-popup {
                position: fixed;
                top: 16px;
                right: 16px;
                width: 320px;
                background: #1a1f36;
                border: 1px solid #2d3555;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.45);
                z-index: 2147483647;
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                color: #e0e6ed;
                overflow: hidden;
                animation: cofre-popup-in 0.35s ease-out;
            }
            @keyframes cofre-popup-in {
                from { transform: translateY(-20px) scale(0.95); opacity: 0; }
                to { transform: translateY(0) scale(1); opacity: 1; }
            }
            @keyframes cofre-popup-out {
                from { transform: translateY(0) scale(1); opacity: 1; }
                to { transform: translateY(-20px) scale(0.95); opacity: 0; }
            }
            .cofre-popup-header {
                display: flex; align-items: center; gap: 8px;
                padding: 12px 16px; background: #0d1025;
                font-weight: 600; font-size: 13px;
                border-bottom: 1px solid #2d3555;
            }
            .cofre-popup-icon { font-size: 18px; }
            .cofre-popup-close {
                margin-left: auto; cursor: pointer;
                font-size: 20px; opacity: 0.6;
                transition: opacity 0.2s; line-height: 1;
            }
            .cofre-popup-close:hover { opacity: 1; }
            .cofre-popup-body { padding: 10px; }
            .cofre-popup-hint {
                font-size: 12px; color: #8892a8; padding: 4px 6px 8px;
            }
            .cofre-cred-item {
                padding: 10px 12px; border-radius: 8px;
                cursor: pointer; transition: background 0.15s;
                margin-bottom: 4px;
            }
            .cofre-cred-item:hover { background: #252b48; }
            .cofre-cred-label {
                font-size: 13px; font-weight: 600;
                color: #e0e6ed; margin-bottom: 2px;
            }
            .cofre-cred-user { font-size: 12px; color: #6b7a99; }
            .cofre-popup-divider {
                border-top: 1px solid #2d3555; margin: 6px 0;
            }
            .cofre-popup-search input {
                width: 100%; padding: 8px 10px;
                border: 1px solid #2d3555; border-radius: 6px;
                background: #0d1025; color: #e0e6ed;
                font-size: 12px; outline: none;
                box-sizing: border-box; margin-bottom: 6px;
            }
            .cofre-popup-search input:focus { border-color: #6b9fff; }
            #cofre-cred-list { max-height: 250px; overflow-y: auto; }
            #cofre-cred-list::-webkit-scrollbar { width: 4px; }
            #cofre-cred-list::-webkit-scrollbar-thumb {
                background: #2d3555; border-radius: 4px;
            }
        `;
        document.head.appendChild(style);
    }

    function escapeHtmlForPopup(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    function closeAutofillPopup() {
        const popup = document.getElementById('cofre-autofill-popup');
        if (popup) {
            popup.style.animation = 'cofre-popup-out 0.3s ease-in forwards';
            setTimeout(() => popup.remove(), 300);
        }
    }

    // Observador para login multi-step: aguarda campo de senha aparecer
    function startPasswordFieldWatcher() {
        if (!pendingPasswordCred) return;
        log('Iniciando observador de campo de senha (login multi-step)');

        let passwordWatcherTimer = null;
        const passwordObserver = new MutationObserver(() => {
            clearTimeout(passwordWatcherTimer);
            passwordWatcherTimer = setTimeout(async () => {
                if (!pendingPasswordCred) {
                    passwordObserver.disconnect();
                    return;
                }

                const detector = new FieldDetector();
                const pwField = detector.findPasswordField();

                if (pwField) {
                    log('Campo de senha detectado no multi-step! Preenchendo automaticamente.');
                    lastDetectedPasswordField = pwField;
                    const cred = pendingPasswordCred;
                    pendingPasswordCred = null;
                    passwordObserver.disconnect();

                    const frameworks = FrameworkDetector.detect();
                    await FieldFiller.fillField(pwField, cred.password, frameworks);
                    showFeedback('Senha preenchida automaticamente!', 'success');
                    setDomainCooldown();
                }
            }, 400);
        });

        passwordObserver.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ['type', 'style', 'class', 'hidden', 'disabled']
        });

        // Verificar imediatamente (o campo pode já ter aparecido)
        setTimeout(async () => {
            if (!pendingPasswordCred) return;
            const detector = new FieldDetector();
            const pwField = detector.findPasswordField();
            if (pwField) {
                log('Campo de senha já visível no multi-step!');
                lastDetectedPasswordField = pwField;
                const cred = pendingPasswordCred;
                pendingPasswordCred = null;
                passwordObserver.disconnect();

                const frameworks = FrameworkDetector.detect();
                await FieldFiller.fillField(pwField, cred.password, frameworks);
                showFeedback('Senha preenchida automaticamente!', 'success');
                setDomainCooldown();
            }
        }, 500);

        // Timeout de segurança: parar de observar após 30 segundos
        setTimeout(() => {
            if (pendingPasswordCred) {
                log('Timeout aguardando campo de senha multi-step');
                // Mostrar popup para o usuário preencher manualmente
                autofillPopupShown = false;
                const detector = new FieldDetector();
                const pwField = detector.findPasswordField();
                if (pwField) {
                    showAutofillPopup(null, pwField);
                }
                pendingPasswordCred = null;
            }
            passwordObserver.disconnect();
        }, 30000);
    }

    // Verificar se a página é realmente uma página de login
    function isLikelyLoginPage() {
        const url = window.location.href.toLowerCase();
        const path = window.location.pathname.toLowerCase();
        const title = document.title.toLowerCase();

        // URLs que indicam login
        const loginPatterns = /\b(login|signin|sign-in|sign_in|logon|log-on|auth|authenticate|sso|cas|saml|oauth|acesso|entrar|acessar)\b/i;

        // URLs que indicam que o usuário JÁ está logado (não mostrar popup)
        const loggedInPatterns = /\b(dashboard|painel|home|feed|inbox|mail|portal|admin|settings|config|profile|account|console|app)\b/i;

        // Se a URL tem padrão de "logado", não é login
        if (loggedInPatterns.test(path) && !loginPatterns.test(path)) {
            return false;
        }

        // Se a URL ou título tem padrão de login, é login
        if (loginPatterns.test(url) || loginPatterns.test(title)) {
            return true;
        }

        // Verificar se existe um formulário com botão de "entrar/login"
        const buttons = document.querySelectorAll('button, input[type="submit"], a[role="button"]');
        for (const btn of buttons) {
            const text = (btn.textContent || btn.value || '').toLowerCase().trim();
            if (/^(login|sign\s?in|entrar|acessar|log\s?on|conectar|submit|iniciar\s?sess)/.test(text)) {
                return true;
            }
        }

        return null; // Indeterminado - deixar a detecção de campos decidir
    }

    // Verificar cooldown de domínio (não mostrar popup se preencheu recentemente)
    async function isDomainOnCooldown() {
        return new Promise((resolve) => {
            const domain = window.location.hostname;
            chrome.storage.local.get('autofill_cooldowns', (data) => {
                const cooldowns = data.autofill_cooldowns || {};
                const lastFill = cooldowns[domain];
                if (lastFill && (Date.now() - lastFill) < 600000) { // 10 minutos
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });
    }

    // Salvar cooldown após preenchimento bem-sucedido
    function setDomainCooldown() {
        const domain = window.location.hostname;
        chrome.storage.local.get('autofill_cooldowns', (data) => {
            const cooldowns = data.autofill_cooldowns || {};
            cooldowns[domain] = Date.now();
            // Limpar cooldowns antigos (> 1 hora)
            for (const key in cooldowns) {
                if (Date.now() - cooldowns[key] > 3600000) delete cooldowns[key];
            }
            chrome.storage.local.set({ autofill_cooldowns: cooldowns });
        });
    }

    async function detectLoginForm() {
        if (formDetected) return;

        // Verificar cooldown
        if (await isDomainOnCooldown()) {
            log('Domínio em cooldown - popup não será exibido');
            return;
        }

        const detector = new FieldDetector();
        const usernameField = detector.findUsernameField();
        const passwordField = detector.findPasswordField();

        // Requer pelo menos um campo de senha OU (campo de username + página parece login)
        const pageIsLogin = isLikelyLoginPage();

        if (passwordField) {
            // Tem campo de senha → é login
        } else if (usernameField && pageIsLogin === true) {
            // Só username, mas a página parece login (multi-step)
        } else if (usernameField && pageIsLogin === null) {
            // Indeterminado: verificar se o campo username é forte o suficiente
            // (tem label "login", "email", etc. e não parece um formulário de busca)
            const form = usernameField.closest('form');
            if (!form) return; // Sem formulário = provavelmente não é login
            const formInputs = form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"])');
            if (formInputs.length > 4) return; // Formulários com muitos campos não são login
        } else {
            return; // Nenhum campo encontrado ou página não é login
        }

        log('Formulario de login detectado!', {
            username: usernameField ? { name: usernameField.name, id: usernameField.id, type: usernameField.type } : null,
            password: passwordField ? { name: passwordField.name, id: passwordField.id } : null,
            pageIsLogin
        });
        formDetected = true;
        lastDetectedPasswordField = passwordField;

        // Configurar watcher de submit para capturar credenciais
        if (passwordField && !formSubmitWatcherActive) {
            setupFormSubmitWatcher(usernameField, passwordField);
        }

        // Mostrar popup de autofill
        showAutofillPopup(usernameField, passwordField);

        // Notificar background script
        try {
            chrome.runtime.sendMessage({
                action: 'form_detected',
                url: window.location.href
            });
        } catch (e) {
            // Ignorar
        }
    }

    // Detectar formulários quando a página carregar
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(detectLoginForm, 300));
    } else {
        setTimeout(detectLoginForm, 300);
    }

    // Re-detectar após delays (para SPAs)
    setTimeout(detectLoginForm, 1500);
    setTimeout(detectLoginForm, 4000);

    // Detectar formulários carregados dinamicamente via MutationObserver
    let mutationTimer = null;
    const observer = new MutationObserver((mutations) => {
        let hasNewInputs = false;

        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType === 1) {
                    if (node.tagName === 'FORM' ||
                        node.tagName === 'INPUT' ||
                        (node.querySelector && (node.querySelector('form') || node.querySelector('input')))) {
                        hasNewInputs = true;
                        break;
                    }
                }
            }
            if (hasNewInputs) break;
        }

        if (hasNewInputs && !formDetected) {
            clearTimeout(mutationTimer);
            mutationTimer = setTimeout(detectLoginForm, 500);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    log('Sistema de deteccao automatica ativo');

    // ════════════════════════════════════════════════════════════════════════════
    // CAPTURA DE CREDENCIAIS E OFERTA PARA SALVAR SENHA
    // ════════════════════════════════════════════════════════════════════════════

    let capturedCredentials = { username: '', password: '' };
    let formSubmitWatcherActive = false;
    let savePasswordPopupShown = false;

    // Verificar se o dominio esta na blacklist de "Nunca salvar"
    async function isDomainSaveBlacklisted() {
        return new Promise((resolve) => {
            const domain = window.location.hostname;
            chrome.storage.local.get('save_password_blacklist', (data) => {
                const blacklist = data.save_password_blacklist || [];
                resolve(blacklist.includes(domain));
            });
        });
    }

    // Adicionar dominio a blacklist
    function addDomainToSaveBlacklist() {
        const domain = window.location.hostname;
        chrome.storage.local.get('save_password_blacklist', (data) => {
            const blacklist = data.save_password_blacklist || [];
            if (!blacklist.includes(domain)) {
                blacklist.push(domain);
                chrome.storage.local.set({ save_password_blacklist: blacklist });
            }
        });
    }

    // Configurar monitoramento de submit do formulario
    function setupFormSubmitWatcher(usernameField, passwordField) {
        if (formSubmitWatcherActive) return;
        if (!passwordField) return; // Precisa ter campo de senha para capturar
        formSubmitWatcherActive = true;

        log('Configurando monitoramento de submit para salvar senha');

        // Monitorar valores dos campos em tempo real
        if (usernameField) {
            capturedCredentials.username = usernameField.value;
            usernameField.addEventListener('input', () => {
                capturedCredentials.username = usernameField.value;
            });
            usernameField.addEventListener('change', () => {
                capturedCredentials.username = usernameField.value;
            });
        }

        if (passwordField) {
            capturedCredentials.password = passwordField.value;
            passwordField.addEventListener('input', () => {
                capturedCredentials.password = passwordField.value;
            });
            passwordField.addEventListener('change', () => {
                capturedCredentials.password = passwordField.value;
            });
        }

        // Handler para quando o formulario e submetido
        async function onFormSubmit() {
            // Capturar valores atuais (podem ter sido setados via JS)
            if (usernameField) capturedCredentials.username = usernameField.value;
            if (passwordField) capturedCredentials.password = passwordField.value;

            const username = capturedCredentials.username.trim();
            const password = capturedCredentials.password.trim();

            log('Submit detectado. Credenciais capturadas:', { username, hasPassword: !!password });

            if (!username || !password) return;

            // Verificar blacklist
            const blacklisted = await isDomainSaveBlacklisted();
            if (blacklisted) {
                log('Dominio na blacklist - nao oferecendo salvar');
                return;
            }

            // Verificar se ja existe credencial EXATA (mesmo login e senha) para este dominio
            const { matched } = await getStoredCredentials();
            const exactMatch = matched.some(cred =>
                cred.login && cred.login.toLowerCase() === username.toLowerCase() &&
                cred.password === password
            );
            if (exactMatch) {
                log('Credencial exata ja existe para este dominio - nao oferecendo salvar');
                return;
            }

            // Aguardar um pouco para o login processar
            setTimeout(() => {
                showSavePasswordPopup(username, password);
            }, 1500);
        }

        // Interceptar submit do formulario
        const form = passwordField.closest('form') || (usernameField ? usernameField.closest('form') : null);
        if (form) {
            form.addEventListener('submit', (e) => {
                log('Evento submit do formulario capturado');
                onFormSubmit();
            });
        }

        // Interceptar clique em botoes de submit
        const formContainer = form || document.body;
        const submitButtons = formContainer.querySelectorAll(
            'button[type="submit"], input[type="submit"], button:not([type]), a[role="button"]'
        );
        submitButtons.forEach(btn => {
            const text = (btn.textContent || btn.value || '').toLowerCase().trim();
            if (/^(login|sign\s?in|entrar|acessar|log\s?on|conectar|submit|iniciar|enviar|continuar|next|continue)/.test(text) ||
                btn.type === 'submit') {
                btn.addEventListener('click', () => {
                    log('Clique em botao de submit detectado:', text || btn.type);
                    // Pequeno delay para capturar valores atualizados
                    setTimeout(onFormSubmit, 100);
                });
            }
        });

        // Interceptar Enter no campo de senha
        if (passwordField) {
            passwordField.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    log('Enter pressionado no campo de senha');
                    setTimeout(onFormSubmit, 100);
                }
            });
        }
    }

    // Buscar pastas do TeamPass via background
    async function fetchFolders() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'get_folders' }, (response) => {
                if (response && response.success && response.folders) {
                    resolve(response.folders);
                } else {
                    resolve([]);
                }
            });
        });
    }

    // Mostrar popup "Salvar senha?"
    async function showSavePasswordPopup(username, password) {
        if (savePasswordPopupShown) return;
        savePasswordPopupShown = true;

        log('Mostrando popup "Salvar senha?" para:', username);

        // Remover popup de autofill se existir
        closeAutofillPopup();

        const existing = document.getElementById('cofre-save-popup');
        if (existing) existing.remove();

        const domain = window.location.hostname;
        const popup = document.createElement('div');
        popup.id = 'cofre-save-popup';

        // Buscar pastas disponiveis
        const folders = await fetchFolders();
        log('Pastas disponiveis:', folders.length);

        let folderSelectHtml = '';
        if (folders.length > 0) {
            const optionsHtml = folders.map(f =>
                `<option value="${escapeHtmlForPopup(String(f.id))}">${escapeHtmlForPopup(f.title)}</option>`
            ).join('');
            folderSelectHtml = `
                <div class="cofre-save-folder-row">
                    <span class="cofre-save-label">Pasta:</span>
                    <select id="cofre-save-folder" class="cofre-save-select">
                        <option value="0">-- Selecione uma pasta --</option>
                        ${optionsHtml}
                    </select>
                </div>`;
        } else {
            folderSelectHtml = `
                <div class="cofre-save-folder-row">
                    <span class="cofre-save-label">Pasta:</span>
                    <span class="cofre-save-value cofre-save-no-folders">Nenhuma pasta disponivel</span>
                </div>`;
        }

        popup.innerHTML = `
            <div class="cofre-popup-header">
                <span class="cofre-popup-icon">&#128274;</span>
                <span>Cofre de Senhas FGF</span>
                <span class="cofre-popup-close" id="cofre-save-close">&times;</span>
            </div>
            <div class="cofre-popup-body">
                <div class="cofre-save-title">Salvar senha para este site?</div>
                <div class="cofre-save-domain">${escapeHtmlForPopup(domain)}</div>
                <div class="cofre-save-cred-info">
                    <div class="cofre-save-user-row">
                        <span class="cofre-save-label">Usuario:</span>
                        <span class="cofre-save-value">${escapeHtmlForPopup(username)}</span>
                    </div>
                    <div class="cofre-save-user-row">
                        <span class="cofre-save-label">Senha:</span>
                        <span class="cofre-save-value">${'*'.repeat(Math.min(password.length, 12))}</span>
                    </div>
                    ${folderSelectHtml}
                </div>
                <div class="cofre-save-actions">
                    <button class="cofre-save-btn cofre-save-btn-primary" id="cofre-save-confirm">Salvar no Cofre</button>
                    <button class="cofre-save-btn cofre-save-btn-secondary" id="cofre-save-dismiss">Agora nao</button>
                </div>
                <div class="cofre-save-never" id="cofre-save-never">Nunca para este site</div>
            </div>
        `;

        injectPopupStyles();
        injectSavePopupStyles();
        document.body.appendChild(popup);

        // Evento: fechar
        document.getElementById('cofre-save-close').addEventListener('click', closeSavePopup);
        document.getElementById('cofre-save-dismiss').addEventListener('click', closeSavePopup);

        // Evento: salvar
        document.getElementById('cofre-save-confirm').addEventListener('click', async () => {
            const btn = document.getElementById('cofre-save-confirm');
            const folderSelect = document.getElementById('cofre-save-folder');
            const selectedFolderId = folderSelect ? folderSelect.value : '0';
            const selectedFolderName = folderSelect ? folderSelect.options[folderSelect.selectedIndex].text : '';

            btn.textContent = 'Salvando...';
            btn.disabled = true;

            try {
                const response = await new Promise((resolve) => {
                    chrome.runtime.sendMessage({
                        action: 'save_credential',
                        data: {
                            label: domain,
                            login: username,
                            password: password,
                            url: window.location.origin,
                            folderId: selectedFolderId !== '0' ? parseInt(selectedFolderId) : 0,
                            folderName: selectedFolderName !== '-- Selecione uma pasta --' ? selectedFolderName : ''
                        }
                    }, resolve);
                });

                if (response && response.success) {
                    closeSavePopup();
                    showFeedback('Senha salva no cofre com sucesso!', 'success');
                } else {
                    btn.textContent = 'Salvar no Cofre';
                    btn.disabled = false;
                    showFeedback('Erro ao salvar: ' + (response ? response.error : 'sem resposta'), 'error');
                }
            } catch (error) {
                btn.textContent = 'Salvar no Cofre';
                btn.disabled = false;
                showFeedback('Erro ao salvar: ' + error.message, 'error');
            }
        });

        // Evento: nunca para este site
        document.getElementById('cofre-save-never').addEventListener('click', () => {
            addDomainToSaveBlacklist();
            closeSavePopup();
            showFeedback('Este site foi adicionado a lista de excluidos', 'info');
        });

        // Auto-fechar apos 30 segundos
        setTimeout(closeSavePopup, 30000);
    }

    function closeSavePopup() {
        const popup = document.getElementById('cofre-save-popup');
        if (popup) {
            popup.style.animation = 'cofre-popup-out 0.3s ease-in forwards';
            setTimeout(() => popup.remove(), 300);
        }
        savePasswordPopupShown = false;
    }

    function injectSavePopupStyles() {
        if (document.getElementById('cofre-save-styles')) return;
        const style = document.createElement('style');
        style.id = 'cofre-save-styles';
        style.textContent = `
            #cofre-save-popup {
                position: fixed;
                top: 16px;
                right: 16px;
                width: 340px;
                background: #1a1f36;
                border: 1px solid #2d3555;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.45);
                z-index: 2147483647;
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                color: #e0e6ed;
                overflow: hidden;
                animation: cofre-popup-in 0.35s ease-out;
            }
            .cofre-save-title {
                font-size: 14px;
                font-weight: 600;
                color: #e0e6ed;
                padding: 8px 6px 4px;
            }
            .cofre-save-domain {
                font-size: 12px;
                color: #6b9fff;
                padding: 0 6px 10px;
                font-weight: 500;
            }
            .cofre-save-cred-info {
                background: #0d1025;
                border-radius: 8px;
                padding: 10px 12px;
                margin: 0 4px 12px;
            }
            .cofre-save-user-row {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 3px 0;
                font-size: 12px;
            }
            .cofre-save-label {
                color: #8892a8;
                min-width: 55px;
            }
            .cofre-save-value {
                color: #e0e6ed;
                font-weight: 500;
                word-break: break-all;
            }
            .cofre-save-actions {
                display: flex;
                gap: 8px;
                padding: 0 4px 8px;
            }
            .cofre-save-btn {
                flex: 1;
                padding: 9px 12px;
                border: none;
                border-radius: 7px;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                transition: background 0.15s, opacity 0.15s;
                font-family: inherit;
            }
            .cofre-save-btn:disabled {
                opacity: 0.6;
                cursor: not-allowed;
            }
            .cofre-save-btn-primary {
                background: #4a9eff;
                color: #fff;
            }
            .cofre-save-btn-primary:hover:not(:disabled) {
                background: #3a8eef;
            }
            .cofre-save-btn-secondary {
                background: #2d3555;
                color: #8892a8;
            }
            .cofre-save-btn-secondary:hover {
                background: #3a4166;
            }
            .cofre-save-never {
                text-align: center;
                font-size: 11px;
                color: #e74c3c;
                cursor: pointer;
                padding: 4px 0 10px;
                opacity: 0.7;
                transition: opacity 0.15s;
            }
            .cofre-save-never:hover {
                opacity: 1;
            }
            .cofre-save-folder-row {
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 0 3px;
                font-size: 12px;
            }
            .cofre-save-select {
                flex: 1;
                padding: 6px 8px;
                border: 1px solid #2d3555;
                border-radius: 6px;
                background: #1a1f36;
                color: #e0e6ed;
                font-size: 12px;
                font-family: inherit;
                outline: none;
                cursor: pointer;
                appearance: auto;
            }
            .cofre-save-select:focus {
                border-color: #6b9fff;
            }
            .cofre-save-select option {
                background: #1a1f36;
                color: #e0e6ed;
            }
            .cofre-save-no-folders {
                color: #8892a8;
                font-style: italic;
            }
        `;
        document.head.appendChild(style);
    }

    // Nota: setupFormSubmitWatcher agora e chamado diretamente dentro de detectLoginForm

    log('Sistema de captura de credenciais ativo');

})();
