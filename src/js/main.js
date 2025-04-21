import { firebaseConfig } from "./config";
import "../css/styles.css";
// Importar apenas os módulos Firebase necessários
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
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// Implementar lazy loading para Chart.js
let Chart, zoomPlugin;
const loadChartModules = async () => {
  const chartModule = await import(
    /* webpackChunkName: "chart" */ "chart.js/auto"
  );
  const dateAdapterModule = await import(
    /* webpackChunkName: "chart-date-adapter" */ "chartjs-adapter-date-fns"
  );
  const zoomPluginModule = await import(
    /* webpackChunkName: "chart-zoom" */ "chartjs-plugin-zoom"
  );
  Chart = chartModule.default;
  zoomPlugin = zoomPluginModule.default;
  Chart.register(zoomPlugin);
  return Chart;
};

// Inicialização Firebase com atraso proposital
let app, db;
const initializeFirebase = () => {
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("Firebase inicializado");
  } catch (error) {
    console.error("Erro ao inicializar o Firebase:", error);
  }
};

// Adiar inicialização Firebase para melhorar carregamento inicial
setTimeout(initializeFirebase, 1000);

// Configurar variables globais com valores padrão
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
let graficoConsumo; // Variável global para armazenar a instância do gráfico
let chartInitialized = false;

// Carrega os dados necessários apenas quando necessário
function carregarDadosIniciais() {
  carregarTiposBebidas();
  gerarCamposEntrada();
}

// Cache para evitar operações repetidas
const cache = {
  dadosGrafico: null,
  ultimaAtualizacao: 0,
};

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
        <label for="${bebida.id}" class="block text-sm font-medium text-text-light">${bebida.nome} (Pacotes)</label>
        <div class="mt-1 relative rounded-md shadow-sm">
          <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <i class="fas fa-box text-gray-400"></i>
          </div>
          <input type="text" id="${bebida.id}" class="focus:ring-indigo-500 focus:border-indigo-500 block w-full pl-10 sm:text-sm border-gray-300 rounded-md" aria-label="${bebida.nome} Pacotes" placeholder="Valores separados por vírgula" />
        </div>
      </div>
      <div>
        <label for="${bebida.id}_avulsas" class="block text-sm font-medium text-text-light">${bebida.nome} (Avulsas)</label>
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
      <label for="${bebida.id}_manual" class="block text-sm font-medium text-text-light">${bebida.nome}</label>
      <div class="flex items-center">
        <input type="text" id="${bebida.id}_manual" class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="Valores separados por vírgula">
        <button id="desfazer_${bebida.id}" class="ml-2 inline-flex items-center px-2 py-1 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
          Desfazer
        </button>
      </div>
    `;
    containerManual.appendChild(divManual);

    // Adicionando o evento de clique para o botão de desfazer
    document
      .getElementById(`desfazer_${bebida.id}`)
      .addEventListener("click", () => {
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
  // Primeiro, verificamos se campos foram limpos recentemente
  const limpezaIntencional = localStorage.getItem("camposManuaisLimpos");

  // Salvamos o estado atual para histórico
  salvarEstadoManual();

  // Coletar dados antes da alteração para backup (apenas se não foi limpo intencionalmente)
  if (
    !limpezaIntencional ||
    new Date() - new Date(limpezaIntencional) > 60000
  ) {
    // > 1 minuto
    const estadoAnterior = {};
    tiposBebidas.forEach((bebida) => {
      const campoManual = document.getElementById(`${bebida.id}_manual`);
      estadoAnterior[bebida.id] = campoManual.value;
    });
    localStorage.setItem(
      "estadoAnteriorManual",
      JSON.stringify(estadoAnterior)
    );
  } else {
    // Se foi limpo recentemente, remover estado anterior para não restaurar
    localStorage.removeItem("estadoAnteriorManual");
  }

  // Continua com o processo normal de envio para cálculo manual
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

  // Após transferir novos dados, remover flag de limpeza intencional
  localStorage.removeItem("camposManuaisLimpos");

  // Salvar os valores nos vários sistemas de armazenamento para redundância
  salvarValoresCampos();
  salvarValoresManualNoLocalStorage();
  salvarTransferenciaAutomaticoParaManual(resultados);

  mostrarNotificacao(
    "Resultados enviados para o cálculo manual com sucesso!",
    "sucesso"
  );

  // Criar e exibir o popup personalizado
  const popup = document.createElement("div");
  popup.innerHTML = `
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full" id="popupOverlay">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-card-light">
        <div class="mt-3 text-center">
          <h3 class="text-lg leading-6 font-medium text-text-light">Resultados Transferidos</h3>
          <div class="mt-2 px-7 py-3">
            <p class="text-sm text-text-light">
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

