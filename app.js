// SGE SENAI - Sistema de Gestão de Espaços (Versão Local - Independente)

// 1. Configurações Globais
const ADMIN_EMAILS = ['rcgamainformatica@gmail.com', 'rgama@sp.senai.br'];
const ADMIN_PASSWORD = 'senai123'; // Senha padrão para administradores no protótipo

// 2. Estado do Sistema (Persistência via LocalStorage)
let db = JSON.parse(localStorage.getItem('sge_db')) || {
    ambientes: [
        { id: '1', nome: 'Sala 04', capacidade: 40, recursos: 'Projetor, 40 cadeiras, Wi-Fi, Lousa digital.' }
    ],
    reservas: [],
    users: [],
    layout: {
        primaryColor: '#ffffff',
        bannerTitle: 'SGE SENAI',
        bannerText: 'Sistema de Gestão de Espaços e Ambientes'
    }
};

let currentUser = JSON.parse(sessionStorage.getItem('sge_user')) || null;

// Salvar no LocalStorage
const saveDB = () => localStorage.setItem('sge_db', JSON.stringify(db));
const saveSession = () => sessionStorage.setItem('sge_user', JSON.stringify(currentUser));

// --- Funções de UI ---

const updateUIByRole = () => {
    if (!currentUser) return;

    const emailLower = currentUser.email.toLowerCase();
    const isAdmin = ADMIN_EMAILS.includes(emailLower);
    const isGestao = currentUser.role === 'Gestão' || isAdmin;

    // Controle de visibilidade por perfil
    document.querySelectorAll('.admin-only').forEach(el => el.classList.toggle('hidden', !isAdmin));
    document.querySelectorAll('.gestao-only').forEach(el => el.classList.toggle('hidden', !isGestao));

    // Aplicar Layout
    document.documentElement.style.setProperty('--accent-color', db.layout.primaryColor);
    const bannerTitle = document.getElementById('banner-title');
    const bannerText = document.getElementById('banner-text');
    if (bannerTitle) bannerTitle.textContent = db.layout.bannerTitle;
    if (bannerText) bannerText.textContent = db.layout.bannerText;

    if (isAdmin && document.getElementById('layout-view')) {
        const colorInput = document.getElementById('primary-color-pick');
        const titleInput = document.getElementById('layout-banner-title');
        const textInput = document.getElementById('layout-banner-text');
        if (colorInput) colorInput.value = db.layout.primaryColor;
        if (titleInput) titleInput.value = db.layout.bannerTitle;
        if (textInput) textInput.value = db.layout.bannerText;
    }
};

const showView = (viewId) => {
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    const target = document.getElementById(`${viewId}-view`);
    if (target) target.classList.remove('hidden');
    
    document.querySelectorAll('#nav-links a').forEach(link => {
        link.classList.toggle('active', link.dataset.page === viewId);
    });

    if (viewId === 'ambientes') renderAmbientes();
    if (viewId === 'minhas-reservas') renderMinhasReservas();
    if (viewId === 'reservas-gestao') renderReservas();
};

const renderAmbientes = () => {
    const list = document.getElementById('ambientes-list');
    if (!list) return;
    
    const emailLower = currentUser.email.toLowerCase();
    const isAdmin = ADMIN_EMAILS.includes(emailLower);
    const isGestao = currentUser.role === 'Gestão' || isAdmin;

    list.innerHTML = db.ambientes.map(amb => `
        <div class="ambiente-card">
            <div class="ambiente-img">
                <svg width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <path d="M3 9h18M9 21V9M15 21V9"/>
                </svg>
            </div>
            <div class="ambiente-info">
                <h3>${amb.nome}</h3>
                <p>${amb.capacidade} Lugares</p>
                <div class="recursos-container">
                    <span class="recursos-label">Recursos Didáticos</span>
                    <div class="recursos-text" id="recursos-${amb.id}">${amb.recursos || 'Aguardando cadastro...'}</div>
                </div>
                <div class="card-actions">
                    ${isGestao ? 
                        `<button class="btn-secondary" data-action="edit-recursos" data-id="${amb.id}">Editar Recursos</button>` : 
                        `<button class="btn-primary" data-action="solicitar-reserva" data-id="${amb.id}">Solicitar Reserva</button>`
                    }
                </div>
            </div>
        </div>
    `).join('');
};

const renderReservas = () => {
    const list = document.getElementById('reservas-list');
    if (!list) return;

    list.innerHTML = db.reservas.length > 0 ? db.reservas.map(res => `
        <tr>
            <td>${res.userName}</td>
            <td>${res.ambiente}</td>
            <td>${res.data}</td>
            <td><span class="status-badge ${res.status.toLowerCase()}">${res.status}</span></td>
            <td>
                ${res.status === 'Pendente' ? `
                    <button class="btn-sm success" data-action="confirm-reserva" data-id="${res.id}" data-status="Aprovada">Aprovar</button>
                    <button class="btn-sm danger" data-action="confirm-reserva" data-id="${res.id}" data-status="Negada">Negar</button>
                ` : '---'}
            </td>
        </tr>
    `).join('') : '<tr><td colspan="5" style="text-align:center; padding: 1rem; color:var(--text-muted);">Sem solicitações pendentes.</td></tr>';
};

