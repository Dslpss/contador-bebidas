// src/js/resultados.js

import { firebaseConfig } from './config.js';

// Inicialize o Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

let allResults = [];

async function carregarResultados() {
    try {
        const resultadosContainer = document.getElementById('resultados-container');
        resultadosContainer.innerHTML = '<p class="text-center">Carregando resultados...</p>';

        const q = db.collection("consumo").orderBy("data", "desc");
        const querySnapshot = await q.get();

        allResults = [];
        let html = '<div class="overflow-x-auto"><table class="min-w-full divide-y divide-gray-200">';
        html += '<thead class="bg-gray-50"><tr><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Turno</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Resultados</th><th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th></tr></thead>';
        html += '<tbody class="bg-white divide-y divide-gray-200">';

        querySnapshot.forEach((doc) => {
            const dados = doc.data();
            const data = dados.data.toDate().toLocaleString();
            const turno = dados.turno;
            const resultados = Object.entries(dados.resultados)
                .map(([bebida, quantidade]) => `${bebida}: ${quantidade}`)
                .join(', ');

            allResults.push({id: doc.id, ...dados});

            html += `<tr>
                <td class="px-6 py-4 whitespace-nowrap text-sm">${data}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm">${turno}</td>
                <td class="px-6 py-4 text-sm">${resultados}</td>
                <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <button onclick="editarResultado('${doc.id}')" class="text-indigo-600 hover:text-indigo-900 mr-2">Editar</button>
                    <button onclick="excluirResultado('${doc.id}')" class="text-red-600 hover:text-red-900">Excluir</button>
                </td>
            </tr>`;
        });

        html += '</tbody></table></div>';

        if (querySnapshot.empty) {
            html = '<p class="text-center text-gray-500">Nenhum resultado encontrado.</p>';
        }

        resultadosContainer.innerHTML = html;
    } catch (error) {
        console.error("Erro ao carregar resultados:", error);
        document.getElementById('resultados-container').innerHTML = '<p class="text-center text-red-500">Erro ao carregar resultados. Por favor, tente novamente mais tarde.</p>';
    }
}

window.editarResultado = function(id) {
    const resultado = allResults.find(r => r.id === id);
    if (resultado) {
        document.getElementById('editData').value = resultado.data.toDate().toISOString().slice(0, 16);
        document.getElementById('editTurno').value = resultado.turno;
        
        const editResultados = document.getElementById('editResultados');
        editResultados.innerHTML = '';
        Object.entries(resultado.resultados).forEach(([bebida, quantidade]) => {
            editResultados.innerHTML += `
                <div class="mb-4">
                    <label class="block text-sm font-medium text-gray-700">${bebida}</label>
                    <input type="number" name="${bebida}" value="${quantidade}" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                </div>
            `;
        });

        document.getElementById('editModal').classList.remove('hidden');
        document.getElementById('btnSalvarEdicao').onclick = () => salvarEdicao(id);
    }
}

window.excluirResultado = async function(id) {
    if (confirm('Tem certeza que deseja excluir este resultado?')) {
        try {
            await db.collection("consumo").doc(id).delete();
            mostrarNotificacao('Resultado excluído com sucesso!', 'sucesso');
            carregarResultados();
        } catch (error) {
            console.error("Erro ao excluir resultado:", error);
            mostrarNotificacao('Erro ao excluir resultado. Tente novamente.', 'erro');
        }
    }
}

async function salvarEdicao(id) {
    const form = document.getElementById('editForm');
    const formData = new FormData(form);
    const data = new Date(formData.get('data'));
    const turno = formData.get('turno');
    const resultados = {};

    for (let [key, value] of formData.entries()) {
        if (key !== 'data' && key !== 'turno') {
            resultados[key] = parseInt(value, 10);
        }
    }

    try {
        await db.collection("consumo").doc(id).update({
            data: data,
            turno: turno,
            resultados: resultados
        });
        mostrarNotificacao('Resultado atualizado com sucesso!', 'sucesso');
        document.getElementById('editModal').classList.add('hidden');
        carregarResultados();
      } catch (error) {
        console.error("Erro ao atualizar resultado:", error);
        mostrarNotificacao('Erro ao atualizar resultado. Tente novamente.', 'erro');
    }
}

function mostrarNotificacao(mensagem, tipo) {
    const notification = document.getElementById('notification');
    notification.textContent = mensagem;
    notification.className = `notification ${tipo} fixed top-4 right-4 p-4 rounded-md text-white`;
    
    if (tipo === 'sucesso') {
        notification.classList.add('bg-green-500');
    } else {
        notification.classList.add('bg-red-500');
    }
    
    notification.classList.remove('hidden');
    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

function exportarCSV() {
    let csv = 'Data,Turno,';
    const bebidasSet = new Set();
    allResults.forEach(resultado => {
        Object.keys(resultado.resultados).forEach(bebida => bebidasSet.add(bebida));
    });
    const bebidas = Array.from(bebidasSet);
    csv += bebidas.join(',') + '\n';

    allResults.forEach(resultado => {
        const data = resultado.data.toDate().toLocaleString();
        csv += `"${data}",${resultado.turno},`;
        bebidas.forEach(bebida => {
            csv += (resultado.resultados[bebida] || 0) + ',';
        });
        csv = csv.slice(0, -1) + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "resultados_bebidas.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    sidebar.classList.toggle('hidden');
    sidebar.classList.toggle('md:flex');
}

document.addEventListener('DOMContentLoaded', () => {
    carregarResultados();

    const btnCancelarEdicao = document.getElementById('btnCancelarEdicao');
    if (btnCancelarEdicao) {
        btnCancelarEdicao.addEventListener('click', () => {
            document.getElementById('editModal').classList.add('hidden');
        });
    }

    const btnExportar = document.getElementById('btnExportar');
    if (btnExportar) {
        btnExportar.addEventListener('click', exportarCSV);
    }

    const mobileMenuButton = document.getElementById('mobileMenuButton');
    if (mobileMenuButton) {
        mobileMenuButton.addEventListener('click', toggleSidebar);
    }

    // Fechar o sidebar ao clicar fora dele em dispositivos móveis
    document.addEventListener('click', (event) => {
        const sidebar = document.getElementById('sidebar');
        const mobileMenuButton = document.getElementById('mobileMenuButton');
        
        if (!sidebar.contains(event.target) && !mobileMenuButton.contains(event.target) && !sidebar.classList.contains('hidden')) {
            toggleSidebar();
        }
    });

    // Ajustar o sidebar quando a janela for redimensionada
    window.addEventListener('resize', () => {
        const sidebar = document.getElementById('sidebar');
        if (window.innerWidth >= 768) { // 768px é o breakpoint para md no Tailwind
            sidebar.classList.remove('hidden');
            sidebar.classList.add('md:flex');
        } else {
            sidebar.classList.add('hidden');
            sidebar.classList.remove('md:flex');
        }
    });
});
