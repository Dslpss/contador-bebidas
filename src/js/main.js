import { firebaseConfig } from "./config";
import "../css/styles.css";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  getDocs,
  orderBy,
  deleteDoc,
  where,
} from "firebase/firestore";
import Chart from "chart.js/auto";
import "chartjs-adapter-date-fns";
import zoomPlugin from "chartjs-plugin-zoom";

Chart.register(zoomPlugin);

// Inicialize o Firebase
let app, db;
try {
  app = initializeApp(firebaseConfig);
  console.log("Firebase inicializado com sucesso:", app);
  db = getFirestore(app);
  console.log("Firestore inicializado:", db);
} catch (error) {
  console.error("Erro ao inicializar o Firebase:", error);
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

let historicoManual = [];

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
    valores[`${bebida.id}_avulsas`] = document.getElementById(
      `${bebida.id}_avulsas`
    ).value;
    valores[`${bebida.id}_manual`] = document.getElementById(
      `${bebida.id}_manual`
    ).value;
  });
  localStorage.setItem("valoresCampos", JSON.stringify(valores));
}

function carregarValoresCampos() {
  const valores = JSON.parse(localStorage.getItem("valoresCampos"));
  if (valores) {
    tiposBebidas.forEach((bebida) => {
      if (valores[bebida.id])
        document.getElementById(bebida.id).value = valores[bebida.id];
      if (valores[`${bebida.id}_avulsas`])
        document.getElementById(`${bebida.id}_avulsas`).value =
          valores[`${bebida.id}_avulsas`];
      if (valores[`${bebida.id}_manual`])
        document.getElementById(`${bebida.id}_manual`).value =
          valores[`${bebida.id}_manual`];
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
    divAutomatico.className = "grid grid-cols-2 gap-4 mb-4";
    divAutomatico.innerHTML = `
      <div>
        <label for="${bebida.id}" class="block text-sm font-medium text-gray-700">${bebida.nome} (Pacotes)</label>
        <div class="mt-1 relative rounded-md shadow-sm">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i class="fas fa-box text-gray-400"></i>
          </div>
          <input type="text" id="${bebida.id}" class="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md" aria-label="${bebida.nome} Pacotes" placeholder="Valores separados por vírgula" />
        </div>
      </div>
      <div>
        <label for="${bebida.id}_avulsas" class="block text-sm font-medium text-gray-700">${bebida.nome} (Avulsas)</label>
        <div class="mt-1 relative rounded-md shadow-sm">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i class="fas fa-wine-bottle text-gray-400"></i>
          </div>
          <input type="text" id="${bebida.id}_avulsas" class="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md" aria-label="${bebida.nome} Avulsas" placeholder="Valores separados por vírgula" />
        </div>
      </div>
    `;
    containerAutomatico.appendChild(divAutomatico);

    const divManual = document.createElement("div");
    divManual.className = "mb-4";
    divManual.innerHTML = `
      <label for="${bebida.id}_manual" class="block text-sm font-medium text-gray-700">${bebida.nome}</label>
      <div class="flex items-center">
        <input type="text" id="${bebida.id}_manual" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="Valores separados por vírgula">
        <button id="desfazer_${bebida.id}" class="ml-2 inline-flex items-center px-2 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
          Desfazer
        </button>
      </div>
    `;
    containerManual.appendChild(divManual);

    // Adicionando o evento de clique para o botão de desfazer
    document.getElementById(`desfazer_${bebida.id}`).addEventListener("click", () => {
      desfazerUltimoResultado(bebida.id);
    });
  });

  carregarValoresCampos();
}

function calcularTotal(input) {
  const valores = input
    .split(",")
    .map((valor) => parseFloat(valor.trim()))
    .filter((val) => !isNaN(val));
  return valores.reduce((acc, curr) => acc + curr, 0);
}

function calcularAutomatico() {
  const resultados = {};
  tiposBebidas.forEach((bebida) => {
    const pacotesInput = document.getElementById(bebida.id).value;
    const avulsasInput = document.getElementById(`${bebida.id}_avulsas`).value;

    const pacotes = calcularTotal(pacotesInput);
    const avulsas = calcularTotal(avulsasInput);

    resultados[bebida.id] = pacotes * bebida.unidadesPorPacote + avulsas;
  });
  return resultados;
}

function enviarParaCalculoManual(resultados) {
  tiposBebidas.forEach((bebida) => {
    if (resultados[bebida.id] > 0) {
      const campoManual = document.getElementById(`${bebida.id}_manual`);
      const valorExistente = campoManual.value.trim();
      if (valorExistente) {
        campoManual.value = `${valorExistente}, ${resultados[bebida.id]}`;
      } else {
        campoManual.value = `${resultados[bebida.id]}`;
      }
    }
  });

  // Salvar os valores no localStorage
  salvarValoresNoLocalStorage();

  mostrarNotificacao(
    "Resultados enviados para o cálculo manual com sucesso!",
    "sucesso"
  );

  // Criar e exibir o popup personalizado
  const popup = document.createElement("div");
  popup.innerHTML = `
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full" id="popupOverlay">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div class="mt-3 text-center">
          <h3 class="text-lg leading-6 font-medium text-gray-900">Resultados Transferidos</h3>
          <div class="mt-2 px-7 py-3">
            <p class="text-sm text-gray-500">
              Os resultados foram transferidos para o cálculo manual. Você pode ajustá-los conforme necessário.
            </p>
          </div>
          <div class="items-center px-4 py-3">
            <button id="fecharPopup" class="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-300">
              Entendi
            </button>
          </div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(popup);

  // Adicionar evento para fechar o popup
  document.getElementById("fecharPopup").addEventListener("click", () => {
    document.body.removeChild(popup);
  });

  // Fechar o popup ao clicar fora dele
  document.getElementById("popupOverlay").addEventListener("click", (event) => {
    if (event.target.id === "popupOverlay") {
      document.body.removeChild(popup);
    }
  });
}

function calcularManual() {
  const resultados = {};
  tiposBebidas.forEach((bebida) => {
    const input = document.getElementById(`${bebida.id}_manual`).value;
    resultados[bebida.id] = calcularTotal(input);
  });
  return resultados;
}

// Adicione esta função para coletar os valores atuais
function coletarValoresAtuais() {
  const estadoAtual = {};
  tiposBebidas.forEach((bebida) => {
    const campo = document.getElementById(`${bebida.id}_manual`);
    const valores = campo.value
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v !== "");
    estadoAtual[bebida.id] = valores;
  });
  return estadoAtual;
}

function salvarEstadoManual() {
  const estadoAtual = coletarValoresAtuais();
  historicoManual.push(estadoAtual);
  console.log("Estado salvo:", estadoAtual);
  console.log("Histórico completo:", historicoManual);
}

function desfazerUltimoResultado(bebidaId) {
  const campo = document.getElementById(`${bebidaId}_manual`);
  const valoresAtuais = campo.value.split(",").map((v) => v.trim()).filter((v) => v !== "");
  
  if (valoresAtuais.length > 0) {
    // Remove o último resultado
    valoresAtuais.pop();
    campo.value = valoresAtuais.join(", "); // Atualiza o campo com os valores restantes
    mostrarNotificacao(`Último resultado removido para ${bebidaId}`, "sucesso");
    
    // Não atualizar o localStorage ou enviar dados ao banco aqui
  } else {
    mostrarNotificacao("Não há resultados para desfazer", "erro");
  }
}

function exibirResultados(resultados, tipo) {
  const containerResultados = document.getElementById(
    tipo === "automatico" ? "resultados" : "resultado_manual_display"
  );
  containerResultados.innerHTML = "";
  Object.entries(resultados).forEach(([bebida, quantidade]) => {
    const bebidaInfo = tiposBebidas.find((b) => b.id === bebida);
    if (bebidaInfo) {
      containerResultados.innerHTML += `<p>${bebidaInfo.nome}: ${quantidade}</p>`;
    }
  });

  // Salvar resultados no localStorage
  localStorage.setItem(`${tipo}_resultados`, JSON.stringify(resultados));
}

function salvarResultados(resultados) {
  const turno = document.getElementById("turno").value;
  const data = new Date();
  console.log("Tentando salvar resultados:", { data, turno, resultados });
  addDoc(collection(db, "consumo"), {
    data: data,
    turno: turno,
    resultados: resultados,
  })
    .then(() => {
      console.log("Resultados salvos com sucesso");
      mostrarNotificacao("Resultados salvos com sucesso!");
    })
    .catch((error) => {
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

function confirmarAcao(mensagem) {
  const overlay = document.createElement("div");
  overlay.className =
    "fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50";

  const dialog = document.createElement("div");
  dialog.className = "bg-white p-6 rounded-lg shadow-xl";
  dialog.innerHTML = `
    <p class="mb-4">${mensagem}</p>
    <div class="flex justify-end space-x-2">
      <button id="cancelarAcao" class="px-4 py-2 bg-gray-300 text-gray-800 rounded hover:bg-gray-400">Não</button>
      <button id="confirmarAcao" class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">Sim</button>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  return new Promise((resolve) => {
    document.getElementById("cancelarAcao").addEventListener("click", () => {
      document.body.removeChild(overlay);
      resolve(false);
    });

    document.getElementById("confirmarAcao").addEventListener("click", () => {
      document.body.removeChild(overlay);
      resolve(true);
    });
  });
}