const renderMinhasReservas = () => {
    const list = document.getElementById('minhas-reservas-list');
    if (!list) return;
    
    const userReservas = db.reservas.filter(res => res.userEmail === currentUser.email);

    list.innerHTML = userReservas.length > 0 ? userReservas.map(res => `
        <tr>
            <td>${res.ambiente}</td>
            <td>${res.data}</td>
            <td><span class="status-badge ${res.status.toLowerCase()}">${res.status}</span></td>
        </tr>
    `).join('') : '<tr><td colspan="3" style="text-align:center; padding: 2rem; color: var(--text-muted);">Você ainda não solicitou nenhuma reserva.</td></tr>';
};

// --- Sistema de Modal ---

let activeModalConfirm = null;

const openModal = (title, fields, onConfirm) => {
    const modal = document.getElementById('custom-modal');
    document.getElementById('modal-title').textContent = title;
    const fieldsBody = document.getElementById('modal-fields');
    fieldsBody.innerHTML = fields.map(f => `
        <div class="form-group">
            <label>${f.label}</label>
            ${f.type === 'textarea' ? 
                `<textarea id="mod-${f.id}" rows="4">${f.value || ''}</textarea>` : 
                `<input type="${f.type || 'text'}" id="mod-${f.id}" value="${f.value || ''}" placeholder="${f.placeholder || ''}">`}
        </div>
    `).join('');
    
    activeModalConfirm = onConfirm;
    modal.classList.remove('hidden');
};

const closeModal = () => {
    document.getElementById('custom-modal').classList.add('hidden');
    activeModalConfirm = null;
};

// --- Autenticação ---

const initDashboard = () => {
    document.getElementById('auth-section').classList.add('hidden');
    document.getElementById('main-header').classList.remove('hidden');
    updateUIByRole();
    showView('home');
};

const validateAccess = (email, password) => {
    const emailLower = email.toLowerCase();
    const isAdmin = ADMIN_EMAILS.includes(emailLower);
    
    if (isAdmin) {
        if (password === ADMIN_PASSWORD) {
            return { name: 'Administrador', email: emailLower, role: 'Administrador' };
        } else {
            alert('Senha incorreta para Administrador.');
            return null;
        }
    }
    
    if (emailLower.endsWith('@sp.senai.br')) {
        // Para usuários padrão no protótipo, qualquer senha serve ou podemos validar contra db.users
        const userInDb = db.users.find(u => u.email.toLowerCase() === emailLower);
        if (userInDb && userInDb.password !== password) {
            alert('Senha incorreta.');
            return null;
        }
        return { name: email.split('@')[0], email: emailLower, role: 'Usuário Padrão' };
    }
    
    return null;
};

const handleSocialLogin = (provider) => {
    openModal(`Login com ${provider}`, [
        { id: 'email', label: 'E-mail Institucional', placeholder: 'exemplo@sp.senai.br' },
        { id: 'pass', label: 'Senha', type: 'password' }
    ], (data) => {
        if (!data.email || !data.pass) return;
        const user = validateAccess(data.email, data.pass);
        if (user) {
            currentUser = user;
            saveSession();
            initDashboard();
        } else {
            alert('Acesso negado. Verifique suas credenciais.');
        }
    });
};

// --- Verificação de Horários ---

const isWithinAllowedHours = (dateStr) => {
    alert('Nota: Lembre-se de reservar entre 08h-22h (Seg-Sex) ou 08h-18h (Sáb).');
    return true; 
};

// --- Event Listeners ---

