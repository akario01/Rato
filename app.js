// ===================================================================
// ARQUIVO: app.js (VERSÃO FINAL FLEXÍVEL E SEGURA)
// ===================================================================

// ✅✅✅ CONFIGURAÇÃO SEGURA ✅✅✅
// Altere apenas o número abaixo para definir o tempo de bloqueio.
// 60 = 1 hora de antecedência
// 30 = 30 minutos de antecedência
// 0  = Sem bloqueio
const TEMPO_MINIMO_AGENDAMENTO_MINUTOS = 60;

// ===================================================================
// (Não altere mais nada abaixo desta linha)
// ===================================================================

document.addEventListener('DOMContentLoaded', () => {
    // --- 1. INICIALIZAÇÃO ---
    if (!firebase.apps.length) {
        try {
            firebase.initializeApp(config.firebaseConfig);
        } catch (e) {
            console.error("Erro ao inicializar o Firebase.", e);
            alert("Erro de configuração. Não foi possível conectar ao sistema de agendamento.");
        }
    }
    const db = firebase.firestore();
    const auth = firebase.auth();

    auth.onAuthStateChanged(user => {
        if (!user) {
            auth.signInAnonymously().catch(error => {
                console.error("Erro no login anônimo:", error);
                alert("Não foi possível conectar ao sistema de agendamento. Verifique sua conexão e tente recarregar a página.");
            });
        }
    });

    // --- 2. ELEMENTOS DA PÁGINA (código original) ---
    const logo = document.getElementById('logo-barbearia');
    const nomeBarbearia = document.getElementById('nome-barbearia');
    const footerName = document.getElementById('footer-barber-name');
    const servicePicker = document.getElementById('service-picker');
    const datePicker = document.getElementById('date-picker');
    const timesContainer = document.getElementById('times-container');
    const timeSlotsSection = document.getElementById('time-slots');
    const bookingFormSection = document.getElementById('booking-form');
    const form = document.getElementById('form');
    const clientPhoneInput = document.getElementById('client-phone');
    const loadingSpinner = document.getElementById('loading-spinner');
    const submitButton = form.querySelector('button');

    let agendamentosDoDia = [];

    // --- 3. FUNÇÕES PRINCIPAIS (código original) ---

    function getHorariosDoDia(dataSelecionada) {
        const diaSemana = new Date(dataSelecionada + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' }).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const excecao = config.horariosExcecao?.find(e => e.dia === diaSemana);
        if (excecao) {
            return {
                inicio: excecao.horarioInicio,
                fim: excecao.horarioFim,
                almocoInicio: excecao.semAlmoco ? null : (excecao.horarioAlmocoInicio || config.horarioAlmocoInicio),
                almocoFim: excecao.semAlmoco ? null : (excecao.horarioAlmocoFim || config.horarioAlmocoFim)
            };
        }
        return {
            inicio: config.horarioInicio,
            fim: config.horarioFim,
            almocoInicio: config.horarioAlmocoInicio,
            almocoFim: config.horarioAlmocoFim
        };
    }

    function isHorarioDisponivel(horarioInicio, duracaoServico, selectedDate) {
        const horarioFimServico = new Date(horarioInicio.getTime() + duracaoServico * 60000);
        const horariosDoDia = getHorariosDoDia(selectedDate);

        const fimExpediente = new Date(`${selectedDate}T${horariosDoDia.fim}`);
        if (horarioFimServico > fimExpediente) return false;

        if (horariosDoDia.almocoInicio && horariosDoDia.almocoFim) {
            const almocoInicio = new Date(`${selectedDate}T${horariosDoDia.almocoInicio}`);
            const almocoFim = new Date(`${selectedDate}T${horariosDoDia.almocoFim}`);
            if (horarioInicio < almocoFim && horarioFimServico > almocoInicio) return false;
        }

        for (const agendamento of agendamentosDoDia) {
            const agendamentoInicio = new Date(`${selectedDate}T${agendamento.horario}`);
            const agendamentoFim = new Date(agendamentoInicio.getTime() + agendamento.duracao * 60000);
            if (horarioInicio < agendamentoFim && horarioFimServico > agendamentoInicio) return false;
        }
        return true;
    }

    function carregarInfoBarbearia() {
        document.title = `${config.nomeBarbearia} - Agendamento`;
        logo.src = config.logoUrl;
        logo.alt = `Logo da ${config.nomeBarbearia}`;
        nomeBarbearia.textContent = config.nomeBarbearia;
        footerName.textContent = config.nomeBarbearia;
    }

    function carregarServicos() {
        config.servicos.forEach((service, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${service.nome} (R$ ${service.preco})`;
            servicePicker.appendChild(option);
        });
    }

    function configurarDatePicker() {
        const today = new Date();
        const maxDate = new Date();
        maxDate.setDate(today.getDate() + 30);
        datePicker.setAttribute('min', today.toISOString().split('T')[0]);
        datePicker.setAttribute('max', maxDate.toISOString().split('T')[0]);
        datePicker.addEventListener('change', () => {
            datePicker.classList.toggle('has-value', !!datePicker.value);
            verificarParaMostrarHorarios();
        });
    }

    function verificarParaMostrarHorarios() {
        if (servicePicker.value && datePicker.value) {
            mostrarHorariosDisponiveis(datePicker.value);
        } else {
            timeSlotsSection.classList.add('hidden');
            bookingFormSection.classList.add('hidden');
        }
    }

    async function mostrarHorariosDisponiveis(selectedDate) {
        timeSlotsSection.classList.remove('hidden');
        bookingFormSection.classList.add('hidden');
        timesContainer.innerHTML = '<div class="loading-spinner"></div>';

        const diaDaSemana = new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long' }).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace('-feira', '');
        const isDiaDeTrabalhoNormal = config.diasDeTrabalho.includes(diaDaSemana);
        const isDataExtra = config.datasDeTrabalhoExtra.includes(selectedDate);
        const isDataBloqueada = config.datasBloqueadas.includes(selectedDate);

        let barbeariaAberta = (!isDataBloqueada && (isDiaDeTrabalhoNormal || isDataExtra));
        if (!barbeariaAberta) {
            timesContainer.innerHTML = '<p>A barbearia está fechada neste dia.</p>';
            return;
        }

        try {
            const snapshot = await db.collection('agendamentos').where('data', '==', selectedDate).get();
            agendamentosDoDia = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    horario: data.horario,
                    duracao: data.duracao || config.intervaloMinutos
                };
            });
            gerarSlotsDeHorario(selectedDate);
        } catch (error) {
            console.error("Erro ao carregar horários:", error);
            timesContainer.innerHTML = '<p>Não foi possível carregar os horários. Tente novamente.</p>';
        }
    }

    function gerarSlotsDeHorario(selectedDate) {
        timesContainer.innerHTML = '';
        const servicoSelecionado = config.servicos[servicePicker.value];
        if (!servicoSelecionado) return;

        const horariosDoDia = getHorariosDoDia(selectedDate);
        const hojeString = new Date().toISOString().split('T')[0];
        const agora = new Date();

        // ✅ MELHORIA: Usa a variável de configuração definida no topo deste arquivo.
        const horarioMinimo = new Date(agora.getTime() + TEMPO_MINIMO_AGENDAMENTO_MINUTOS * 60000);

        const inicioExpediente = new Date(`${selectedDate}T${horariosDoDia.inicio}`);
        const fimExpediente = new Date(`${selectedDate}T${horariosDoDia.fim}`);
        let horarioAtual = inicioExpediente;
        let algumHorarioDisponivel = false;

        while (horarioAtual < fimExpediente) {
            const horarioString = horarioAtual.toTimeString().substring(0, 5);
            const timeButton = document.createElement('button');
            timeButton.className = 'time-btn';
            timeButton.textContent = horarioString;
            timeButton.dataset.time = horarioString;

            const horarioBloqueado = selectedDate === hojeString && horarioAtual < horarioMinimo;
            const disponivel = isHorarioDisponivel(horarioAtual, servicoSelecionado.duracao, selectedDate);

            if (disponivel && !horarioBloqueado) {
                algumHorarioDisponivel = true;
            } else {
                timeButton.disabled = true;
            }
            timesContainer.appendChild(timeButton);
            horarioAtual.setMinutes(horarioAtual.getMinutes() + config.intervaloMinutos);
        }

        if (!algumHorarioDisponivel) {
            timesContainer.innerHTML = '<p>Não há horários disponíveis para este dia com o serviço selecionado.</p>';
        }
    }

    // --- 4. MÁSCARA DE TELEFONE E EVENTOS (código original) ---
    clientPhoneInput.addEventListener('input', (e) => {
        let value = e.target.value.replace(/\D/g, '');
        value = value.substring(0, 11);
        e.target.value = value.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3').replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
    });

    carregarInfoBarbearia();
    carregarServicos();
    configurarDatePicker();
    servicePicker.addEventListener('change', verificarParaMostrarHorarios);

    timesContainer.addEventListener('click', (event) => {
        if (event.target.classList.contains('time-btn') && !event.target.disabled) {
            document.querySelectorAll('.time-btn').forEach(btn => btn.classList.remove('selected'));
            event.target.classList.add('selected');
            bookingFormSection.classList.remove('hidden');
            bookingFormSection.scrollIntoView({ behavior: 'smooth' });
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        loadingSpinner.classList.remove('hidden');
        submitButton.disabled = true;

        const clientName = document.getElementById('client-name').value;
        const rawPhone = clientPhoneInput.value.replace(/\D/g, '');
        const selectedDate = datePicker.value;
        const selectedTimeBtn = document.querySelector('.time-btn.selected');
        const selectedServiceIndex = servicePicker.value;
        const service = config.servicos[selectedServiceIndex];

        if (!selectedTimeBtn || !service) {
            alert('Por favor, selecione todos os campos.');
            loadingSpinner.classList.add('hidden');
            submitButton.disabled = false;
            return;
        }
        if (rawPhone.length < 10 || rawPhone.length > 11) {
            alert('Por favor, digite um telefone válido com DDD (10 ou 11 dígitos).');
            loadingSpinner.classList.add('hidden');
            submitButton.disabled = false;
            return;
        }
        const finalPhone = `55${rawPhone}`;
        const selectedTime = selectedTimeBtn.dataset.time;

        try {
            await db.collection('agendamentos').add({
                nomeCliente: clientName,
                telefoneCliente: finalPhone,
                data: selectedDate,
                horario: selectedTime,
                servicoNome: service.nome,
                servicoPreco: service.preco,
                duracao: service.duracao,
                timestamp: firebase.firestore.FieldValue.serverTimestamp()
            });

            const formattedDate = new Date(selectedDate + 'T12:00:00').toLocaleDateString('pt-BR');
            const message = `Novo Agendamento!\n\n*Cliente:* ${clientName}\n*Data:* ${formattedDate}\n*Horário:* ${selectedTime}\n*Serviço:* ${service.nome}`;
            const whatsappUrl = `https://api.whatsapp.com/send?phone=${config.telefoneWhatsapp}&text=${encodeURIComponent(message  )}`;
            window.open(whatsappUrl, '_blank');

            alert('Agendamento realizado com sucesso!');
            location.reload();

        } catch (error) {
            console.error("Erro ao agendar:", error);
            alert('Ocorreu um erro ao tentar agendar. Por favor, tente novamente.');
        } finally {
            loadingSpinner.classList.add('hidden');
            submitButton.disabled = false;
        }
    });

    // --- 5. ACESSO SECRETO AO ADMIN (código original) ---
    if (logo) {
        let clickCount = 0;
        let firstClickTime = null;
        logo.addEventListener('click', () => {
            const now = new Date().getTime();
            if (clickCount === 0 || (now - firstClickTime > 2000)) {
                clickCount = 1;
                firstClickTime = now;
            } else {
                clickCount++;
                if (clickCount === 5) window.location.href = 'admin.html';
            }
        });
    }
});