async function limparCamposAutomaticos() {
  const confirmacao = await confirmarAcao(
    "Tem certeza que deseja limpar os campos automáticos?"
  );
  if (confirmacao) {
    tiposBebidas.forEach((bebida) => {
      document.getElementById(bebida.id).value = "";
      document.getElementById(`${bebida.id}_avulsas`).value = "";
    });
    document.getElementById("resultados").innerHTML = "";
    salvarValoresCampos();
    mostrarNotificacao("Campos automáticos limpos com sucesso!");
  }
}

async function limparCamposManuais() {
  const confirmacao = await confirmarAcao(
    "Tem certeza que deseja limpar os campos manuais?"
  );
  if (confirmacao) {
    tiposBebidas.forEach((bebida) => {
      document.getElementById(`${bebida.id}_manual`).value = "";
    });
    document.getElementById("resultado_manual_display").innerHTML = "";
    salvarValoresCampos();
    mostrarNotificacao("Campos manuais limpos com sucesso!");
  }
}

function inicializarMenuMobile() {
  const mobileMenuButton = document.getElementById("mobileMenuButton");
  const sidebar = document.getElementById("sidebar");

  if (mobileMenuButton && sidebar) {
    mobileMenuButton.addEventListener("click", () => {
      sidebar.classList.toggle("hidden");
      mobileMenuButton.classList.toggle("active");
    });

    // Fechar menu ao clicar em um item do menu
    sidebar.querySelectorAll("a").forEach((item) => {
      item.addEventListener("click", () => {
        if (window.innerWidth < 768) {
          // Apenas para telas menores que 768px
          sidebar.classList.add("hidden");
          mobileMenuButton.classList.remove("active");
        }
      });
    });
  }
}