// Nova função para salvar especificamente as transferências do automático para manual
function salvarTransferenciaAutomaticoParaManual(resultados) {
  // Salva o histórico das transferências
  let historicoTransferencias =
    JSON.parse(localStorage.getItem("historicoTransferencias")) || [];
  historicoTransferencias.push({
    data: new Date().toISOString(),
    resultados: resultados,
  });
  localStorage.setItem(
    "historicoTransferencias",
    JSON.stringify(historicoTransferencias)
  );

  // Salva a última transferência para recuperação fácil
  localStorage.setItem(
    "ultimaTransferenciaAutoParaManual",
    JSON.stringify({
      data: new Date().toISOString(),
      resultados: resultados,
    })
  );
}

// Nova função específica para salvar os valores dos campos manuais
function salvarValoresManualNoLocalStorage() {
  const valores = {};
  tiposBebidas.forEach((bebida) => {
    const campo = document.getElementById(`${bebida.id}_manual`);
    if (campo) {
      valores[bebida.id] = campo.value;
    }
  });
  localStorage.setItem("valoresManual", JSON.stringify(valores));
  localStorage.setItem("backupValoresManual", JSON.stringify(valores)); // Backup redundante
}

// Função para verificar e restaurar dados após um fechamento inesperado
function verificarRecuperacaoDados() {
  // Verificar se o usuário limpou os dados intencionalmente
  const limpezaIntencional = localStorage.getItem("camposManuaisLimpos");

  // Se houve limpeza intencional e depois não houve novos salvamentos, não restaurar
  const ultimoSalvamento = localStorage.getItem("ultimoSalvamentoManual");
  if (
    limpezaIntencional &&
    ultimoSalvamento &&
    new Date(limpezaIntencional) > new Date(ultimoSalvamento)
  ) {
    return;
  }

  // Continuamos com a verificação normal apenas se não houve limpeza intencional recente
  const valoresManual = JSON.parse(localStorage.getItem("valoresManual"));
  const backupValoresManual = JSON.parse(
    localStorage.getItem("backupValoresManual")
  );

  if (valoresManual || backupValoresManual) {
    // Usa o conjunto de dados mais completo disponível
    const dadosParaRestaurar = valoresManual || backupValoresManual;

    // Criar um resumo dos dados para mostrar ao usuário
    const resumo = [];
    let totalItens = 0;

    Object.entries(dadosParaRestaurar).forEach(([bebidaId, valor]) => {
      if (valor && valor.trim() !== "") {
        const bebidaInfo = tiposBebidas.find((b) => b.id === bebidaId);
        if (bebidaInfo) {
          const valores = valor
            .split(",")
            .map((v) => v.trim())
            .filter((v) => v);
          if (valores.length > 0) {
            resumo.push(`${bebidaInfo.nome}: ${valores.length} entradas`);
            totalItens += valores.length;
          }
        }
      }
    });

    // Obter o momento da última modificação
    const dataUltimoSalvamento = ultimoSalvamento
      ? new Date(ultimoSalvamento)
      : new Date();

    // Criar modal personalizado para restauração com cores legíveis
    const recoveryModal = document.createElement("div");
    recoveryModal.innerHTML = `
      <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" id="recoveryOverlay">
        <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-card-light">
          <div class="mt-3">
            <div class="flex items-center justify-center">
              <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
                <svg class="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
            </div>
            
            <h3 class="text-lg leading-6 font-medium text-text-light mt-2 text-center">Dados Não Salvos Encontrados</h3>
            
            <div class="mt-4 px-2 py-2">
              <p class="text-sm text-text-light">
                Encontramos dados de cálculo manual não salvos da sua sessão anterior, 
                modificados às ${dataUltimoSalvamento.toLocaleTimeString()} de ${dataUltimoSalvamento.toLocaleDateString()}.
              </p>
              
              <div class="mt-3 bg-gray-700 p-2 rounded-md">
                <p class="text-sm font-medium text-text-light">Resumo dos dados encontrados:</p>
                <ul class="mt-1 text-xs text-text-light list-disc pl-5">
                  ${resumo.map((item) => `<li>${item}</li>`).join("")}
                </ul>
                <p class="text-xs text-text-light mt-1">Total: ${totalItens} entradas em ${
      resumo.length
    } categorias</p>
              </div>
              
              <p class="text-sm text-text-light mt-3">
                Deseja restaurar estes dados para continuar seu trabalho?
              </p>
            </div>
            
            <div class="flex items-center justify-between px-4 py-3">
              <button id="descartarDados" class="px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400">
                Descartar
              </button>
              <button id="restaurarDados" class="px-4 py-2 bg-blue-500 text-white text-base font-medium rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-300">
                Restaurar Dados
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(recoveryModal);

    // Handler para restaurar dados
    document.getElementById("restaurarDados").addEventListener("click", () => {
      tiposBebidas.forEach((bebida) => {
        const campo = document.getElementById(`${bebida.id}_manual`);
        if (campo && dadosParaRestaurar[bebida.id]) {
          campo.value = dadosParaRestaurar[bebida.id];
        }
      });

      document.body.removeChild(recoveryModal);
      mostrarNotificacao("Dados restaurados com sucesso!", "sucesso");
    });

    // Handler para descartar dados - MODIFICADO para limpar os campos também
    document.getElementById("descartarDados").addEventListener("click", () => {
      // Limpar visualmente todos os campos manuais
      tiposBebidas.forEach((bebida) => {
        const campo = document.getElementById(`${bebida.id}_manual`);
        if (campo) {
          campo.value = ""; // Limpa o campo de entrada
        }
      });

      // Limpar o display de resultados manuais
      const displayResultados = document.getElementById(
        "resultado_manual_display"
      );
      if (displayResultados) {
        displayResultados.innerHTML = "";
      }

      // Criar objetos com valores vazios para salvar no localStorage
      const valoresVazios = {};
      tiposBebidas.forEach((bebida) => {
        valoresVazios[bebida.id] = "";
      });

      // Salvar valores vazios em vez de remover as entradas
      localStorage.setItem("valoresManual", JSON.stringify(valoresVazios));
      localStorage.setItem(
        "valoresManualBackup",
        JSON.stringify(valoresVazios)
      );
      localStorage.setItem(
        "backupValoresManual",
        JSON.stringify(valoresVazios)
      );

      // Remover outros itens relacionados
      localStorage.removeItem("estadoAnteriorManual");
      localStorage.removeItem("ultimaTransferenciaAutoParaManual");
      localStorage.removeItem("manual_resultados");
      localStorage.removeItem("ultimoSalvamentoManual");

      // Marcar que os dados foram limpos intencionalmente
      localStorage.setItem("camposManuaisLimpos", new Date().toISOString());

      // Fechar o modal e mostrar notificação
      document.body.removeChild(recoveryModal);
      mostrarNotificacao("Dados descartados e campos limpos", "sucesso");
    });

    // Fechar ao clicar fora do modal (opcional)
    document
      .getElementById("recoveryOverlay")
      .addEventListener("click", (e) => {
        if (e.target.id === "recoveryOverlay") {
          document.body.removeChild(recoveryModal);
        }
      });
  }
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

// Adicionar nova função para atualizar display sem popup
function atualizarDisplayResultados(resultados) {
  const displayResultados = document.getElementById("resultado_manual_display");
  if (displayResultados) {
    displayResultados.innerHTML = "";
    Object.entries(resultados).forEach(([bebida, quantidade]) => {
      const bebidaInfo = tiposBebidas.find((b) => b.id === bebida);
      if (bebidaInfo) {
        displayResultados.innerHTML += `<p>${bebidaInfo.nome}: ${quantidade}</p>`;
      }
    });
  }
}

function desfazerUltimoResultado(bebidaId) {
  try {
    const campo = document.getElementById(`${bebidaId}_manual`);
    if (!campo) {
      mostrarNotificacao(`Campo não encontrado para ${bebidaId}`, "erro");
      return;
    }

    const valoresAtuais = campo.value
      .split(",")
      .map((v) => v.trim())
      .filter((v) => v !== "");

    if (valoresAtuais.length > 0) {
      // Remove o último resultado
      valoresAtuais.pop();
      campo.value = valoresAtuais.join(", ");

      // Salvar no localStorage após desfazer
      salvarValoresManualNoLocalStorage();

      // Calcular resultados e atualizar display sem popup
      const resultados = {};
      tiposBebidas.forEach((bebida) => {
        const input = document.getElementById(`${bebida.id}_manual`).value;
        resultados[bebida.id] = calcularTotal(input);
      });

      // Usar nova função para atualizar display sem popup
      atualizarDisplayResultados(resultados);

      mostrarNotificacao(
        `Último resultado removido para ${bebidaId}`,
        "sucesso"
      );
    } else {
      mostrarNotificacao("Não há resultados para desfazer", "info");
    }
  } catch (error) {
    console.error("Erro ao desfazer:", error);
    mostrarNotificacao("Erro ao desfazer operação", "erro");
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

  // Mostrar um aviso de "Enviando..." enquanto a operação está em andamento
  const loadingPopup = document.createElement("div");
  loadingPopup.innerHTML = `
    <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" id="loadingOverlay">
      <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-card-light">
        <div class="mt-3 text-center">
          <div class="inline-block animate-spin rounded-full h-8 w-8 border-4 border-blue-500 border-t-transparent"></div>
          <h3 class="text-lg leading-6 font-medium text-text-light mt-2">Enviando dados...</h3>
          <div class="mt-2 px-7 py-3">
            <p class="text-sm text-text-light">
              Aguarde enquanto seus dados são salvos no servidor.
            </p>
          </div>
        </div>
      </div>
    </div>
  `;
  document.body.appendChild(loadingPopup);

  addDoc(collection(db, "consumo"), {
    data: data,
    turno: turno,
    resultados: resultados,
  })
    .then(() => {
      // Remover o aviso de carregamento
      if (document.getElementById("loadingOverlay")) {
        document.body.removeChild(loadingPopup);
      }

      // Criar um resumo formatado dos dados salvos
      const resumoItens = Object.entries(resultados)
        .map(([bebida, quantidade]) => {
          const bebidaInfo = tiposBebidas.find((b) => b.id === bebida);
          if (bebidaInfo && quantidade > 0) {
            return `<li><strong>${bebidaInfo.nome}</strong>: ${quantidade} unidades</li>`; // Corrigido: aspas de fechamento estava incorreta
          }
          return "";
        })
        .filter((item) => item !== "")
        .join("");

      // Criar e mostrar o popup de sucesso com cores legíveis
      const successPopup = document.createElement("div");
      successPopup.innerHTML = `
        <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" id="successOverlay">
          <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-card-light">
            <div class="mt-3 text-center">
              <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100">
                <svg class="h-8 w-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
                </svg>
              </div>
              <h3 class="text-lg leading-6 font-medium text-text-light mt-2">Dados Salvos com Sucesso!</h3>
              <div class="mt-2 px-7 py-3">
                <p class="text-sm text-text-light">
                  O consumo foi registrado corretamente no turno <strong>${turno}</strong> em <strong>${data.toLocaleString()}</strong>.
                </p>
                <div class="mt-4 border-t border-gray-600 pt-4">
                  <p class="text-sm font-medium text-left text-text-light">Resumo do consumo:</p>
                  <ul class="text-sm text-left list-disc pl-5 mt-2 text-text-light">
                    ${resumoItens}
                  </ul>
                </div>
              </div>
              <div class="items-center px-4 py-3">
                <button id="fecharPopupSucesso" class="px-4 py-2 bg-green-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-300">
                  OK
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(successPopup);

      // Adicionar evento para fechar o popup
      document
        .getElementById("fecharPopupSucesso")
        .addEventListener("click", () => {
          document.body.removeChild(successPopup);
        });

      // Fechar o popup ao clicar fora dele
      document
        .getElementById("successOverlay")
        .addEventListener("click", (event) => {
          if (event.target.id === "successOverlay") {
            document.body.removeChild(successPopup);
          }
        });

      // Mostrar também a notificação simples
      mostrarNotificacao("Resultados salvos com sucesso!", "sucesso");
    })
    .catch((error) => {
      console.error("Erro ao salvar resultados:", error);

      // Remover o aviso de carregamento
      if (document.getElementById("loadingOverlay")) {
        document.body.removeChild(loadingPopup);
      }

      // Mostrar popup de erro com cores legíveis
      const errorPopup = document.createElement("div");
      errorPopup.innerHTML = `
        <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" id="errorOverlay">
          <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-card-light">
            <div class="mt-3 text-center">
              <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                <svg class="h-8 w-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </div>
              <h3 class="text-lg leading-6 font-medium text-text-light mt-2">Erro ao Salvar Dados</h3>
              <div class="mt-2 px-7 py-3">
                <p class="text-sm text-text-light">
                  Ocorreu um erro ao tentar salvar os dados no servidor. Verifique sua conexão e tente novamente.
                </p>
                <p class="text-xs text-red-400 mt-2">
                  Detalhes técnicos: ${error.message}
                </p>
              </div>
              <div class="items-center px-4 py-3">
                <button id="fecharPopupErro" class="px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md w-full shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300">
                  Entendi
                </button>
              </div>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(errorPopup);

      // Adicionar evento para fechar o popup de erro
      document
        .getElementById("fecharPopupErro")
        .addEventListener("click", () => {
          document.body.removeChild(errorPopup);
        });

      // Fechar o popup ao clicar fora dele
      document
        .getElementById("errorOverlay")
        .addEventListener("click", (event) => {
          if (event.target.id === "errorOverlay") {
            document.body.removeChild(errorPopup);
          }
        });

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
  dialog.className = "bg-card-light p-6 rounded-lg shadow-xl text-text-light";
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
    try {
      // Limpar os campos visuais
      tiposBebidas.forEach((bebida) => {
        const campo = document.getElementById(`${bebida.id}_manual`);
        if (campo) {
          campo.value = "";
        }
      });

      // Limpar o display de resultados manuais
      const displayResultados = document.getElementById(
        "resultado_manual_display"
      );
      if (displayResultados) {
        displayResultados.innerHTML = "";
      }

      // Criar objetos com valores vazios para salvar no localStorage
      const valoresVazios = {};
      tiposBebidas.forEach((bebida) => {
        valoresVazios[bebida.id] = "";
      });

      // Salvar valores vazios em vez de remover as entradas
      localStorage.setItem("valoresManual", JSON.stringify(valoresVazios));
      localStorage.setItem(
        "valoresManualBackup",
        JSON.stringify(valoresVazios)
      );
      localStorage.setItem(
        "backupValoresManual",
        JSON.stringify(valoresVazios)
      );
      localStorage.setItem("ultimoSalvamentoManual", new Date().toISOString());

      // Os outros itens relacionados podemos remover normalmente
      localStorage.removeItem("estadoAnteriorManual");
      localStorage.removeItem("ultimaTransferenciaAutoParaManual");
      localStorage.removeItem("manual_resultados");

      // Marcar que os dados foram limpos intencionalmente
      localStorage.setItem("camposManuaisLimpos", new Date().toISOString());

      // Atualizar os valores em valoresCampos para sincronizar o estado
      const valoresCampos =
        JSON.parse(localStorage.getItem("valoresCampos")) || {};
      tiposBebidas.forEach((bebida) => {
        valoresCampos[`${bebida.id}_manual`] = "";
      });
      localStorage.setItem("valoresCampos", JSON.stringify(valoresCampos));

      // Salvar valores vazios também na entrada valoresBebidas
      localStorage.setItem("valoresBebidas", JSON.stringify(valoresVazios));

      mostrarNotificacao("Campos manuais limpos com sucesso!", "sucesso");
    } catch (error) {
      console.error("Erro ao limpar campos manuais:", error);
      mostrarNotificacao("Erro ao limpar campos manuais", "erro");
    }
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

// Esta função estava faltando ou foi sobrescrita - vamos garantir que ela esteja corretamente implementada
function calcularManual() {
  const resultados = {};
  tiposBebidas.forEach((bebida) => {
    const input = document.getElementById(`${bebida.id}_manual`).value;
    resultados[bebida.id] = calcularTotal(input);
  });
  return resultados;
}

function inicializarEventListeners() {
  // Garantir que os event listeners sejam adicionados corretamente
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

  // Corrigir este event listener específico para o form de cálculo manual
  document.getElementById("calculoManual").addEventListener("submit", (e) => {
    e.preventDefault(); // Impede o envio padrão do formulário
    salvarEstadoManual(); // Salvar estado atual antes de calcular
    const resultados = calcularManual();
    exibirResultados(resultados, "manual");

    // Criar um resumo dos resultados para o aviso
    const resumoItens = Object.entries(resultados)
      .map(([bebidaId, quantidade]) => {
        if (quantidade > 0) {
          const bebidaInfo = tiposBebidas.find((b) => b.id === bebidaId);
          return bebidaInfo
            ? `<li class="flex justify-between my-1"><span class="font-medium text-text-light">${bebidaInfo.nome}</span> <span class="font-bold text-text-light">${quantidade} unidades</span></li>`
            : "";
        }
        return "";
      })
      .filter((item) => item !== "")
      .join("");

    // Verifica se há resultados a mostrar
    if (resumoItens.length === 0) {
      mostrarNotificacao(
        "Não há resultados para enviar ao banco de dados",
        "erro"
      );
      return;
    }

    // Criar o modal de confirmação personalizado com cores corrigidas para melhor legibilidade
    const confirmModal = document.createElement("div");
    confirmModal.innerHTML = `
      <div class="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50" id="confirmSendOverlay">
        <div class="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-card-light">
          <div class="mt-3">
            <div class="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
              <svg class="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path>
              </svg>
            </div>
            
            <h3 class="text-lg leading-6 font-medium text-text-light mt-2 text-center">Cálculo Concluído</h3>
            
            <div class="mt-2 px-2 py-2">
              <p class="text-sm text-text-light mb-2">
                O cálculo das bebidas foi concluído com sucesso. Deseja salvar estes dados no banco de dados?
              </p>
              
              <div class="mt-3 bg-gray-700 p-3 rounded-md max-h-48 overflow-y-auto">
                <p class="text-sm font-medium text-text-light border-b border-gray-500 pb-1 mb-2">Resumo dos resultados:</p>
                <ul class="text-sm text-text-light">
                  ${resumoItens}
                </ul>
              </div>
              
              <div class="mt-4">
                <p class="text-xs text-text-light">
                  <span class="font-semibold">Nota:</span> Após salvar, estes dados ficarão disponíveis no histórico e no gráfico.
                </p>
              </div>
            </div>
            
            <div class="grid grid-cols-2 gap-2 px-4 py-3">
              <button id="apenasCalcular" class="px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400">
                Apenas Calcular
              </button>
              <button id="salvarNoBanco" class="px-4 py-2 bg-green-500 text-white text-base font-medium rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-300">
                Salvar no Banco
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(confirmModal);

    // Handler para apenas calcular (fechar o modal)
    document.getElementById("apenasCalcular").addEventListener("click", () => {
      document.body.removeChild(confirmModal);
      mostrarNotificacao("Resultados calculados localmente", "sucesso");
    });

    // Handler para salvar no banco
    document.getElementById("salvarNoBanco").addEventListener("click", () => {
      document.body.removeChild(confirmModal);
      salvarResultados(resultados); // Chama a função que salva no banco de dados
    });

    // Fechar ao clicar fora do modal (opcional)
    document
      .getElementById("confirmSendOverlay")
      .addEventListener("click", (e) => {
        if (e.target.id === "confirmSendOverlay") {
          document.body.removeChild(confirmModal);
        }
      });
  });

  // O botão específico de enviar resultados
  document.getElementById("enviarResultados").addEventListener("click", () => {
    const resultados = calcularManual(); // Coletar resultados do cálculo manual
    salvarResultados(resultados); // Enviar resultados ao banco de dados
  });

  // ...resto dos event listeners...
}

