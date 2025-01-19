import { firebaseConfig } from './config';
import '../css/styles.css';
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc, query, getDocs, orderBy, deleteDoc } from 'firebase/firestore';
import Chart from 'chart.js/auto';
import 'chartjs-adapter-date-fns';

// Inicialize o Firebase
let app, db;
try {
  app = initializeApp(firebaseConfig);
  console.log('Firebase inicializado com sucesso:', app);
  db = getFirestore(app);
  console.log('Firestore inicializado:', db);
} catch (error) {
  console.error('Erro ao inicializar o Firebase:', error);
}

let tiposBebidas = [
  { id: "latas", nome: "Latas", unidadesPorPacote: 6 },
  { id: "aguas", nome: "Águas", unidadesPorPacote: 6 },
  { id: "sucos", nome: "Sucos", unidadesPorPacote: 6 },
  { id: "h2o", nome: "H2O", unidadesPorPacote: 7 },
  { id: "monsters", nome: "Monsters", unidadesPorPacote: 6 },
  { id: "aguas_coco", nome: "Águas de Coco", unidadesPorPacote: 6 },
  { id: "long_neck", nome: "Long Neck", unidadesPorPacote: 6 },
  { id: "ice", nome: "Ice", unidadesPorPacote: 6 },
];

function salvarTiposBebidas() {
  localStorage.setItem("tiposBebidas", JSON.stringify(tiposBebidas));
}

function carregarTiposBebidas() {
  const bebidasSalvas = localStorage.getItem("tiposBebidas");
  if (bebidasSalvas) {
    tiposBebidas = JSON.parse(bebidasSalvas);
  }
}

function salvarValoresCampos() {
  const valores = {};
  tiposBebidas.forEach((bebida) => {
    valores[bebida.id] = document.getElementById(bebida.id).value;
    valores[`${bebida.id}_avulsas`] = document.getElementById(`${bebida.id}_avulsas`).value;
    valores[`${bebida.id}_manual`] = document.getElementById(`${bebida.id}_manual`).value;
  });
  localStorage.setItem('valoresCampos', JSON.stringify(valores));
}

function carregarValoresCampos() {
  const valores = JSON.parse(localStorage.getItem('valoresCampos'));
  if (valores) {
    tiposBebidas.forEach((bebida) => {
      if (valores[bebida.id]) document.getElementById(bebida.id).value = valores[bebida.id];
      if (valores[`${bebida.id}_avulsas`]) document.getElementById(`${bebida.id}_avulsas`).value = valores[`${bebida.id}_avulsas`];
      if (valores[`${bebida.id}_manual`]) document.getElementById(`${bebida.id}_manual`).value = valores[`${bebida.id}_manual`];
    });
  }
}

function gerarCamposEntrada() {
  const containerAutomatico = document.getElementById("camposBebidas");
  const containerManual = document.getElementById("camposBebidasManual");
  containerAutomatico.innerHTML = "";
  containerManual.innerHTML = "";

  tiposBebidas.forEach((bebida) => {
    const divAutomatico = document.createElement("div");
    divAutomatico.className = "grid grid-cols-1 md:grid-cols-2 gap-4";
    divAutomatico.innerHTML = `
      <div>
        <label for="${bebida.id}" class="block text-sm font-medium text-gray-700">${bebida.nome} (Pacotes)</label>
        <div class="mt-1 relative rounded-md shadow-sm">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i class="fas fa-wine-bottle text-gray-400"></i>
          </div>
          <input type="text" id="${bebida.id}" class="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md" aria-label="${bebida.nome}" placeholder="Valores separados por vírgula" />
        </div>
      </div>
      <div>
        <label for="${bebida.id}_avulsas" class="block text-sm font-medium text-gray-700">${bebida.nome} Avulsas</label>
        <div class="mt-1 relative rounded-md shadow-sm">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i class="fas fa-plus text-gray-400"></i>
          </div>
          <input type="text" id="${bebida.id}_avulsas" class="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md" aria-label="${bebida.nome} Avulsas" placeholder="Valores separados por vírgula" />
        </div>
      </div>
    `;
    containerAutomatico.appendChild(divAutomatico);

    const divManual = document.createElement("div");
    divManual.innerHTML = `
      <label for="${bebida.id}_manual" class="block text-sm font-medium text-gray-700">${bebida.nome}</label>
      <input type="text" id="${bebida.id}_manual" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="Valores separados por vírgula">
    `;
    containerManual.appendChild(divManual);
  });

  carregarValoresCampos();
}