function inicializarEventListeners() {
  document
    .getElementById("calculoAutomatico")
    .addEventListener("submit", (e) => {
      e.preventDefault();
      const resultados = calcularAutomatico();
      exibirResultados(resultados, "automatico");
      salvarValoresCampos();
      mostrarNotificacao("Resultados calculados", "sucesso");
    });

  document.getElementById("enviarParaManual").addEventListener("click", () => {
    salvarEstadoManual(); // Salvar estado antes de enviar para manual
    const resultados = calcularAutomatico();
    enviarParaCalculoManual(resultados);
  });

  document.getElementById("calculoManual").addEventListener("submit", (e) => {
    e.preventDefault(); // Impede o envio padrão do formulário
    salvarEstadoManual(); // Salvar estado atual antes de calcular
    const resultados = calcularManual();
    exibirResultados(resultados, "manual");
  });

  document
    .getElementById("limparCamposAutomaticos")
    .addEventListener("click", limparCamposAutomaticos);

  document
    .getElementById("limparCamposManuais")
    .addEventListener("click", limparCamposManuais);

  document.getElementById("adicionarBebida").addEventListener("click", () => {
    const nome = prompt("Digite o nome da nova bebida:");
    const unidadesPorPacote = parseInt(
      prompt("Digite o número de unidades por pacote:")
    );
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
    document
      .getElementById(bebida.id)
      .addEventListener("input", salvarValoresCampos);
    document
      .getElementById(`${bebida.id}_avulsas`)
      .addEventListener("input", salvarValoresCampos);
    document
      .getElementById(`${bebida.id}_manual`)
      .addEventListener("input", salvarValoresCampos);
  });

  document.getElementById("enviarResultados").addEventListener("click", () => {
    const resultados = calcularManual(); // Coletar resultados do cálculo manual
    salvarResultados(resultados); // Enviar resultados ao banco de dados
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
    const trintaDiasAtras = new Date();
    trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);

    const q = query(
      collection(db, "consumo"),
      where("data", ">=", trintaDiasAtras),
      orderBy("data", "desc")
    );

    const querySnapshot = await getDocs(q);
    const dadosBrutos = {};

    querySnapshot.forEach((doc) => {
      const consumo = doc.data();
      const dataFormatada = consumo.data.toDate().toISOString().split("T")[0]; // Formato YYYY-MM-DD

      Object.entries(consumo.resultados).forEach(([bebida, quantidade]) => {
        if (!dadosBrutos[bebida]) {
          dadosBrutos[bebida] = {};
        }
        if (!dadosBrutos[bebida][dataFormatada]) {
          dadosBrutos[bebida][dataFormatada] = 0;
        }
        dadosBrutos[bebida][dataFormatada] += quantidade;
      });
    });

    const dados = {};
    Object.entries(dadosBrutos).forEach(([bebida, valoresPorDia]) => {
      dados[bebida] = Object.entries(valoresPorDia)
        .map(([data, quantidade]) => ({
          x: new Date(data),
          y: quantidade,
        }))
        .sort((a, b) => a.x - b.x); // Ordena por data crescente
    });

    console.log("Dados carregados e processados com sucesso:", dados);
    return dados;
  } catch (error) {
    console.error("Erro ao carregar dados do gráfico:", error);
    return {};
  }
}

