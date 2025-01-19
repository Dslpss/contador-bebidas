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

function calcularVendas(contagens) {
  if (contagens.length < 4) {
    addDebugInfo(`Contagens insuficientes: ${contagens.length}`);
    return null;
  }
  
  const segundaContagem = contagens[1];
  const quartaContagem = contagens[3];
  
  const calcularDiferenca = (inicial, final) => {
    const diff = inicial - final;
    return diff >= 0 ? diff : 0;
  };
  
  return {
    latas: calcularDiferenca(segundaContagem.latas, quartaContagem.latas),
    aguas: calcularDiferenca(segundaContagem.aguas, quartaContagem.aguas),
    sucos: calcularDiferenca(segundaContagem.sucos, quartaContagem.sucos),
    h2o: calcularDiferenca(segundaContagem.h2o, quartaContagem.h2o),
    monsters: calcularDiferenca(segundaContagem.monsters, quartaContagem.monsters),
    aguasCoco: calcularDiferenca(segundaContagem.aguasCoco, quartaContagem.aguasCoco),
    longNeck: calcularDiferenca(segundaContagem.longNeck, quartaContagem.longNeck),
    observacao: `Calculado com a 2ª e 4ª contagens`
  };
}

function exibirRelatorio(vendas, elemento) {
  if (!vendas) {
    elemento.innerHTML = "<p class='text-gray-500 dark:text-gray-400'>Dados insuficientes para calcular as vendas.</p>";
    return;
  }

  let html = "<div class='grid grid-cols-2 gap-4'>";
  for (const [key, value] of Object.entries(vendas)) {
    if (key === 'observacao') {
      html += `<p class="col-span-2 mt-4 text-sm text-gray-500 dark:text-gray-400">${value}</p>`;
    } else {
      html += `
        <div class="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
          <p class="font-semibold text-gray-700 dark:text-gray-300">${key}</p>
          <p class="text-lg text-primary dark:text-secondary">${typeof value === 'number' ? value : 'N/A'}</p>
        </div>
      `;
    }
  }
  html += "</div>";
  elemento.innerHTML = html;
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
      labels: Object.keys(data).filter(key => key !== 'observacao'),
      datasets: [{
        label: 'Vendas',
        data: Object.values(data).filter(value => typeof value === 'number'),
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

async function carregarRelatorio() {
  showLoading(true);
  try {
    const dataInput = document.getElementById('dataRelatorio');
    const dataRelatorio = new Date(dataInput.value);
    dataRelatorio.setHours(0, 0, 0, 0);

    addDebugInfo(`Data selecionada: ${dataRelatorio.toISOString()}`);

    const q = query(
      collection(db, "resultados"),
      orderBy("timestamp", "asc")
    );

    const querySnapshot = await getDocs(q);
    addDebugInfo(`Número de documentos recuperados: ${querySnapshot.size}`);

    let contagensAlmoco = [];
    let contagensJantar = [];

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const docDate = data.timestamp.toDate();
      docDate.setHours(0, 0, 0, 0);

      const diffDays = Math.abs((docDate - dataRelatorio) / (1000 * 60 * 60 * 24));

      if (diffDays <= 1) {
        addDebugInfo(`Documento processado: ${JSON.stringify(data)}`);
        
        const turno = data.turno || "almoco";
        const contagem = {
          latas: parseValue(data.latas),
          aguas: parseValue(data.aguas),
          sucos: parseValue(data.sucos),
          h2o: parseValue(data.h2o_horizontal),
          monsters: parseValue(data.monsters),
          aguasCoco: parseValue(data.aguas_coco),
          longNeck: parseValue(data.long_neck),
          timestamp: data.timestamp.toDate()
        };

        if (turno === "almoco") {
          contagensAlmoco.push(contagem);
        } else {
          contagensJantar.push(contagem);
        }
      }
    });

    contagensAlmoco.sort((a, b) => a.timestamp - b.timestamp);
    contagensJantar.sort((a, b) => a.timestamp - b.timestamp);

    addDebugInfo(`Número de contagens para Almoço: ${contagensAlmoco.length}`);
    addDebugInfo(`Número de contagens para Jantar: ${contagensJantar.length}`);

    if (contagensAlmoco.length >= 4) {
      addDebugInfo(`Segunda Contagem Almoço: ${JSON.stringify(contagensAlmoco[1])}`);
      addDebugInfo(`Quarta Contagem Almoço: ${JSON.stringify(contagensAlmoco[3])}`);
    } else {
      addDebugInfo(`Contagens insuficientes para Almoço`);
    }
    if (contagensJantar.length >= 4) {
      addDebugInfo(`Segunda Contagem Jantar: ${JSON.stringify(contagensJantar[1])}`);
      addDebugInfo(`Quarta Contagem Jantar: ${JSON.stringify(contagensJantar[3])}`);
    } else {
      addDebugInfo(`Contagens insuficientes para Jantar`);
    }

    const vendasAlmoco = calcularVendas(contagensAlmoco);
    const vendasJantar = calcularVendas(contagensJantar);

    exibirRelatorio(vendasAlmoco, document.getElementById("relatorioAlmoco"));
    exibirRelatorio(vendasJantar, document.getElementById("relatorioJantar"));

    createChart('chartAlmoco', vendasAlmoco);
    createChart('chartJantar', vendasJantar);

    addDebugInfo(`Vendas Almoço: ${JSON.stringify(vendasAlmoco)}`);
    addDebugInfo(`Vendas Jantar: ${JSON.stringify(vendasJantar)}`);

    showNotification('Relatório carregado com sucesso!');
  } catch (error) {
    console.error('Erro ao carregar relatório:', error);
    showNotification('Erro ao carregar relatório. Por favor, tente novamente.');
  } finally {
    showLoading(false);
  }
}

function exportarPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.text('Relatório de Vendas de Bebidas', 20, 20);
  
  // Adicionar dados do almoço
  doc.text('Almoço:', 20, 30);
  let y = 40;
  const relatorioAlmoco = document.getElementById('relatorioAlmoco');
  relatorioAlmoco.querySelectorAll('div > div').forEach(item => {
    const text = item.textContent.replace(/\n/g, ' ').trim();
    doc.text(text, 30, y);
    y += 10;
  });

  // Adicionar dados do jantar
  doc.text('Jantar:', 20, y + 10);
  y += 20;
  const relatorioJantar = document.getElementById('relatorioJantar');
  relatorioJantar.querySelectorAll('div > div').forEach(item => {
    const text = item.textContent.replace(/\n/g, ' ').trim();
    doc.text(text, 30, y);
    y += 10;
  });

  doc.save('relatorio_vendas.pdf');
}

function toggleTheme() {
  document.documentElement.classList.toggle('dark');
}

document.addEventListener("DOMContentLoaded", () => {
  const hoje = new Date().toISOString().split('T')[0];
  document.getElementById('dataRelatorio').value = hoje;
  carregarRelatorio();

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
  document.getElementById('dataRelatorio').addEventListener('change', carregarRelatorio);
  document.querySelector('button[aria-label="Carregar relatório"]').addEventListener('click', carregarRelatorio);
  document.querySelector('button[aria-label="Exportar PDF"]').addEventListener('click', exportarPDF);
  document.querySelector('button[aria-label="Alternar tema"]').addEventListener('click', toggleTheme);
});

// Exponha funções globalmente para uso em eventos inline
window.carregarRelatorio = carregarRelatorio;
window.exportarPDF = exportarPDF;
window.toggleTheme = toggleTheme;