document.addEventListener('click', (e) => {
    const target = e.target;
    
    // Navegação
    const navLink = target.closest('#nav-links a');
    if (navLink) { e.preventDefault(); showView(navLink.dataset.page); return; }

    // Logout
    const logoutBtn = target.closest('#logout-btn');
    if (logoutBtn) { currentUser = null; sessionStorage.removeItem('sge_user'); window.location.reload(); return; }

    // Social Login
    if (target.id === 'btn-google') { handleSocialLogin('Google'); return; }
    if (target.id === 'btn-microsoft') { handleSocialLogin('Microsoft'); return; }

    // Alternar Cadastro/Login
    if (target.id === 'go-to-register') { document.getElementById('register-card').classList.remove('hidden'); document.querySelector('.auth-card:not(#register-card)').classList.add('hidden'); return; }
    if (target.id === 'go-to-login') { document.getElementById('register-card').classList.add('hidden'); document.querySelector('.auth-card:not(#register-card)').classList.remove('hidden'); return; }

    // Modal
    if (target.id === 'modal-close-btn' || target.id === 'modal-cancel-btn') { closeModal(); return; }
    if (target.id === 'modal-confirm-btn') {
        if (activeModalConfirm) {
            const formData = {};
            document.querySelectorAll('#modal-fields [id^="mod-"]').forEach(input => {
                formData[input.id.replace('mod-', '')] = input.value;
            });
            activeModalConfirm(formData);
            closeModal();
        }
        return;
    }

    // Ações de Ambiente
    const addAmbienteBtn = target.closest('#btn-add-ambiente');
    if (addAmbienteBtn) {
        openModal('Cadastrar Novo Ambiente', [
            { id: 'nome', label: 'Nome do Ambiente' },
            { id: 'cap', label: 'Capacidade (Lugares)', type: 'number' },
            { id: 'recursos', label: 'Recursos Didáticos', type: 'textarea' }
        ], (data) => {
            if (!data.nome || !data.cap) return;
            db.ambientes.push({
                id: Date.now().toString(),
                nome: data.nome,
                capacidade: parseInt(data.cap),
                recursos: data.recursos || ''
            });
            saveDB();
            renderAmbientes();
        });
        return;
    }

    const actionBtn = target.closest('[data-action]');
    if (actionBtn) {
        const action = actionBtn.dataset.action;
        const id = actionBtn.dataset.id;

        if (action === 'edit-recursos') {
            const amb = db.ambientes.find(a => a.id === id);
            openModal('Editar Recursos Didáticos', [
                { id: 'recursos', label: 'Recursos Didáticos', type: 'textarea', value: amb.recursos }
            ], (data) => {
                const index = db.ambientes.findIndex(a => a.id === id);
                db.ambientes[index].recursos = data.recursos;
                saveDB();
                renderAmbientes();
            });
        }

        if (action === 'solicitar-reserva') {
            const amb = db.ambientes.find(a => a.id === id);
            openModal('Solicitar Reserva', [
                { id: 'data', label: 'Data da Reserva', type: 'date' },
                { id: 'hora', label: 'Horário', type: 'time', placeholder: 'Seg-Sex 08-22h, Sáb 08-18h' }
            ], (data) => {
                if (!data.data || !data.hora) return;
                db.reservas.push({
                    id: Date.now().toString(),
                    userName: currentUser.name,
                    userEmail: currentUser.email,
                    ambiente: amb.nome,
                    data: `${data.data} às ${data.hora}`,
                    status: 'Pendente',
                    createdAt: Date.now()
                });
                saveDB();
                alert('Solicitação enviada com sucesso! Aguarde a aprovação da gestão.');
            });
        }

        if (action === 'confirm-reserva') {
            const index = db.reservas.findIndex(r => r.id === id);
            db.reservas[index].status = actionBtn.dataset.status;
            saveDB();
            renderReservas();
        }
    }
});

document.addEventListener('submit', (e) => {
    e.preventDefault();
    const t = e.target;

    if (t.id === 'login-form') {
        const email = document.getElementById('email').value;
        const pass = document.getElementById('password').value;
        const user = validateAccess(email, pass);
        if (user) {
            currentUser = user;
            saveSession();
            initDashboard();
        } else {
            alert('Credenciais inválidas.');
        }
    }

    if (t.id === 'register-form') {
        const email = document.getElementById('reg-email').value;
        const name = document.getElementById('reg-name').value;
        const pass = document.getElementById('reg-password').value;
        if (email.endsWith('@sp.senai.br')) {
            db.users.push({ name, email, password: pass, role: 'Usuário Padrão' });
            saveDB();
            alert('Cadastro realizado! Agora faça login com seu e-mail.');
            document.getElementById('go-to-login').click();
        } else {
            alert('Apenas e-mails institucionais @sp.senai.br podem se cadastrar.');
        }
    }

    if (t.id === 'layout-form') {
        db.layout.primaryColor = document.getElementById('primary-color-pick').value;
        db.layout.bannerTitle = document.getElementById('layout-banner-title').value;
        db.layout.bannerText = document.getElementById('layout-banner-text').value;
        saveDB();
        updateUIByRole();
        alert('Layout atualizado com sucesso!');
    }
});

// --- Inicialização ---

if (currentUser) {
    initDashboard();
}

// Inicializar Ambiente Padrão se o DB estiver vazio (reset manual)
if (db.ambientes.length === 0) {
    db.ambientes = [{ id: '1', nome: 'Sala 04', capacidade: 40, recursos: 'Projetor, 40 cadeiras, Wi-Fi, Lousa digital.' }];
    saveDB();
}