let graficoConsumo; // Variável global para armazenar a instância do gráfico

async function atualizarGrafico() {
  try {
    const dados = await carregarDadosGrafico();
    const ctx = document.getElementById("graficoConsumo").getContext("2d");

    if (graficoConsumo) {
      graficoConsumo.destroy();
    }

    const hoje = new Date();
    const seteDiasAtras = new Date(hoje.getTime() - 7 * 24 * 60 * 60 * 1000);

    graficoConsumo = new Chart(ctx, {
      type: "line",
      data: {
        datasets: Object.entries(dados).map(([bebida, valores]) => ({
          label: bebida,
          data: valores.filter((valor) => valor.x >= seteDiasAtras),
          borderColor: `rgb(${Math.random() * 255},${Math.random() * 255},${
            Math.random() * 255
          })`,
          tension: 0.1,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: "time",
            time: {
              unit: "day",
              displayFormats: {
                day: "dd/MM",
              },
            },
            min: seteDiasAtras,
            max: hoje,
            ticks: {
              source: "auto",
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 7,
            },
          },
          y: {
            beginAtZero: true,
            suggestedMax: 10, // Ajuste este valor conforme necessário
          },
        },
        plugins: {
          legend: {
            display: true,
            position: "top",
          },
          zoom: {
            zoom: {
              wheel: {
                enabled: false,
              },
              pinch: {
                enabled: false,
              },
              mode: "xy",
            },
            pan: {
              enabled: false,
            },
          },
        },
        layout: {
          padding: {
            left: 10,
            right: 10,
            top: 20,
            bottom: 10,
          },
        },
      },
    });
    console.log("Gráfico atualizado com sucesso");
  } catch (error) {
    console.error("Erro ao atualizar o gráfico:", error);
  }
}

function inicializarMenuAbas() {
  const tabButtons = document.querySelectorAll(".tab-button");
  const conteudos = {
    automatico: document.querySelector(".dashboard-card:nth-child(1)"),
    manual: document.querySelector(".dashboard-card:nth-child(2)"),
    grafico: document.querySelector(".dashboard-card:nth-child(3)"),
  };

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const tab = button.dataset.tab;
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");
      Object.values(conteudos).forEach((content) =>
        content.classList.add("hidden")
      );
      conteudos[tab].classList.remove("hidden");

      if (tab === "grafico") {
        atualizarGrafico();
      }
    });
  });

  // Ativar a primeira aba por padrão
  tabButtons[0].click();
}

