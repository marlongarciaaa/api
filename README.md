# Sistema de Gestão de Vendas – API

API REST em Node.js, Express e MySQL/MariaDB para gestão de **clientes, produtos, usuários e pedidos** (com itens). Projeto da unidade curricular Desenvolvimento de APIs – SENAI.

## Requisitos

- Node.js 18+
- MySQL ou MariaDB
- Insomnia ou Postman (para testar)

## Instalação

```bash
git clone <URL-DO-REPOSITORIO>
cd <pasta-do-projeto>
npm install
```

## Variáveis de ambiente

Copie o arquivo de exemplo e preencha com os dados do seu banco:

```bash
cp .env.example .env
```

| Variável | Descrição | Exemplo |
|---|---|---|
| `PORT` | Porta da API | `3000` |
| `DB_HOST` | Host do banco | `localhost` |
| `DB_PORT` | Porta do banco | `3306` |
| `DB_USER` | Usuário do banco | `root` |
| `DB_PASSWORD` | Senha do banco | *(vazia ou sua senha)* |
| `DB_NAME` | Nome do banco | `sistema_clientes` |

## Importar o banco de dados

O arquivo `script_banco.sql` (na raiz do projeto) cria o banco `sistema_clientes`, todas as tabelas e insere dados iniciais de teste.

> Atenção: o script começa com `DROP DATABASE IF EXISTS sistema_clientes`, então apaga o banco existente com esse nome.

Pelo terminal:

```bash
mysql -u root -p < script_banco.sql
```

Ou abra o arquivo no DBeaver / Workbench e execute o script inteiro.

## Rodar a aplicação

```bash
npm run dev
```

A API sobe em `http://localhost:3000` (ou na porta definida em `PORT`).

## Estrutura

```
routes/
  clientes.js
  produtos.js
  usuarios.js
  pedidos.js
index.js
script_banco.sql
.env.example
```

## Modelo de dados

- `clientes`, `produtos`, `usuarios`
- `pedidos` – cabeçalho do pedido (`cliente_id`, `atendido_por`, `status`, `valor_total`)
- `itens_pedido` – itens de cada pedido (`pedido_id`, `produto_id`, `quantidade`, `preco_unitario`)

## Endpoints

### Usuários – `/usuarios`

| Método | Rota | Descrição |
|---|---|---|
| POST | `/usuarios` | Cadastra usuário (`nome`, `email`, `senha` obrigatórios; `perfil` e `status` opcionais) |
| GET | `/usuarios` | Lista usuários |
| GET | `/usuarios/:id` | Busca usuário por ID |
| PUT | `/usuarios/:id` | Atualização completa (todos os campos) |
| PATCH | `/usuarios/:id` | Atualização parcial (ex.: só `senha` ou `status`) |
| DELETE | `/usuarios/:id` | Remove usuário |

### Pedidos – `/pedidos`

| Método | Rota | Descrição |
|---|---|---|
| POST | `/pedidos` | Cria pedido (`cliente_id` obrigatório; `atendido_por` opcional) |
| GET | `/pedidos` | Lista pedidos com os dados do cliente |
| GET | `/pedidos/:id` | Pedido completo: dados, cliente e itens |
| PATCH | `/pedidos/:id/status` | Altera o status (`pendente`, `pago`, `cancelado`) |
| POST | `/pedidos/:id/itens` | Adiciona item (`produto_id`, `quantidade`, `preco_unitario`) |
| DELETE | `/pedidos/:id_pedido/itens/:id_item` | Remove item do pedido |

O `valor_total` do pedido é recalculado automaticamente ao adicionar ou remover itens. Só é possível alterar itens de pedidos com status `pendente`.

### Exemplos de corpo (JSON)

```json
// POST /usuarios
{ "nome": "Ana Lima", "email": "ana@exemplo.com", "senha": "123456", "perfil": "operador" }

// PATCH /usuarios/1
{ "status": "inativo" }

// POST /pedidos
{ "cliente_id": 3, "atendido_por": 2 }

// PATCH /pedidos/1/status
{ "status": "pago" }

// POST /pedidos/1/itens
{ "produto_id": 2, "quantidade": 1, "preco_unitario": 32900.00 }
```

## Códigos de status

| Código | Quando |
|---|---|
| 200 | Consulta, atualização ou remoção com sucesso |
| 201 | Registro criado |
| 400 | Campo obrigatório ausente, ID ou valor inválido |
| 404 | Registro não encontrado |
| 409 | E-mail duplicado ou pedido que não aceita alteração de itens |
| 500 | Erro interno do servidor |

## Testes

A coleção de requisições do Insomnia/Postman exportada está na pasta do projeto.
