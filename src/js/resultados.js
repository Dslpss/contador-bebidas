import { db } from './firebase-init';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import Chart from 'chart.js/auto';
import '../css/styles.css';

function addDebugInfo(info) {
  const debugElement = document.getElementById('debug');
  debugElement.innerHTML += `<p class="mb-2">${info}</p>`;
}

function parseValue(value) {
  if (typeof value === 'string') {
    const match = value.match(/(\d+)\s*=\s*(\d+)/);
    if (match) {
      return parseInt(match[2], 10);
    }
    return parseInt(value.replace(/[^\d]/g, ''), 10) || 0;
  }
  return typeof value === 'number' ? value : 0;
}

function showLoading(show) {
  document.getElementById('loading').style.display = show ? 'flex' : 'none';
}

function showNotification(message) {
  const notification = document.getElementById('notification');
  notification.textContent = message;
  notification.classList.remove('hidden');
  setTimeout(() => notification.classList.add('hidden'), 3000);
}

function createChart(elementId, data) {
  const ctx = document.getElementById(elementId).getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Object.keys(data),
      datasets: [{
        label: 'Quantidade',
        data: Object.values(data),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

async function carregarResultados() {
  showLoading(true);
  try {
    const dataInput = document.getElementById('dataResultados');
    const dataResultados = new Date(dataInput.value);
    dataResultados.setHours(0, 0, 0, 0);

    addDebugInfo(`Data selecionada: ${dataResultados.toISOString()}`);

    const q = query(
      collection(db, "resultados"),
      orderBy("timestamp", "asc")
    );

    const querySnapshot = await getDocs(q);
    addDebugInfo(`Número de documentos recuperados: ${querySnapshot.size}`);

    let resultadosDia = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const docDate = data.timestamp.toDate();
      docDate.setHours(0, 0, 0, 0);

      if (docDate.getTime() === dataResultados.getTime()) {
        addDebugInfo(`Documento processado: ${JSON.stringify(data)}`);
        resultadosDia.push(data);
      }
    });

    addDebugInfo(`Número de resultados para o dia: ${resultadosDia.length}`);

    if (resultadosDia.length === 0) {
      showNotification('Nenhum resultado encontrado para a data selecionada.');
      return;
    }

    const consolidado = resultadosDia.reduce((acc, resultado) => {
      Object.keys(resultado).forEach(key => {
        if (key !== 'timestamp' && key !== 'tipo') {
          acc[key] = (acc[key] || 0) + parseValue(resultado[key]);
        }
      });
      return acc;
    }, {});

    const resultadosDiv = document.getElementById('resultadosConsolidados');
    let html = "<div class='grid grid-cols-2 gap-4'>";
    for (const [key, value] of Object.entries(consolidado)) {
      html += `
        <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
          <p class="font-semibold text-gray-700 dark:text-gray-300">${key}</p>
          <p class="text-lg text-primary dark:text-secondary">${value}</p>
        </div>
      `;
    }
    html += "</div>";
    resultadosDiv.innerHTML = html;

    createChart('chartResultados', consolidado);

    showNotification('Resultados carregados com sucesso!');
  } catch (error) {
    console.error('Erro ao carregar resultados:', error);
    showNotification('Erro ao carregar resultados. Por favor, tente novamente.');
  } finally {
    showLoading(false);
  }
}

function toggleTheme() {
  document.documentElement.classList.toggle('dark');
}

document.addEventListener("DOMContentLoaded", () => {
  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('dataResultados').value = hoje;
  carregarResultados();

  const toggleDebugBtn = document.getElementById('toggleDebug');
  const debugDiv = document.getElementById('debug');
  toggleDebugBtn.addEventListener('click', () => {
    debugDiv.classList.toggle('hidden');
  });

  // Verificar preferência de tema do usuário
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    document.documentElement.classList.add('dark');
  }

  // Listener para mudanças na preferência de tema do sistema
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
    if (e.matches) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });

  // Adicionar event listeners
  document.getElementById('dataResultados').addEventListener('change', carregarResultados);
  document.querySelector('button[aria-label="Carregar resultados"]').addEventListener('click', carregarResultados);
  document.querySelector('button[aria-label="Alternar tema"]').addEventListener('click', toggleTheme);
});

// Exponha funções globalmente para uso em eventos inline
window.carregarResultados = carregarResultados;
window.toggleTheme = toggleTheme;