function carregarResultadosDoLocalStorage() {
  const resultadosAutomaticos = JSON.parse(localStorage.getItem("automatico_resultados"));
  const resultadosManuais = JSON.parse(localStorage.getItem("manual_resultados"));

  if (resultadosAutomaticos) {
    exibirResultados(resultadosAutomaticos, "automatico");
  }

  if (resultadosManuais) {
    exibirResultados(resultadosManuais, "manual");
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  try {
    carregarTiposBebidas();
    gerarCamposEntrada();
    carregarValoresDoLocalStorage(); // Carrega os valores do localStorage
    carregarResultadosDoLocalStorage(); // Carrega os resultados do localStorage
    inicializarEventListeners();
    inicializarMenuMobile();
    inicializarMenuAbas();
    await atualizarGrafico();
    console.log("Inicialização concluída com sucesso");
  } catch (error) {
    console.error("Erro durante a inicialização:", error);
  }
});

function exportarDados() {
  // Implementação da exportação de dados
  console.log("Função de exportar dados não implementada");
  mostrarNotificacao("Exportação de dados não implementada", "erro");
}

document
  .getElementById("exportarDados")
  .addEventListener("click", exportarDados);

function atualizarGraficoPeriodicamente() {
  setInterval(async () => {
    await atualizarGrafico();
  }, 300000); // Atualiza a cada 5 minutos (300000 ms)
}

atualizarGraficoPeriodicamente();

function handleNetworkError() {
  window.addEventListener("online", () => {
    mostrarNotificacao("Conexão restabelecida", "sucesso");
    // Recarregar dados ou atualizar a interface conforme necessário
  });

  window.addEventListener("offline", () => {
    mostrarNotificacao("Sem conexão de rede", "erro");
  });
}

handleNetworkError();

function validarEntrada(input) {
  const regex = /^(\d+(\.\d+)?)(,\s*\d+(\.\d+)?)*$/;
  return regex.test(input.trim());
}

function adicionarValidacaoCampos() {
  const campos = document.querySelectorAll('input[type="text"]');
  campos.forEach((campo) => {
    campo.addEventListener("blur", (e) => {
      if (!validarEntrada(e.target.value) && e.target.value !== "") {
        mostrarNotificacao(
          "Formato inválido. Use números separados por vírgula.",
          "erro"
        );
        e.target.classList.add("border-red-500");
      } else {
        e.target.classList.remove("border-red-500");
      }
    });
  });
}

adicionarValidacaoCampos();

function salvarEstadoAplicacao() {
  const estado = {
    tiposBebidas: tiposBebidas,
    valoresCampos: JSON.parse(localStorage.getItem("valoresCampos")),
    // Adicione outros estados conforme necessário
  };
  localStorage.setItem("estadoAplicacao", JSON.stringify(estado));
}

function carregarEstadoAplicacao() {
  const estadoSalvo = localStorage.getItem("estadoAplicacao");
  if (estadoSalvo) {
    const estado = JSON.parse(estadoSalvo);
    tiposBebidas = estado.tiposBebidas;
    localStorage.setItem("valoresCampos", JSON.stringify(estado.valoresCampos));
    // Restaure outros estados conforme necessário
    gerarCamposEntrada();
    carregarValoresCampos();
  }
}