function inicializarBotoesEspeciais() {
  // Botão para limpar campos manuais
  const btnLimparManual = document.getElementById("limparCamposManuais");
  if (btnLimparManual) {
    // Remover qualquer listener anterior para evitar duplicação
    btnLimparManual.replaceWith(btnLimparManual.cloneNode(true));

    // Adicionar o novo listener
    document
      .getElementById("limparCamposManuais")
      .addEventListener("click", function (e) {
        e.preventDefault();
        limparCamposManuais();
      });
  }

  // Botão para limpar campos automáticos
  const btnLimparAutomatico = document.getElementById(
    "limparCamposAutomaticos"
  );
  if (btnLimparAutomatico) {
    // Remover qualquer listener anterior para evitar duplicação
    btnLimparAutomatico.replaceWith(btnLimparAutomatico.cloneNode(true));

    // Adicionar o novo listener
    document
      .getElementById("limparCamposAutomaticos")
      .addEventListener("click", function (e) {
        e.preventDefault();
        limparCamposAutomaticos();
      });
  }

  // Botão para adicionar nova bebida
  const btnAdicionar = document.getElementById("adicionarBebida");
  if (btnAdicionar) {
    btnAdicionar.addEventListener("click", (e) => {
      e.preventDefault();
      const nome = prompt("Digite o nome da nova bebida:");
      if (!nome) return;
      const unidades = prompt("Unidades por pacote (número):", "6");
      const unidadesPorPacote = parseInt(unidades, 10);
      if (isNaN(unidadesPorPacote)) {
        mostrarNotificacao("Unidades inválidas", "erro");
        return;
      }
      // gera um id simples a partir do nome
      const id = nome
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
      tiposBebidas.push({ id, nome, unidadesPorPacote });
      salvarTiposBebidas();
      atualizarListaBebidas();
      gerarCamposEntrada();
      mostrarNotificacao("Bebida adicionada com sucesso!", "sucesso");
    });
  }

  // Botão para gerenciar bebidas
  const btnGerenciar = document.getElementById("gerenciarBebidas");
  const modalGerenciar = document.getElementById("modalGerenciarBebidas");
  if (btnGerenciar && modalGerenciar) {
    btnGerenciar.addEventListener("click", () => {
      atualizarListaBebidas();
      modalGerenciar.classList.remove("hidden");
    });
    // Fechar ao clicar fora do conteúdo interno
    modalGerenciar.addEventListener("click", (e) => {
      if (e.target.id === "modalGerenciarBebidas") {
        modalGerenciar.classList.add("hidden");
      }
    });
    // Fechar ao clicar no botão X
    const btnFechar = document.getElementById("fecharGerenciarBebidas");
    if (btnFechar) {
      btnFechar.addEventListener("click", () => {
        modalGerenciar.classList.add("hidden");
      });
    }
    // Fechar ao clicar no botão "Fechar" (id="fecharModal")
    const btnFecharModal = document.getElementById("fecharModal");
    if (btnFecharModal) {
      btnFecharModal.addEventListener("click", () => {
        modalGerenciar.classList.add("hidden");
      });
    }
  }
}