function calcularTotal(input) {
  const valores = input.split(',').map(valor => parseFloat(valor.trim())).filter(val => !isNaN(val));
  return valores.reduce((acc, curr) => acc + curr, 0);
}

function calcularAutomatico() {
  const resultados = {};
  tiposBebidas.forEach((bebida) => {
    const pacotesInput = document.getElementById(bebida.id).value;
    const avulsasInput = document.getElementById(`${bebida.id}_avulsas`).value;
    
    const pacotes = calcularTotal(pacotesInput);
    const avulsas = calcularTotal(avulsasInput);
    
    resultados[bebida.id] = (pacotes * bebida.unidadesPorPacote) + avulsas;
  });
  return resultados;
}

function calcularManual() {
  const resultados = {};
  tiposBebidas.forEach((bebida) => {
    const input = document.getElementById(`${bebida.id}_manual`).value;
    resultados[bebida.id] = calcularTotal(input);
  });
  return resultados;
}

function exibirResultados(resultados, tipo) {
  const containerResultados = document.getElementById(tipo === 'automatico' ? 'resultados' : 'resultado_manual_display');
  containerResultados.innerHTML = '';
  Object.entries(resultados).forEach(([bebida, quantidade]) => {
    const bebidaInfo = tiposBebidas.find(b => b.id === bebida);
    if (bebidaInfo) {
      containerResultados.innerHTML += `<p>${bebidaInfo.nome}: ${quantidade}</p>`;
    }
  });
}

function salvarResultados(resultados) {
  const turno = document.getElementById('turno').value;
  const data = new Date();
  console.log('Tentando salvar resultados:', { data, turno, resultados });
  addDoc(collection(db, "consumo"), {
    data: data,
    turno: turno,
    resultados: resultados
  }).then(() => {
    console.log('Resultados salvos com sucesso');
    mostrarNotificacao("Resultados salvos com sucesso!");
  }).catch((error) => {
    console.error("Erro ao salvar resultados:", error);
    mostrarNotificacao("Erro ao salvar resultados.", "erro");
  });
}

function mostrarNotificacao(mensagem, tipo = "sucesso") {
  const notification = document.getElementById("notification");
  notification.textContent = mensagem;
  notification.className = `notification ${tipo}`;
  notification.style.display = "block";
  setTimeout(() => {
    notification.style.display = "none";
  }, 3000);
}

function limparCamposAutomaticos() {
  tiposBebidas.forEach((bebida) => {
    document.getElementById(bebida.id).value = "";
    document.getElementById(`${bebida.id}_avulsas`).value = "";
  });
  document.getElementById("resultados").innerHTML = "";
  salvarValoresCampos();
  mostrarNotificacao("Campos automáticos limpos com sucesso!");
}

function limparCamposManuais() {
  tiposBebidas.forEach((bebida) => {
    document.getElementById(`${bebida.id}_manual`).value = "";
  });
  document.getElementById("resultado_manual_display").innerHTML = "";
  salvarValoresCampos();
  mostrarNotificacao("Campos manuais limpos com sucesso!");
}

function inicializarMenuMobile() {
  const mobileMenuButton = document.getElementById('mobileMenuButton');
  const sidebar = document.getElementById('sidebar');

  if (mobileMenuButton && sidebar) {
    mobileMenuButton.addEventListener('click', () => {
      sidebar.classList.toggle('hidden');
      mobileMenuButton.classList.toggle('active');
    });

    // Fechar menu ao clicar em um item do menu
    sidebar.querySelectorAll('a').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth < 768) { // Apenas para telas menores que 768px
          sidebar.classList.add('hidden');
          mobileMenuButton.classList.remove('active');
        }
      });
    });
  }
}

