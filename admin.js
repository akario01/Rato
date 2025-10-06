/* ===================================================================
   ARQUIVO JAVASCRIPT (JS) V2.5 - LÓGICA DO DASHBOARD PROFISSIONAL
   Correção de Funcionalidade: Adiciona Serviço no Card e Excluir na Agenda.
   =================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. INICIALIZAÇÃO E CONFIGURAÇÃO DO FIREBASE ---
    if (!firebase.apps.length) { firebase.initializeApp(config.firebaseConfig); }
    const auth = firebase.auth();
    const db = firebase.firestore();

    // --- 2. SELETORES DE ELEMENTOS GLOBAIS ---
    const loginSection = document.getElementById('login-section');
    const adminDashboard = document.getElementById('admin-dashboard');
    const loginForm = document.getElementById('login-form');
    const logoutButton = document.getElementById('logout-button');
    const menuItems = document.querySelectorAll('.sidebar-menu .menu-item');
    const sections = document.querySelectorAll('.dashboard-section');
    const loginLogo = document.querySelector('#login-section .logo');
    const sidebarLogo = document.querySelector('.sidebar-logo');

    // --- 3. LÓGICA DE AUTENTICAÇÃO E ESTADO INICIAL ---
    auth.onAuthStateChanged(user => {
        if (user && user.email) {
            loginSection.classList.add('hidden');
            adminDashboard.classList.remove('hidden');
            initializeDashboard();
        } else {
            if (user) auth.signOut();
            loginSection.classList.remove('hidden');
            adminDashboard.classList.add('hidden');
        }
    });

    loginForm.addEventListener('submit', e => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;
        const errorP = document.getElementById('login-error');
        auth.signInWithEmailAndPassword(email, password).catch(error => {
            errorP.textContent = 'Email ou senha inválidos.';
            errorP.style.display = 'block';
        });
    });

    logoutButton.addEventListener('click', () => auth.signOut());

    // --- 4. NAVEGAÇÃO PRINCIPAL DO DASHBOARD ---
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(i => i.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active-section'));
            item.classList.add('active');
            const sectionId = item.dataset.section;
            document.getElementById(sectionId).classList.add('active-section');
        });
    });

    // --- 5. FUNÇÃO DE INICIALIZAÇÃO DO DASHBOARD ---
    function initializeDashboard() {
        loadDashboardData();
        setupAgendaSection();
        setupClientesSection();
        setupFinanceiroSection();
    }

    // --- 6. MÓDULOS DE CADA SEÇÃO ---

    /** MÓDULO 1: DASHBOARD (VISÃO GERAL) */
    async function loadDashboardData() {
        const today = new Date().toISOString().split('T')[0];
        const statAgendamentos = document.getElementById('stat-agendamentos-hoje');
        const statFaturamento = document.getElementById('stat-faturamento-dia');
        const proximosList = document.getElementById('proximos-agendamentos-list');

        try {
            const snapshot = await db.collection('agendamentos').where('data', '>=', today).orderBy('data').orderBy('horario').limit(5).get();
            
            const todaySnapshot = await db.collection('agendamentos').where('data', '==', today).get();
            let faturamentoDia = 0;
            todaySnapshot.forEach(doc => {
                faturamentoDia += parseFloat(doc.data().servicoPreco.replace(',', '.')) || 0;
            });
            statAgendamentos.textContent = todaySnapshot.size;
            statFaturamento.textContent = faturamentoDia.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            proximosList.innerHTML = '';
            if (snapshot.empty) {
                proximosList.innerHTML = '<p>Nenhum agendamento futuro.</p>';
            } else {
                snapshot.forEach(doc => {
                    const app = doc.data();
                    const card = document.createElement('div');
                    card.className = 'appointment-card';
                    const formattedDate = new Date(app.data + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

                    card.innerHTML = `
                        <div class="details">
                            <p><span class="label">Data:</span> ${formattedDate}</p>
                            <p><span class="label">Horário:</span> ${app.horario}</p>
                            <p><span class="label">Nome:</span> ${app.nomeCliente}</p>
                            <!-- ✅ CORREÇÃO FUNCIONAL: Adiciona o serviço ao card -->
                            <p><span class="label">Serviço:</span> ${app.servicoNome}</p>
                        </div>
                        <div class="actions">
                            <button class="profile-btn" data-phone="${app.telefoneCliente}" data-name="${app.nomeCliente}" title="Ver Perfil do Cliente"><i class="fas fa-user"></i></button>
                            <button class="delete-btn" data-id="${doc.id}" title="Excluir Agendamento"><i class="fas fa-trash"></i></button>
                        </div>
                    `;
                    proximosList.appendChild(card);
                });

                proximosList.querySelectorAll('.delete-btn').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const id = e.currentTarget.dataset.id;
                        if (confirm('Tem certeza que deseja excluir este agendamento?')) {
                            db.collection('agendamentos').doc(id).delete().then(() => {
                                alert('Agendamento excluído.');
                                loadDashboardData();
                            });
                        }
                    });
                });
                
                proximosList.querySelectorAll('.profile-btn').forEach(button => {
                    button.addEventListener('click', (e) => {
                        const target = e.currentTarget;
                        initClientProfileModal(db, target.dataset.phone, target.dataset.name, false, loadClientList);
                    });
                });
            }
        } catch (error) {
            console.error("Erro ao carregar dados do dashboard:", error);
            proximosList.innerHTML = '<p>Erro ao carregar agendamentos.</p>';
        }
    }

    /** MÓDULO 2: AGENDA */
    function setupAgendaSection() {
        const datePicker = document.getElementById('agenda-date-picker');
        datePicker.value = new Date().toISOString().split('T')[0];
        loadAgendaGrid(datePicker.value);
        datePicker.addEventListener('change', () => loadAgendaGrid(datePicker.value));
        document.getElementById('add-appointment-btn').addEventListener('click', () => {
            initManualBookingModal(db, datePicker.value, () => loadAgendaGrid(datePicker.value));
        });
    }

    async function loadAgendaGrid(selectedDate) {
        const container = document.getElementById('agenda-grid-container');
        container.innerHTML = '<div class="loading-spinner"></div>';
        const horariosDoDia = getHorariosDoDia(selectedDate);
        const inicio = new Date(`${selectedDate}T${horariosDoDia.inicio}`);
        const fim = new Date(`${selectedDate}T${horariosDoDia.fim}`);
        const agendamentosSnapshot = await db.collection('agendamentos').where('data', '==', selectedDate).get();
        const agendamentosDoDia = agendamentosSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        container.innerHTML = '';
        let horarioAtual = inicio;
        while (horarioAtual < fim) {
            const timeStr = horarioAtual.toTimeString().substring(0, 5);
            const agendamento = agendamentosDoDia.find(app => app.horario === timeStr);
            const slotDiv = document.createElement('div');
            slotDiv.className = 'time-slot';
            if (agendamento) {
                // ✅ CORREÇÃO FUNCIONAL: Adiciona botão de excluir na agenda
                slotDiv.innerHTML = `
                    <div class="time-label">${timeStr}</div>
                    <div class="appointment-block" data-id="${agendamento.id}">
                        <strong>${agendamento.nomeCliente}</strong>
                        <span>${agendamento.servicoNome}</span>
                        <button class="delete-in-agenda-btn" title="Excluir"><i class="fas fa-times"></i></button>
                    </div>`;
                slotDiv.querySelector('.delete-in-agenda-btn').addEventListener('click', (e) => {
                    e.stopPropagation(); // Impede que o clique se propague para outros elementos
                    if (confirm('Tem certeza que deseja excluir este agendamento?')) {
                        db.collection('agendamentos').doc(agendamento.id).delete().then(() => {
                            alert('Agendamento excluído.');
                            loadAgendaGrid(selectedDate); // Recarrega a grade da agenda
                        });
                    }
                });
            } else {
                slotDiv.innerHTML = `
                    <div class="time-label">${timeStr}</div>
                    <div class="empty-slot" data-time="${timeStr}">Vago</div>`;
                slotDiv.querySelector('.empty-slot').addEventListener('click', (e) => {
                    const time = e.target.dataset.time;
                    initManualBookingModal(db, selectedDate, () => loadAgendaGrid(selectedDate), time);
                });
            }
            container.appendChild(slotDiv);
            horarioAtual.setMinutes(horarioAtual.getMinutes() + config.intervaloMinutos);
        }
    }

    /** MÓDULO 3: CLIENTES */
    function setupClientesSection() {
        loadClientList();
        document.getElementById('add-new-client-btn').addEventListener('click', () => {
            initClientProfileModal(db, '', '', true, loadClientList);
        });
        document.getElementById('client-search-input').addEventListener('input', filterClients);
    }

    async function loadClientList() {
        const container = document.getElementById('client-manager-list');
        container.innerHTML = '<div class="loading-spinner"></div>';
        const snapshot = await db.collection('Clientes').orderBy('nome').get();
        container.innerHTML = '';
        if (snapshot.empty) {
            container.innerHTML = '<p>Nenhum cliente cadastrado.</p>';
            return;
        }
        snapshot.forEach(doc => {
            const client = doc.data();
            const itemDiv = document.createElement('div');
            itemDiv.className = 'client-list-item';
            itemDiv.dataset.phone = client.telefone;
            itemDiv.dataset.name = client.nome;
            itemDiv.innerHTML = `
                <div>
                    <strong>${client.nome}</strong>
                    <span>${client.telefone.replace('55', '')}</span>
                </div>
                <i class="fas fa-chevron-right"></i>`;
            itemDiv.addEventListener('click', () => initClientProfileModal(db, client.telefone, client.nome, false, loadClientList));
            container.appendChild(itemDiv);
        });
    }

    function filterClients(e) {
        const term = e.target.value.toLowerCase();
        document.querySelectorAll('#client-manager-list .client-list-item').forEach(item => {
            const name = item.dataset.name.toLowerCase();
            item.style.display = name.includes(term) ? 'flex' : 'none';
        });
    }

    /** MÓDULO 4: FINANCEIRO */
    let revenueChartInstance = null;
    function setupFinanceiroSection() {
        document.getElementById('calculate-revenue-btn').addEventListener('click', calculateAndShowRevenue);
        loadMonthlyRevenueChart();
    }

    async function calculateAndShowRevenue() {
        const start = document.getElementById('start-date').value;
        const end = document.getElementById('end-date').value;
        if (!start || !end) { alert('Selecione as datas de início e fim.'); return; }
        const resultDiv = document.getElementById('revenue-result');
        resultDiv.classList.remove('hidden');
        resultDiv.innerHTML = '<div class="loading-spinner"></div>';
        const snapshot = await db.collection('agendamentos').where('data', '>=', start).where('data', '<=', end).get();
        let total = 0;
        snapshot.forEach(doc => {
            total += parseFloat(doc.data().servicoPreco.replace(',', '.')) || 0;
        });
        resultDiv.innerHTML = `<h3>Faturamento Total: ${total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</h3>`;
    }

    async function loadMonthlyRevenueChart() {
        const ctx = document.getElementById('revenue-chart').getContext('2d');
        const labels = [];
        const data = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthName = d.toLocaleString('pt-BR', { month: 'long' });
            labels.push(monthName.charAt(0).toUpperCase() + monthName.slice(1));
            const startOfMonth = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
            const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
            const snapshot = await db.collection('agendamentos').where('data', '>=', startOfMonth).where('data', '<=', endOfMonth).get();
            let totalMes = 0;
            snapshot.forEach(doc => {
                totalMes += parseFloat(doc.data().servicoPreco.replace(',', '.')) || 0;
            });
            data.push(totalMes);
        }
        if (revenueChartInstance) revenueChartInstance.destroy();
        revenueChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Faturamento Mensal',
                    data: data,
                    backgroundColor: 'rgba(197, 164, 126, 0.8)',
                    borderColor: 'rgba(197, 164, 126, 1)',
                    borderWidth: 1
                }]
            },
            options: { responsive: true, scales: { y: { beginAtZero: true } } }
        });
    }

    /** 7. FUNÇÕES AUXILIARES E MODAIS */
    function getHorariosDoDia(dataSelecionada) {
        const diaSemana = new Date(dataSelecionada + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' }).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const excecao = config.horariosExcecao?.find(e => e.dia === diaSemana);
        if (excecao) return { inicio: excecao.horarioInicio, fim: excecao.horarioFim, almocoInicio: excecao.semAlmoco ? null : (excecao.horarioAlmocoInicio || config.horarioAlmocoInicio), almocoFim: excecao.semAlmoco ? null : (excecao.horarioAlmocoFim || config.horarioAlmocoFim) };
        return { inicio: config.horarioInicio, fim: config.horarioFim, almocoInicio: config.horarioAlmocoInicio, almocoFim: config.horarioAlmocoFim };
    }

    function initManualBookingModal(db, selectedDate, onSaveCallback, preselectedTime = null) {
        const modal = document.getElementById('modal-backdrop');
        const form = document.getElementById('manual-booking-form');
        const cancelBtn = document.getElementById('cancel-modal-btn');
        const servicePicker = document.getElementById('manual-service-picker');
        const timePicker = document.getElementById('manual-time-picker');
        form.reset();
        servicePicker.innerHTML = '<option value="" disabled selected>Selecione um serviço</option>';
        config.servicos.forEach((s, i) => servicePicker.innerHTML += `<option value="${i}">${s.nome}</option>`);
        timePicker.innerHTML = '<option value="" disabled selected>Selecione um serviço</option>';
        timePicker.disabled = true;
        const updateAvailableTimes = async () => {
            timePicker.disabled = false;
            timePicker.innerHTML = '<option value="" disabled selected>Carregando...</option>';
            const snapshot = await db.collection('agendamentos').where('data', '==', selectedDate).get();
            const agendamentosDoDia = snapshot.docs.map(doc => doc.data());
            const servicoSelecionado = config.servicos[servicePicker.value];
            if (!servicoSelecionado) return;
            const horariosDoDia = getHorariosDoDia(selectedDate);
            timePicker.innerHTML = '';
            let horarioAtual = new Date(`${selectedDate}T${horariosDoDia.inicio}`);
            const fimExpediente = new Date(`${selectedDate}T${horariosDoDia.fim}`);
            while (horarioAtual < fimExpediente) {
                const timeStr = horarioAtual.toTimeString().substring(0, 5);
                const isBooked = agendamentosDoDia.some(app => app.horario === timeStr);
                if (!isBooked) timePicker.innerHTML += `<option value="${timeStr}">${timeStr}</option>`;
                horarioAtual.setMinutes(horarioAtual.getMinutes() + config.intervaloMinutos);
            }
            if (preselectedTime) timePicker.value = preselectedTime;
        };
        servicePicker.onchange = updateAvailableTimes;
        modal.classList.remove('hidden');
        form.onsubmit = async (e) => {
            e.preventDefault();
            const service = config.servicos[form['manual-service-picker'].value];
            const data = { nomeCliente: form['manual-client-name'].value, telefoneCliente: `55${form['manual-client-phone'].value.replace(/\D/g, '')}`, data: selectedDate, horario: form['manual-time-picker'].value, servicoNome: service.nome, servicoPreco: service.preco, duracao: service.duracao, timestamp: firebase.firestore.FieldValue.serverTimestamp() };
            await db.collection('agendamentos').add(data);
            alert('Agendamento salvo!');
            modal.classList.add('hidden');
            if (onSaveCallback) onSaveCallback();
        };
        cancelBtn.onclick = () => modal.classList.add('hidden');
    }

    function initClientProfileModal(db, phone, clientName, isNewClient = false, onSaveCallback) {
        const modal = document.getElementById('client-profile-modal-backdrop');
        const form = document.getElementById('client-profile-form');
        const detailsContainer = document.getElementById('client-profile-details');
        const cancelBtn = document.getElementById('close-client-modal-btn');
        const deleteBtn = document.getElementById('delete-client-btn');
        detailsContainer.innerHTML = '<div class="loading-spinner"></div>';
        modal.classList.remove('hidden');
        deleteBtn.classList.toggle('hidden', isNewClient);
        const renderForm = (clientData) => {
            clientData.preferenciasCorte = clientData.preferenciasCorte || {};
            detailsContainer.innerHTML = `
                <div class="input-group"><label for="profile-name">Nome</label><input type="text" id="profile-name" class="input-field" value="${clientData.nome || ''}" required></div>
                <div class="input-group"><label for="profile-phone">Telefone com DDD</label><input type="tel" id="profile-phone" class="input-field" value="${clientData.telefone ? clientData.telefone.replace(/\D/g, '').substring(2) : ''}" ${!isNewClient ? 'disabled' : ''} required></div>
                <div class="input-group"><label for="profile-maquina">Nº Máquina</label><input type="text" id="profile-maquina" class="input-field" value="${clientData.preferenciasCorte.maquina || ''}"></div>
                <div class="input-group"><label for="profile-obs">Observações</label><textarea id="profile-obs" class="input-field">${clientData.preferenciasCorte.observacoes || ''}</textarea></div>
                <div class="input-group"><label for="profile-assunto">Último Assunto</label><input type="text" id="profile-assunto" class="input-field" value="${clientData.ultimoassunto || ''}"></div>`;
        };
        if (isNewClient) {
            renderForm({});
        } else {
            db.collection('Clientes').doc(phone).get().then(doc => {
                renderForm(doc.exists ? doc.data() : { nome: clientName, telefone: phone });
            });
        }
        form.onsubmit = async (e) => {
            e.preventDefault();
            const rawPhone = document.getElementById('profile-phone').value.replace(/\D/g, '');
            if (rawPhone.length < 10 || rawPhone.length > 11) { alert("Telefone inválido."); return; }
            const finalPhone = `55${rawPhone}`;
            const dataToSave = { nome: document.getElementById('profile-name').value, telefone: finalPhone, preferenciasCorte: { maquina: document.getElementById('profile-maquina').value, observacoes: document.getElementById('profile-obs').value }, ultimoassunto: document.getElementById('profile-assunto').value, lastUpdated: firebase.firestore.FieldValue.serverTimestamp() };
            await db.collection('Clientes').doc(finalPhone).set(dataToSave, { merge: true });
            alert('Perfil salvo!');
            modal.classList.add('hidden');
            if (onSaveCallback) onSaveCallback();
        };
        deleteBtn.onclick = async () => {
            if (confirm(`Tem certeza que deseja excluir permanentemente o cliente ${clientName}?`)) {
                await db.collection('Clientes').doc(phone).delete();
                alert('Cliente excluído.');
                modal.classList.add('hidden');
                if (onSaveCallback) onSaveCallback();
            }
        };
        cancelBtn.onclick = () => modal.classList.add('hidden');
    }

    function setupSecretAccess(logoElement, targetUrl) {
        if (!logoElement) return;
        let clickCount = 0;
        let firstClickTime = null;
        logoElement.addEventListener('click', () => {
            const now = new Date().getTime();
            if (clickCount === 0 || (now - firstClickTime > 2000)) {
                clickCount = 1;
                firstClickTime = now;
                return;
            }
            clickCount++;
            if (clickCount === 5) {
                window.location.href = targetUrl;
            }
        });
    }

    setupSecretAccess(loginLogo, 'index.html');
    setupSecretAccess(sidebarLogo, 'index.html');
    
    const clientLogo = document.getElementById('logo-barbearia');
    if (clientLogo) {
        setupSecretAccess(clientLogo, 'admin.html');
    }
});