function atualizarListaBebidas() {
  const listaBebidas = document.getElementById("listaBebidas");
  listaBebidas.innerHTML = "";
  tiposBebidas.forEach((bebida) => {
    const li = document.createElement("li");
    li.className = "flex items-center justify-between";
    li.innerHTML = `
      <span class="flex-1">${bebida.nome} (${bebida.unidadesPorPacote} por pacote)</span>
      <button class="editar-bebida px-2 text-blue-400 hover:text-blue-600 mr-2" data-id="${bebida.id}">Editar</button>
      <button class="excluir-bebida px-2 text-red-400 hover:text-red-600" data-id="${bebida.id}">Excluir</button>
    `;
    listaBebidas.appendChild(li);
  });

  // Excluir
  document.querySelectorAll(".excluir-bebida").forEach((button) => {
    button.addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-id");
      tiposBebidas = tiposBebidas.filter((bebida) => bebida.id !== id);
      salvarTiposBebidas();
      atualizarListaBebidas();
      gerarCamposEntrada();
    });
  });

  // Editar
  document.querySelectorAll(".editar-bebida").forEach((button) => {
    button.addEventListener("click", (e) => {
      const id = e.target.getAttribute("data-id");
      const bebida = tiposBebidas.find((b) => b.id === id);
      if (bebida) {
        const novoNome = prompt("Novo nome da bebida:", bebida.nome);
        const novaQtd = prompt(
          "Unidades por pacote:",
          bebida.unidadesPorPacote
        );
        const u = parseInt(novaQtd, 10);
        if (!novoNome || isNaN(u)) {
          mostrarNotificacao("Entrada inválida", "erro");
          return;
        }
        bebida.nome = novoNome;
        bebida.unidadesPorPacote = u;
        salvarTiposBebidas();
        atualizarListaBebidas();
        gerarCamposEntrada();
        mostrarNotificacao("Bebida atualizada", "sucesso");
      }
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

    return dados;
  } catch (error) {
    console.error("Erro ao carregar dados do gráfico:", error);
    return {};
  }
}

async function atualizarGrafico() {
  try {
    // Usar cache se os dados foram buscados nos últimos 5 minutos
    const agora = Date.now();
    if (
      !chartInitialized ||
      !cache.dadosGrafico ||
      agora - cache.ultimaAtualizacao > 5 * 60 * 1000
    ) {
      // Carregar Chart.js apenas quando necessário
      if (!Chart) {
        await loadChartModules();
      }

      const dados = await carregarDadosGrafico();
      cache.dadosGrafico = dados;
      cache.ultimaAtualizacao = agora;

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
      chartInitialized = true;
    }
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

// Adicione esta nova função para auto-salvamento
function iniciarAutoSalvamento() {
  setInterval(() => {
    try {
      const valores = {};

      // Salvar valores dos campos automáticos
      tiposBebidas.forEach((bebida) => {
        const pacotesInput = document.getElementById(bebida.id);
        const avulsasInput = document.getElementById(`${bebida.id}_avulsas`);
        const manualInput = document.getElementById(`${bebida.id}_manual`);

        if (pacotesInput) valores[bebida.id] = pacotesInput.value;
        if (avulsasInput) valores[`${bebida.id}_avulsas`] = avulsasInput.value;
        if (manualInput) valores[`${bebida.id}_manual`] = manualInput.value;
      });

      // Salvar no localStorage
      localStorage.setItem("valoresCampos", JSON.stringify(valores));
      localStorage.setItem("ultimoSalvamento", new Date().toISOString());
    } catch (error) {
      console.error("Erro ao salvar dados automaticamente:", error);
    }
  }, 1000); // Salva a cada 1 segundo
}

// Modificar o iniciarAutoSalvamentoManual para incluir mais redundância
function iniciarAutoSalvamentoManual() {
  setInterval(() => {
    try {
      const limpezaIntencional = localStorage.getItem("camposManuaisLimpos");

      // Verificar se a limpeza foi muito recente (menos de 5 segundos)
      if (
        limpezaIntencional &&
        new Date() - new Date(limpezaIntencional) < 5000
      ) {
        return; // Não salvar se os campos foram limpos recentemente
      }

      const valoresManual = {};
      tiposBebidas.forEach((bebida) => {
        const campoManual = document.getElementById(`${bebida.id}_manual`);
        if (campoManual) {
          valoresManual[bebida.id] = campoManual.value;
        }
      });

      // Se todos os campos estiverem vazios e houve limpeza intencional, não salvar
      const todosVazios = Object.values(valoresManual).every(
        (valor) => !valor || valor === ""
      );
      if (todosVazios && limpezaIntencional) {
        return;
      }

      // Salvar no localStorage com várias chaves para redundância
      localStorage.setItem("valoresManual", JSON.stringify(valoresManual));
      localStorage.setItem(
        "valoresManualBackup",
        JSON.stringify(valoresManual)
      );
      localStorage.setItem("ultimoSalvamentoManual", new Date().toISOString());

      // Remover marca de limpeza intencional após salvamento bem-sucedido
      if (limpezaIntencional) {
        localStorage.removeItem("camposManuaisLimpos");
      }
    } catch (error) {
      console.error("Erro ao salvar dados manuais automaticamente:", error);
    }
  }, 1000); // Salva a cada 1 segundo
}

function carregarResultadosDoLocalStorage() {
  const resultadosAutomaticos = JSON.parse(
    localStorage.getItem("automatico_resultados")
  );
  const resultadosManuais = JSON.parse(
    localStorage.getItem("manual_resultados")
  );

  if (resultadosAutomaticos) {
    exibirResultados(resultadosAutomaticos, "automatico");
  }

  if (resultadosManuais) {
    exibirResultados(resultadosManuais, "manual");
  }
}

function carregarValoresManualDoLocalStorage() {
  const valoresSalvos = JSON.parse(localStorage.getItem("valoresManual"));
  if (valoresSalvos) {
    tiposBebidas.forEach((bebida) => {
      const campoManual = document.getElementById(`${bebida.id}_manual`);
      if (campoManual && valoresSalvos[bebida.id]) {
        campoManual.value = valoresSalvos[bebida.id];
      }
    });
  }
}

// Modifique o evento DOMContentLoaded para incluir a verificação de recuperação
document.addEventListener("DOMContentLoaded", async () => {
  try {
    // Primeiro carrega apenas os dados essenciais
    carregarDadosIniciais();

    // Restauração de dados - apenas se não foram limpos intencionalmente
    const limpezaIntencional = localStorage.getItem("camposManuaisLimpos");
    if (
      !limpezaIntencional ||
      new Date() - new Date(limpezaIntencional) > 300000
    ) {
      // > 5 minutos
      verificarRecuperacaoDados();
      carregarValoresManualDoLocalStorage();
    }

    carregarValoresDoLocalStorage();
    carregarResultadosDoLocalStorage();

    // Inicializar interface primeira
    inicializarMenuMobile();
    inicializarMenuAbas();

    // Carregamento adiado para UI handlers que não são críticos
    setTimeout(() => {
      inicializarEventListeners();
      inicializarBotoesEspeciais();

      // Auto-salvamento
      iniciarAutoSalvamento();
      iniciarAutoSalvamentoManual();

      // Adicionamos observador de interseção para carregar gráfico apenas quando visível
      const graficoContainer = document.querySelector(
        ".dashboard-card:nth-child(3)"
      );
      if (graficoContainer) {
        const graficoObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) {
                atualizarGrafico();
                graficoObserver.unobserve(entry.target);
              }
            });
          },
          { threshold: 0.1 }
        );
        graficoObserver.observe(graficoContainer);
      }
    }, 100);

    const btnExportar = document.getElementById("exportarDados");
    if (btnExportar) {
      // Remover eventos anteriores para evitar duplicações
      btnExportar.replaceWith(btnExportar.cloneNode(true));
      // Adicionar o evento uma única vez
      document.getElementById("exportarDados").addEventListener("click", () => {
        salvarValoresNoLocalStorage(); // Garante dados atualizados
        exportarDados();
      });
    }
  } catch (error) {
    console.error("Erro durante a inicialização:", error);
  }
});

