// =================================================
// ARQUIVO DE CONFIGURAÇÃO COMPLETO - VERSÃO CORRIGIDA
// =================================================

const config = {
    // --- INFORMAÇÕES GERAIS DA BARBEARIA ---
    nomeBarbearia: "Rato Barbearia",
    logoUrl: "logo.jpg",
    telefoneWhatsapp: "5519995027183",

    // --- CONFIGURAÇÃO DO FIREBASE (SINTAXE CORRIGIDA) ---
    firebaseConfig: {
        apiKey: "AIzaSyA_LWvjqt2EFjbzennEQV1kh_7e0aqQvm8",
        authDomain: "akario-barbearias.firebaseapp.com",
        projectId: "akario-barbearias",
        storageBucket: "akario-barbearias.firebasestorage.app",
        messagingSenderId: "9834754555",
        appId: "1:9834754555:web:464f1f4397dbd329841b5e"
    }, // <-- CORRIGIDO: Usando vírgula para separar as propriedades

    // --- SERVIÇOS OFERECIDOS ---
    servicos: [
        { nome: "Corte Degrade ou Tradicional", preco: "35,00", duracao: 30 },
        { nome: "Barba Desenhada", preco: "30,00", duracao: 30 },
        { nome: "Selagem", preco: "60,00", duracao: 60 },
        { nome: "Corte Navalhado", preco: "40,00", duracao: 30 },
        { nome: "Corte e Barba", preco: "60,00", duracao: 60 }
    ],

    // --- HORÁRIOS DE FUNCIONAMENTO (PADRÃO DE SEGUNDA A SEXTA) ---
    horarioInicio: "09:00",
    horarioFim: "19:00",
    intervaloMinutos: 30,

    // --- HORÁRIO DE ALMOÇO (PADRÃO DE SEGUNDA A SEXTA) ---
    horarioAlmocoInicio: "11:30",
    horarioAlmocoFim: "13:00",

    // --- REGRAS ESPECIAIS ---
    horariosExcecao: [
        {
            dia: "sabado",
            horarioInicio: "09:00",
            horarioFim: "14:00",
            semAlmoco: true
        }
    ],

    // --- CALENDÁRIO FLEXÍVEL ---
    diasDeTrabalho: ["segunda", "terca", "quarta", "quinta", "sexta", "sabado"],
    datasDeTrabalhoExtra: [],
    datasBloqueadas: ["2025-12-25", "2026-01-01"]
};