function inicializarEventListeners() {
  document.getElementById("calculoAutomatico").addEventListener("submit", (e) => {
    e.preventDefault();
    const resultados = calcularAutomatico();
    exibirResultados(resultados, 'automatico');
    salvarResultados(resultados);
  });

  document.getElementById("calculoManual").addEventListener("submit", (e) => {
    e.preventDefault();
    const resultados = calcularManual();
    exibirResultados(resultados, 'manual');
    salvarResultados(resultados);
  });

  document.getElementById("limparCamposAutomaticos").addEventListener("click", limparCamposAutomaticos);

  document.getElementById("limparCamposManuais").addEventListener("click", limparCamposManuais);

  document.getElementById("adicionarBebida").addEventListener("click", () => {
    const nome = prompt("Digite o nome da nova bebida:");
    const unidadesPorPacote = parseInt(prompt("Digite o número de unidades por pacote:"));
    if (nome && !isNaN(unidadesPorPacote)) {
      const id = nome.toLowerCase().replace(/ /g, "_");
      tiposBebidas.push({ id, nome, unidadesPorPacote });
      salvarTiposBebidas();
      gerarCamposEntrada();
    }
  });

  document.getElementById("gerenciarBebidas").addEventListener("click", () => {
    const modal = document.getElementById("modalGerenciarBebidas");
    modal.classList.remove("hidden");
    atualizarListaBebidas();
  });

  document.getElementById("fecharModal").addEventListener("click", () => {
    document.getElementById("modalGerenciarBebidas").classList.add("hidden");
  });

  tiposBebidas.forEach((bebida) => {
    document.getElementById(bebida.id).addEventListener('input', salvarValoresCampos);
    document.getElementById(`${bebida.id}_avulsas`).addEventListener('input', salvarValoresCampos);
    document.getElementById(`${bebida.id}_manual`).addEventListener('input', salvarValoresCampos);
  });
}

function atualizarListaBebidas() {
  const listaBebidas = document.getElementById("listaBebidas");
  listaBebidas.innerHTML = "";
  tiposBebidas.forEach((bebida) => {
    const li = document.createElement("li");
    li.innerHTML = `
      ${bebida.nome} (${bebida.unidadesPorPacote} por pacote)
      <button class="excluir-bebida" data-id="${bebida.id}">Excluir</button>
    `;
    listaBebidas.appendChild(li);
  });

  document.querySelectorAll(".excluir-bebida").forEach((button) => {
    button.addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-id");
      tiposBebidas = tiposBebidas.filter((bebida) => bebida.id !== id);
      salvarTiposBebidas();
      atualizarListaBebidas();
      gerarCamposEntrada();
    });
  });
}

async function carregarDadosGrafico() {
  try {
    const q = query(collection(db, "consumo"), orderBy("data", "desc"));
    const querySnapshot = await getDocs(q);
    const dados = {};
    querySnapshot.forEach((doc) => {
      const consumo = doc.data();
      Object.entries(consumo.resultados).forEach(([bebida, quantidade]) => {
        if (!dados[bebida]) {
          dados[bebida] = [];
        }
        dados[bebida].push({ x: consumo.data.toDate(), y: quantidade });
      });
    });
    console.log('Dados carregados com sucesso:', dados);
    return dados;
  } catch (error) {
    console.error('Erro ao carregar dados do gráfico:', error);
    return {};
  }
}

async function atualizarGrafico() {
  try {
    const dados = await carregarDadosGrafico();
    const ctx = document.getElementById('graficoConsumo').getContext('2d');
    new Chart(ctx, {
      type: 'line',
      data: {
        datasets: Object.entries(dados).map(([bebida, valores]) => ({
          label: bebida,
          data: valores,
          borderColor: `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`,
          tension: 0.1
        }))
      },
      options: {
        responsive: true,
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day'
            }
          },
          y: {
            beginAtZero: true
          }
        }
      }
    });
    console.log('Gráfico atualizado com sucesso');
  } catch (error) {
    console.error('Erro ao atualizar o gráfico:', error);
  }
}
document.addEventListener("DOMContentLoaded", async () => {
  try {
    carregarTiposBebidas();
    gerarCamposEntrada();
    carregarValoresCampos();
    inicializarEventListeners();
    inicializarMenuMobile();
    await atualizarGrafico();
    console.log('Inicialização concluída com sucesso');
  } catch (error) {
    console.error('Erro durante a inicialização:', error);
  }
});

// Função para exportar dados (pode ser implementada posteriormente)
function exportarDados() {
  // Implementação da exportação de dados
  console.log("Função de exportar dados não implementada");
  mostrarNotificacao("Exportação de dados não implementada", "erro");
}

// Adicionar evento de clique ao botão de exportar dados
document.getElementById("exportarDados").addEventListener("click", exportarDados);

// Função para atualizar o gráfico periodicamente (se necessário)
function atualizarGraficoPeriodicamente() {
  setInterval(async () => {
    await atualizarGrafico();
  }, 300000); // Atualiza a cada 5 minutos (300000 ms)
}