carregarEstadoAplicacao();

window.addEventListener("beforeunload", salvarEstadoAplicacao);

function handleWindowResize() {
  const sidebar = document.getElementById("sidebar");
  const mobileMenuButton = document.getElementById("mobileMenuButton");

  window.addEventListener("resize", () => {
    if (window.innerWidth >= 768) {
      sidebar.classList.remove("hidden");
      if (mobileMenuButton) {
        mobileMenuButton.classList.remove("active");
      }
    } else {
      sidebar.classList.add("hidden");
    }
    atualizarGrafico(); // Atualiza o gráfico para se ajustar ao novo tamanho da tela
  });
}

handleWindowResize();

function melhorarAcessibilidade() {
  const elementos = document.querySelectorAll("button, a, input, select");
  elementos.forEach((elemento) => {
    if (!elemento.getAttribute("aria-label")) {
      elemento.setAttribute(
        "aria-label",
        elemento.innerText || elemento.placeholder || ""
      );
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const modal = document.getElementById("modalGerenciarBebidas");
      if (!modal.classList.contains("hidden")) {
        modal.classList.add("hidden");
      }
    }
  });
}

melhorarAcessibilidade();

function otimizarDesempenho() {
  // Debounce para salvar valores dos campos
  let timeoutId;
  const debounceSalvarValores = () => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(salvarValoresCampos, 500);
  };

  tiposBebidas.forEach((bebida) => {
    document
      .getElementById(bebida.id)
      .addEventListener("input", debounceSalvarValores);
    document
      .getElementById(`${bebida.id}_avulsas`)
      .addEventListener("input", debounceSalvarValores);
    document
      .getElementById(`${bebida.id}_manual`)
      .addEventListener("input", debounceSalvarValores);
  });

  // Lazy loading para o gráfico
  const graficoContainer = document.querySelector(
    ".dashboard-card:nth-child(3)"
  );
  const observador = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          atualizarGrafico();
          observador.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  observador.observe(graficoContainer);
}

otimizarDesempenho();

function implementarPWA() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/src/js/service-worker.js", { scope: "/" })
        .then((registration) => {
          console.log(
            "Service Worker registrado com sucesso:",
            registration.scope
          );
        })
        .catch((error) => {
          console.log("Falha ao registrar o Service Worker:", error);
        });
    });
  }
}

implementarPWA();

// Função para sincronizar dados offline
async function sincronizarDadosOffline() {
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    const registration = await navigator.serviceWorker.ready;
    try {
      await registration.sync.register("sync-dados");
      console.log("Sincronização de dados registrada");
    } catch (error) {
      console.error("Falha ao registrar sincronização de dados:", error);
    }
  }
}
sincronizarDadosOffline();

function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

function adicionarDebounceCampos() {
  const campos = document.querySelectorAll('input[type="text"]');
  campos.forEach((campo) => {
    campo.addEventListener("input", debounce(salvarValoresCampos, 500));
  });
}

adicionarDebounceCampos();

function lazyLoadGrafico() {
  const graficoContainer = document.querySelector(
    ".dashboard-card:nth-child(3)"
  );
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          atualizarGrafico();
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1 }
  );
  observer.observe(graficoContainer);
}

lazyLoadGrafico();

function salvarValoresNoLocalStorage() {
  const valores = {};
  tiposBebidas.forEach((bebida) => {
    const campo = document.getElementById(`${bebida.id}_manual`);
    valores[bebida.id] = campo.value;
  });
  localStorage.setItem("valoresBebidas", JSON.stringify(valores));
}

function carregarValoresDoLocalStorage() {
  const valoresSalvos = JSON.parse(localStorage.getItem("valoresBebidas"));
  if (valoresSalvos) {
    tiposBebidas.forEach((bebida) => {
      const campo = document.getElementById(`${bebida.id}_manual`);
      if (valoresSalvos[bebida.id]) {
        campo.value = valoresSalvos[bebida.id];
      }
    });
  }
}