function exportarDados() {
  try {
    // Busca apenas os dados do cálculo manual
    const valoresManual = {};
    tiposBebidas.forEach((bebida) => {
      const campo = document.getElementById(`${bebida.id}_manual`);
      if (campo && campo.value) {
        valoresManual[bebida.id] = campo.value;
      }
    });

    // Verifica se existem dados para exportar
    if (
      !tiposBebidas.length ||
      Object.keys(valoresManual).filter((k) => valoresManual[k]).length === 0
    ) {
      mostrarNotificacao("Nenhum dado manual para exportar", "erro");
      return;
    }

    // Calcula os resultados manuais para mostrar no PDF
    const resultados = calcularManual();

    // Monta os dados para a tabela
    const tableData = tiposBebidas
      .filter((bebida) => valoresManual[bebida.id])
      .map((bebida) => [
        bebida.nome,
        valoresManual[bebida.id] || "",
        resultados[bebida.id] || "0",
      ]);

    // Cria o PDF
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.text("Relatório de Consumo de Bebidas - Cálculo Manual", 14, 18);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Data de exportação: ${new Date().toLocaleString()}`, 14, 25);

    // Usa o plugin autoTable
    autoTable(doc, {
      startY: 30,
      head: [["Bebida", "Valores Individuais", "Total"]],
      body: tableData,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [229, 62, 62] },
    });

    doc.save("consumo-bebidas-manual.pdf");
    mostrarNotificacao(
      "PDF dos dados manuais exportado com sucesso!",
      "sucesso"
    );
  } catch (error) {
    console.error("Erro ao exportar PDF:", error);
    mostrarNotificacao("Erro ao gerar PDF: " + error.message, "erro");
  }
}

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

// Modifique a função implementarPWA para usar o caminho correto do Service Worker
function implementarPWA() {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/service-worker.js") // Caminho atualizado
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
