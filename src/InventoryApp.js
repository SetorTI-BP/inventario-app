import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import "./InventoryApp.css";

// Função para abrir a base de dados IndexedDB
const openDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("inventoryDB", 1);

    request.onerror = (event) => reject("Erro ao abrir IndexedDB");

    request.onsuccess = (event) => resolve(event.target.result);

    // Criando a estrutura da base de dados (caso não exista)
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains("items")) {
        db.createObjectStore("items", { keyPath: "numeroSerie" });
      }
    };
  });
};

// Função para adicionar um item no IndexedDB
const addItemToDB = (item) => {
  return openDB().then((db) => {
    const transaction = db.transaction("items", "readwrite");
    const store = transaction.objectStore("items");
    store.put(item);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject("Erro ao adicionar item no IndexedDB");
    });
  });
};

// Função para carregar os itens do IndexedDB
const getItemsFromDB = () => {
  return openDB().then((db) => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction("items", "readonly");
      const store = transaction.objectStore("items");
      const request = store.getAll();
      request.onsuccess = (event) => resolve(event.target.result);
      request.onerror = () => reject("Erro ao carregar itens do IndexedDB");
    });
  });
};

// Função para excluir um item do IndexedDB
const deleteItemFromDB = (numeroSerie) => {
  return openDB().then((db) => {
    const transaction = db.transaction("items", "readwrite");
    const store = transaction.objectStore("items");
    store.delete(numeroSerie);
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject("Erro ao excluir item no IndexedDB");
    });
  });
};