// Chamar a função para atualizar o gráfico periodicamente
atualizarGraficoPeriodicamente();

// Função para lidar com erros de rede
function handleNetworkError() {
  window.addEventListener('online', () => {
    mostrarNotificacao("Conexão restabelecida", "sucesso");
    // Recarregar dados ou atualizar a interface conforme necessário
  });

  window.addEventListener('offline', () => {
    mostrarNotificacao("Sem conexão de rede", "erro");
  });
}

// Chamar a função para lidar com erros de rede
handleNetworkError();

// Função para validar entradas do usuário
function validarEntrada(input) {
  const regex = /^(\d+(\.\d+)?)(,\s*\d+(\.\d+)?)*$/;
  return regex.test(input.trim());
}

// Adicionar validação aos campos de entrada
function adicionarValidacaoCampos() {
  const campos = document.querySelectorAll('input[type="text"]');
  campos.forEach(campo => {
    campo.addEventListener('blur', (e) => {
      if (!validarEntrada(e.target.value) && e.target.value !== '') {
        mostrarNotificacao("Formato inválido. Use números separados por vírgula.", "erro");
        e.target.classList.add('border-red-500');
      } else {
        e.target.classList.remove('border-red-500');
      }
    });
  });
}

// Chamar a função para adicionar validação aos campos
adicionarValidacaoCampos();

// Função para salvar o estado da aplicação
function salvarEstadoAplicacao() {
  const estado = {
    tiposBebidas: tiposBebidas,
    valoresCampos: JSON.parse(localStorage.getItem('valoresCampos')),
    // Adicione outros estados conforme necessário
  };
  localStorage.setItem('estadoAplicacao', JSON.stringify(estado));
}

// Função para carregar o estado da aplicação
function carregarEstadoAplicacao() {
  const estadoSalvo = localStorage.getItem('estadoAplicacao');
  if (estadoSalvo) {
    const estado = JSON.parse(estadoSalvo);
    tiposBebidas = estado.tiposBebidas;
    localStorage.setItem('valoresCampos', JSON.stringify(estado.valoresCampos));
    // Restaure outros estados conforme necessário
    gerarCamposEntrada();
    carregarValoresCampos();
  }
}

// Chamar a função para carregar o estado da aplicação ao iniciar
carregarEstadoAplicacao();

// Salvar o estado da aplicação antes de fechar a página
window.addEventListener('beforeunload', salvarEstadoAplicacao);

// Função para lidar com o redimensionamento da janela
function handleWindowResize() {
  const sidebar = document.getElementById('sidebar');
  const mobileMenuButton = document.getElementById('mobileMenuButton');

  window.addEventListener('resize', () => {
    if (window.innerWidth >= 768) {
      sidebar.classList.remove('hidden');
      if (mobileMenuButton) {
        mobileMenuButton.classList.remove('active');
      }
    } else {
      sidebar.classList.add('hidden');
    }
  });
}

// Chamar a função para lidar com o redimensionamento da janela
handleWindowResize();

// Função para melhorar a acessibilidade
function melhorarAcessibilidade() {
  // Adicionar roles e aria-labels apropriados
  const elementos = document.querySelectorAll('button, a, input, select');
  elementos.forEach(elemento => {
    if (!elemento.getAttribute('aria-label')) {
      elemento.setAttribute('aria-label', elemento.innerText || elemento.placeholder || '');
    }
  });

  // Adicionar navegação por teclado
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const modal = document.getElementById('modalGerenciarBebidas');
      if (!modal.classList.contains('hidden')) {
        modal.classList.add('hidden');
      }
    }
  });
}

// Chamar a função para melhorar a acessibilidade
melhorarAcessibilidade();

// Função para implementar tema escuro (pode ser expandida posteriormente)
function implementarTemaEscuro() {
  // Esta é uma implementação básica. Você pode expandir isso com um toggle de tema completo.
  const botaoTema = document.createElement('button');
  botaoTema.innerText = 'Alternar Tema';
  botaoTema.classList.add('custom-button', 'mt-4');
  botaoTema.addEventListener('click', () => {
    document.body.classList.toggle('dark-mode');
    // Adicione lógica adicional para alternar classes em outros elementos conforme necessário
  });
  document.querySelector('main').appendChild(botaoTema);
}

// Chamar a função para implementar o tema escuro
implementarTemaEscuro();

// Adicione quaisquer outras funções ou lógica necessária aqui

