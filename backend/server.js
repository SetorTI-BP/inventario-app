const express = require("express");
const { Client } = require("pg");  
const cors = require("cors");
const bodyParser = require("body-parser");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// URL completa de conexão com o banco de dados PostgreSQL
const connectionString = 'postgresql://generation_heritage_user:5z0u364LQZjf4HHUYy9EcxSePJnBQyYn@dpg-cv8rha23esus73din96g-a.oregon-postgres.render.com/generation_heritage';

// Configuração do cliente PostgreSQL
const client = new Client({
  connectionString: connectionString,  // Usando a URL completa
  ssl: {
    rejectUnauthorized: false,  // Adiciona isso se o banco de dados exigir conexão SSL
  },
  connectionTimeoutMillis: 5000,  // Timeout de conexão (5 segundos)
  statement_timeout: 10000, // Timeout de leitura/escrita (10 segundos)
});

client.connect()
  .then(() => console.log('Conectado ao PostgreSQL'))
  .catch((err) => console.log('Erro ao conectar ao PostgreSQL:', err));

// Endpoint para adicionar itens ao banco
app.post("/items", async (req, res) => {
    const { marca, numeroSerie, patrimonio, modelo, ram, processador, placaMae, armazenamento, local } = req.body;
  
    try {
      // Verificar se o número de série ou patrimônio já existe
      const existingItemQuery = `
        SELECT * FROM items WHERE numeroSerie = $1 OR patrimonio = $2;
      `;
      const existingItemResult = await client.query(existingItemQuery, [numeroSerie, patrimonio]);
  
      if (existingItemResult.rows.length > 0) {
        const existingItems = existingItemResult.rows;
        const alreadyExistsNumeroSerie = existingItems.filter(item => item.numeroSerie === numeroSerie);
        const alreadyExistsPatrimonio = existingItems.filter(item => item.patrimonio === patrimonio);
  
        if (alreadyExistsNumeroSerie.length > 0 && alreadyExistsPatrimonio.length > 0) {
          return res.status(400).json({ error: "O item já foi cadastrado com esse número de série e patrimônio." });
        }
  
        if (alreadyExistsNumeroSerie.length > 0) {
          return res.status(400).json({ error: "O item já foi cadastrado com esse número de série." });
        }
  
        if (alreadyExistsPatrimonio.length > 0) {
          return res.status(400).json({ error: "O item já foi cadastrado com esse patrimônio." });
        }
      }
  
      const result = await client.query(
        'INSERT INTO items(marca, numeroSerie, patrimonio, modelo, ram, processador, placaMae, armazenamento, local) VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *',
        [marca, numeroSerie, patrimonio, modelo, ram, processador, placaMae, armazenamento, local]
      );
  
      const newItem = result.rows[0];  
      res.status(201).json(newItem);
    } catch (error) {
      console.error('Erro ao adicionar item:', error);
      res.status(400).json({ error: "Erro ao adicionar item" });
    }
});  

// Endpoint para obter todos os itens
app.get("/items", async (req, res) => {
  try {
    const result = await client.query('SELECT * FROM items');
    res.status(200).json(result.rows);  // Retorna todos os itens encontrados
  } catch (error) {
    console.error('Erro ao buscar itens:', error);
    res.status(400).json({ error: "Erro ao buscar itens" });
  }
});

app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});