const InventoryApp = () => {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({
    marca: "",
    numeroSerie: "",
    patrimonio: "",
    modelo: "",
    ram: "",
    processador: "",
    placaMae: "",
    armazenamento: "",
    local: "",
    setor: "",
  });
  const [errorMessage, setErrorMessage] = useState(""); // Estado para armazenar a mensagem de erro
  const [editingItem, setEditingItem] = useState(null); // Estado para editar um item
  const [viewingItem, setViewingItem] = useState(null); // Estado para visualizar um item (detalhes)

  useEffect(() => {
    // Carregar os itens do IndexedDB ao inicializar
    getItemsFromDB()
      .then((loadedItems) => setItems(loadedItems))
      .catch((error) =>
        console.error("Erro ao carregar itens do IndexedDB:", error)
      );
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Permitir apenas números no campo "patrimonio"
    if (name === "patrimonio" && !/^\d*$/.test(value)) {
      return; // Ignora entrada inválida
    }

    setForm({ ...form, [name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
  
    const existingItem = items.find(
      (item) =>
        item.numeroSerie === form.numeroSerie ||
        item.patrimonio === form.patrimonio
    );
    if (existingItem && !editingItem) {
      setErrorMessage("Número de série ou patrimônio já cadastrados.");
      return;
    }
  
    // Capturando a data e hora no formato PT-BR
    const dataCadastro = new Date().toLocaleString("pt-BR", {
      weekday: "long", // Dia da semana (exemplo: segunda-feira)
      year: "numeric", // Ano (exemplo: 2025)
      month: "numeric", // Mês (exemplo: 3)
      day: "numeric", // Dia (exemplo: 12)
      hour: "numeric", // Hora (exemplo: 14)
      minute: "numeric", // Minuto (exemplo: 30)
      second: "numeric", // Segundo (exemplo: 00)
      hour12: false, // 24h (para evitar o formato AM/PM)
    });
  
    // Incluindo o log com a data e hora no item
    const itemComData = {
      ...form,
      local: locaisMap[form.local] || form.local,
      dataCadastro, // Adicionando o campo dataCadastro
    };
  
    const newItems = editingItem
      ? items.map((item) =>
          item.numeroSerie === editingItem.numeroSerie ? itemComData : item
        )
      : [...items, itemComData];
  
    setItems(newItems);
  
    try {
      await addItemToDB(itemComData);
      await sendToMonkeySheets(itemComData); // Enviando os dados para a planilha
  
      setForm({
        marca: "",
        numeroSerie: "",
        patrimonio: "",
        modelo: "",
        ram: "",
        processador: "",
        placaMae: "",
        armazenamento: "",
        local: "",
        setor: "", // Certificando-se de que o campo setor seja resetado também
      });
  
      setEditingItem(null);
      setErrorMessage("");
    } catch (error) {
      setErrorMessage(
        "Erro ao adicionar item no IndexedDB ou enviar para o Monkey Sheets."
      );
    }
  };
  
  const handleEdit = (item) => {
    const { dataCadastro, ...itemSemData } = item;
    setForm(itemSemData); // Carregando o item para edição sem o campo de dataCadastro
    setEditingItem(item);
  };  

  const handleDelete = (numeroSerie) => {
    const updatedItems = items.filter(
      (item) => item.numeroSerie !== numeroSerie
    );
    setItems(updatedItems);
    deleteItemFromDB(numeroSerie)
      .then(() => console.log("Item excluído com sucesso"))
      .catch((error) => setErrorMessage("Erro ao excluir item no IndexedDB"));
  };

  const handleView = (item) => {
    setViewingItem(item);
  };

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(items);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");
    XLSX.writeFile(wb, "inventario.xlsx");
  };

  const handleWhatsAppShare = () => {
    const ws = XLSX.utils.json_to_sheet(items);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventario");

    // Salvar o arquivo como Blob
    const excelFile = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelFile], { type: "application/octet-stream" });
    const url = window.URL.createObjectURL(blob);

    // Criar o link de compartilhamento via WhatsApp
    const shareUrl = `https://wa.me/?text=Eu%20quero%20compartilhar%20o%20inventário%20com%20voc%C3%AA.%20%0A%0AArquivo%20Excel%20:%20${url}`;
    window.open(shareUrl, "_blank");
  };

  // Função para gerar um placeholder mais legível
  const getPlaceholder = (key) => {
    const placeholders = {
      marca: "Marca do Item",
      numeroSerie: "Número de Série",
      patrimonio: "Número do Patrimônio",
      modelo: "Notebook ou Desktop",
      ram: "Memória RAM",
      processador: "Processador",
      placaMae: "Placa Mãe",
      armazenamento: "Armazenamento",
      local: "Local de Armazenamento",
      setor: "Setor do equipamento",
    };
    return placeholders[key] || key.charAt(0).toUpperCase() + key.slice(1);
  };

  const locaisMap = {
    escola_magi: "E.M.E.F. Luiz de Oliveira",
    escola_magi_dois: "E.M.E.I. Estrelinha do Mar",
    escola_pinhal: "E.M.E.F. Calil Miguel Alem",
    escola_pinhal_dois: "E.M.E.I. Peixinho Dourado",
    escola_pinhal_tres: "E.M.E.F. José Antônio",
    escola_pinhal_quatro: "E.M.E.I. Golfinho do Mar",
    escola_pinhal_cinco: "E.M.E.F. Antônio Francisco Nunes",
    escola_tunel: "E.M.E.F. Barão de Santo Ângelo",
    escola_tunel_dois: "E.M.E.I. Abelhinhas",
    secretaria: "Secretaria Municipal de Educação e Cultura",
    uab: "Universidade Aberta Brasileira"
  };  

  return (
    <div className="container">
      <h2 className="title">Cadastro de Inventário SMEC Balneário Pinhal</h2>
      <form onSubmit={handleSubmit} className="form">
        {Object.keys(form).map((key, index) =>
          key === "modelo" ? (
            <select
              name="modelo"
              value={form.modelo}
              onChange={handleChange}
              className="input"
              required
              key={index}
            >
              <option value="">Selecione o modelo</option>
              <option value="ChromeBook">ChromeBook</option>
              <option value="CaixaDeSom">Caixa de Som</option>
              <option value="Desktop">Desktop</option>
              <option value="Estabilizador">Estabilizador</option>
              <option value="HubSwitch">HubSwitch</option>
              <option value="Impressora">Impressora</option>
              <option value="ModemWiFi">Modem Wi-Fi</option>
              <option value="Monitor">Monitor</option>
              <option value="Netbook">Netbook</option>
              <option value="NoBreak">NoBreak</option>
              <option value="Notebook">Notebook</option>
              <option value="Projetor">Projetor ou Data Show</option>
              <option value="Relogio">Relógio Ponto</option>
              <option value="Tela">Tela Interativa</option>
              <option value="Telefone">Telefone Fixo</option>
              <option value="Tablet">Tablet</option>
              <option value="Tv">TV ou SmartTv</option>
              <option value="Outro">Outro equipamento</option>
            </select>
          ) : key === "ram" ? (
            <select
              name="ram"
              value={form.ram}
              onChange={handleChange}
              className="input"
              required
              key={index}
            >
              <option value="">Selecione a Memória RAM</option>
              <option value="NotFound">Não se Aplica</option>
              <option value="2GBDDR2">2GB RAM DDR2</option>
              <option value="3GBDDR2">3GB RAM DDR2</option>
              <option value="2GBDDR3">2GB RAM DDR3</option>
              <option value="3GBDDR3">3GB RAM DDR3</option>
              <option value="4GBDDR3">4GB RAM DDR3</option>
              <option value="6GBDDR3">6GB RAM DDR3</option>
              <option value="8GBDDR3">8GB RAM DDR3</option>
              <option value="2GBDDR4">2GB RAM DDR4</option>
              <option value="3GBDDR4">3GB RAM DDR4</option>
              <option value="4GBDDR4">4GB RAM DDR4</option>
              <option value="6GBDDR4">6GB RAM DDR4</option>
              <option value="8GBDDR4">8GB RAM DDR4</option>
              <option value="4GBDDR5">4GB RAM DDR5</option>
              <option value="8GBDDR5">8GB RAM DDR5</option>
            </select>
          ) : key === "local" ? (
            <select
              name="local"
              value={form.local}
              onChange={handleChange}
              className="input"
              required
              key={index}
            >
              <option value="">Selecione o Local</option>
              <option value="escola_magi">E.M.E.F. Luiz de Oliveira</option>
              <option value="escola_magi_dois">
                E.M.E.I. Estrelinha do Mar
              </option>
              <option value="escola_pinhal">E.M.E.F. Calil Miguel Alem</option>
              <option value="escola_pinhal_dois">
                E.M.E.I. Peixinho Dourado
              </option>
              <option value="escola_pinhal_tres">E.M.E.F. José Antônio</option>
              <option value="escola_pinhal_quatro">
                E.M.E.I. Golfinho do Mar
              </option>
              <option value="escola_pinhal_cinco">
                E.M.E.F. Antônio Francisco Nunes
              </option>
              <option value="escola_tunel">
                E.M.E.F. Barão de Santo Ângelo
              </option>
              <option value="escola_tunel_dois">E.M.E.I. Abelhinhas</option>
              <option value="secretaria">
                Secretaria Municipal de Educação e Cultura
              </option>
              <option value="uab">Universidade Aberta Brasileira</option>
            </select>
          ) : (
            <input
              key={index}
              name={key}
              value={form[key]}
              onChange={handleChange}
              placeholder={getPlaceholder(key)} // Mantém os placeholders
              className="input"
              required
            />
          )
        )}
        <button type="submit" className="btn">
          {editingItem ? "Salvar Alterações" : "Adicionar"}
        </button>
      </form>

      <button onClick={exportToExcel} className="btn export-btn">
        Exportar para Excel
      </button>
      <button onClick={handleWhatsAppShare} className="btn export-btn">
        Compartilhar no WhatsApp
      </button>

      {/* Popup de erro */}
      {errorMessage && (
        <div className="error-popup">
          <div className="error-popup-content">
            <span
              className="error-popup-close"
              onClick={() => setErrorMessage("")}
            >
              ×
            </span>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Modal de visualização do item */}
      {viewingItem && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={() => setViewingItem(null)}>
              &times;
            </span>
            <h3>Detalhes do Item</h3>
            <p>
              <strong>Marca:</strong> {viewingItem.marca}
            </p>
            <p>
              <strong>Número de Série:</strong> {viewingItem.numeroSerie}
            </p>
            <p>
              <strong>Patrimônio:</strong> {viewingItem.patrimonio}
            </p>
            <p>
              <strong>Modelo:</strong> {viewingItem.modelo}
            </p>
            <p>
              <strong>Memória RAM:</strong> {viewingItem.ram}
            </p>
            <p>
              <strong>Processador:</strong> {viewingItem.processador}
            </p>
            <p>
              <strong>Placa Mãe:</strong> {viewingItem.placaMae}
            </p>
            <p>
              <strong>Armazenamento:</strong> {viewingItem.armazenamento}
            </p>
            <p>
              <strong>Local de Armazenamento:</strong> {viewingItem.local}
            </p>
            <p>
              <strong>Setor do equipamento:</strong> {viewingItem.setor}
            </p>
          </div>
        </div>
      )}

  
      <ul className="item-list">
        {items.map((item, index) => (
          <li key={index} className="item">
            {item.marca} - {locaisMap[item.local] || item.local} - {item.ram} - {item.processador} -{" "}
            {item.placaMae} - {item.armazenamento}
            <p>
              <strong>Data de Cadastro:</strong> {item.dataCadastro}
            </p>{" "}
            {/* Exibindo a data diretamente */}
            <button onClick={() => handleView(item)} className="btn view-btn">
              Visualizar
            </button>
            {/*<button onClick={() => handleEdit(item)} className="btn edit-btn">*
              Editar
            </button>*/}
            <button
              onClick={() => handleDelete(item.numeroSerie)}
              className="btn delete-btn"
            >
              Excluir
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const sendToMonkeySheets = async (item) => {
  try {
    const response = await fetch(
      "https://api.sheetmonkey.io/form/SqJf49vmGQyC9qe8iMvpn",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(item),
      }
    );

    if (!response.ok) {
      throw new Error("Erro ao enviar os dados para o Monkey Sheets.");
    }

    console.log("Dados enviados com sucesso para a planilha!");
  } catch (error) {
    console.error(error);
  }
};

export default InventoryApp;
