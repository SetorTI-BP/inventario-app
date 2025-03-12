import React, { useState, useEffect } from "react";
import * as XLSX from "xlsx";
import './InventoryApp.css';

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
  });
  const [errorMessage, setErrorMessage] = useState("");  // Estado para armazenar a mensagem de erro
  const [editingItem, setEditingItem] = useState(null);  // Estado para editar um item
  const [viewingItem, setViewingItem] = useState(null);  // Estado para visualizar um item (detalhes)

  useEffect(() => {
    // Carregar os itens do IndexedDB ao inicializar
    getItemsFromDB()
      .then((loadedItems) => setItems(loadedItems))
      .catch((error) => console.error("Erro ao carregar itens do IndexedDB:", error));
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Verifica se o número de série ou patrimônio já existe no IndexedDB
    const existingItem = items.find(item => item.numeroSerie === form.numeroSerie || item.patrimonio === form.patrimonio);
    if (existingItem && !editingItem) {
      setErrorMessage("Número de série ou patrimônio já cadastrados.");
      return;
    }

    // Atualiza o item no caso de edição, ou adiciona um novo item
    const newItems = editingItem
      ? items.map((item) => item.numeroSerie === editingItem.numeroSerie ? form : item)
      : [...items, form];

    setItems(newItems);

    // Salva o item no IndexedDB
    addItemToDB(form)
      .then(() => {
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
        });
        setEditingItem(null); // Limpa o estado de edição
        setErrorMessage(""); // Limpar a mensagem de erro, se houver
      })
      .catch((error) => setErrorMessage("Erro ao adicionar item no IndexedDB"));
  };

  const handleEdit = (item) => {
    setForm(item);
    setEditingItem(item);
  };

  const handleDelete = (numeroSerie) => {
    const updatedItems = items.filter(item => item.numeroSerie !== numeroSerie);
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
    };
    return placeholders[key] || key.charAt(0).toUpperCase() + key.slice(1);
  };

  return (
    <div className="container">
      <h2 className="title">Cadastro de Inventário SMEC Balneário Pinhal</h2>
      <form onSubmit={handleSubmit} className="form">
        {Object.keys(form).map((key, index) =>
          key !== "local" ? (
            <input
              key={index}
              name={key}
              value={form[key]}
              onChange={handleChange}
              placeholder={getPlaceholder(key)}
              className="input"
              required
            />
          ) : null
        )}
        <input
          key="local"
          name="local"
          value={form.local}
          onChange={handleChange}
          placeholder="Local de Armazenamento"
          className="input"
          required
        />
        <button type="submit" className="btn">{editingItem ? "Salvar Alterações" : "Adicionar"}</button>
      </form>
      <button onClick={exportToExcel} className="btn export-btn">Exportar para Excel</button>
      <button onClick={handleWhatsAppShare} className="btn export-btn">Compartilhar no WhatsApp</button>

      {/* Popup de erro */}
      {errorMessage && (
        <div className="error-popup">
          <div className="error-popup-content">
            <span className="error-popup-close" onClick={() => setErrorMessage("")}>×</span>
            <p>{errorMessage}</p>
          </div>
        </div>
      )}

      {/* Modal de visualização do item */}
      {viewingItem && (
        <div className="modal">
          <div className="modal-content">
            <span className="close" onClick={() => setViewingItem(null)}>&times;</span>
            <h3>Detalhes do Item</h3>
            <p><strong>Marca:</strong> {viewingItem.marca}</p>
            <p><strong>Número de Série:</strong> {viewingItem.numeroSerie}</p>
            <p><strong>Patrimônio:</strong> {viewingItem.patrimonio}</p>
            <p><strong>Modelo:</strong> {viewingItem.modelo}</p>
            <p><strong>Memória RAM:</strong> {viewingItem.ram}</p>
            <p><strong>Processador:</strong> {viewingItem.processador}</p>
            <p><strong>Placa Mãe:</strong> {viewingItem.placaMae}</p>
            <p><strong>Armazenamento:</strong> {viewingItem.armazenamento}</p>
            <p><strong>Local de Armazenamento:</strong> {viewingItem.local}</p>
          </div>
        </div>
      )}

      <ul className="item-list">
        {items.map((item, index) => (
          <li key={index} className="item">
            {item.marca} - {item.local} - {item.ram} - {item.processador} - {item.placaMae} - {item.armazenamento}
            <button onClick={() => handleView(item)} className="btn view-btn">Visualizar</button>
            <button onClick={() => handleEdit(item)} className="btn edit-btn">Editar</button>
            <button onClick={() => handleDelete(item.numeroSerie)} className="btn delete-btn">Excluir</button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default InventoryApp;