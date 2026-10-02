const express = require('express');
const db = require('../db'); // precisa ser um pool do mysql2/promise (createPool)

const router = express.Router();

const STATUS_PEDIDO = ['pendente', 'pago', 'cancelado'];

function idValido(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0;
}

function erroBanco(res, err) {
  if (err.code === 'ER_NO_REFERENCED_ROW_2') {
    return res.status(404).json({ erro: 'Cliente ou produto referenciado não existe.' });
  }
  console.error(err);
  return res.status(500).json({ erro: 'Erro interno do servidor.' });
}

// Recalcula valor_total a partir dos itens (usa a mesma conexão da transação)
async function recalcularTotal(conn, pedidoId) {
  await conn.query(
    `UPDATE pedidos
        SET valor_total = (SELECT COALESCE(SUM(quantidade * preco_unitario), 0)
                             FROM itens_pedido WHERE pedido_id = ?)
      WHERE id = ?`,
    [pedidoId, pedidoId]
  );
}

// POST /pedidos
router.post('/', async (req, res) => {
  try {
    const { cliente_id, atendido_por = null } = req.body;
    if (!cliente_id) return res.status(400).json({ erro: 'Campo obrigatório: cliente_id.' });
    if (!idValido(cliente_id)) return res.status(400).json({ erro: 'cliente_id inválido.' });
    if (atendido_por !== null && !idValido(atendido_por)) {
      return res.status(400).json({ erro: 'atendido_por inválido.' });
    }

    const [cli] = await db.query('SELECT id FROM clientes WHERE id = ?', [cliente_id]);
    if (cli.length === 0) return res.status(404).json({ erro: 'Cliente não encontrado.' });

    if (atendido_por !== null) {
      const [usr] = await db.query('SELECT id FROM usuarios WHERE id = ?', [atendido_por]);
      if (usr.length === 0) return res.status(404).json({ erro: 'Usuário (atendido_por) não encontrado.' });
    }

    const [r] = await db.query(
      'INSERT INTO pedidos (cliente_id, atendido_por) VALUES (?, ?)',
      [cliente_id, atendido_por]
    );
    const [rows] = await db.query('SELECT * FROM pedidos WHERE id = ?', [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    erroBanco(res, err);
  }
});

// GET /pedidos
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT p.id, p.data_pedido, p.status, p.valor_total,
              c.id AS cliente_id, c.nome AS cliente_nome, c.email AS cliente_email,
              p.atendido_por, u.nome AS atendido_por_nome
         FROM pedidos p
         JOIN clientes c ON c.id = p.cliente_id
         LEFT JOIN usuarios u ON u.id = p.atendido_por
        ORDER BY p.id DESC`
    );
    res.status(200).json(rows);
  } catch (err) {
    erroBanco(res, err);
  }
});

// GET /pedidos/:id  (pedido + cliente + itens)
router.get('/:id', async (req, res) => {
  try {
    if (!idValido(req.params.id)) return res.status(400).json({ erro: 'ID inválido.' });

    const [pedidos] = await db.query(
      `SELECT p.id, p.data_pedido, p.status, p.valor_total,
              c.id AS cliente_id, c.nome AS cliente_nome,
              c.email AS cliente_email, c.telefone AS cliente_telefone,
              p.atendido_por, u.nome AS atendido_por_nome
         FROM pedidos p
         JOIN clientes c ON c.id = p.cliente_id
         LEFT JOIN usuarios u ON u.id = p.atendido_por
        WHERE p.id = ?`,
      [req.params.id]
    );
    if (pedidos.length === 0) return res.status(404).json({ erro: 'Pedido não encontrado.' });

    const [itens] = await db.query(
      `SELECT i.id, i.produto_id, pr.nome AS produto_nome,
              i.quantidade, i.preco_unitario,
              (i.quantidade * i.preco_unitario) AS subtotal
         FROM itens_pedido i
         JOIN produtos pr ON pr.id = i.produto_id
        WHERE i.pedido_id = ?
        ORDER BY i.id`,
      [req.params.id]
    );

    const p = pedidos[0];
    res.status(200).json({
      id: p.id,
      data_pedido: p.data_pedido,
      status: p.status,
      valor_total: p.valor_total,
      cliente: {
        id: p.cliente_id,
        nome: p.cliente_nome,
        email: p.cliente_email,
        telefone: p.cliente_telefone,
      },
      atendido_por: p.atendido_por ? { id: p.atendido_por, nome: p.atendido_por_nome } : null,
      itens,
    });
  } catch (err) {
    erroBanco(res, err);
  }
});

// PATCH /pedidos/:id/status
router.patch('/:id/status', async (req, res) => {
  try {
    if (!idValido(req.params.id)) return res.status(400).json({ erro: 'ID inválido.' });

    const { status } = req.body;
    if (!status) return res.status(400).json({ erro: 'Campo obrigatório: status.' });
    if (!STATUS_PEDIDO.includes(status)) {
      return res.status(400).json({ erro: `Status inválido. Use: ${STATUS_PEDIDO.join(', ')}.` });
    }

    const [r] = await db.query('UPDATE pedidos SET status = ? WHERE id = ?', [status, req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ erro: 'Pedido não encontrado.' });

    const [rows] = await db.query('SELECT * FROM pedidos WHERE id = ?', [req.params.id]);
    res.status(200).json(rows[0]);
  } catch (err) {
    erroBanco(res, err);
  }
});

// POST /pedidos/:id/itens
router.post('/:id/itens', async (req, res) => {
  let conn;
  try {
    if (!idValido(req.params.id)) return res.status(400).json({ erro: 'ID inválido.' });

    const { produto_id, quantidade, preco_unitario } = req.body;
    if (!produto_id || quantidade === undefined) {
      return res.status(400).json({ erro: 'Campos obrigatórios: produto_id e quantidade (preco_unitario opcional).' });
    }
    if (!idValido(produto_id)) return res.status(400).json({ erro: 'produto_id inválido.' });
    if (!Number.isInteger(Number(quantidade)) || Number(quantidade) <= 0) {
      return res.status(400).json({ erro: 'quantidade deve ser um inteiro maior que zero.' });
    }
    if (preco_unitario !== undefined && (isNaN(Number(preco_unitario)) || Number(preco_unitario) < 0)) {
      return res.status(400).json({ erro: 'preco_unitario deve ser um número maior ou igual a zero.' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [ped] = await conn.query('SELECT status FROM pedidos WHERE id = ? FOR UPDATE', [req.params.id]);
    if (ped.length === 0) {
      await conn.rollback();
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }
    if (ped[0].status !== 'pendente') {
      await conn.rollback();
      return res.status(409).json({ erro: 'Só é possível alterar itens de pedidos pendentes.' });
    }

    const [prod] = await conn.query('SELECT id, preco FROM produtos WHERE id = ?', [produto_id]);
    if (prod.length === 0) {
      await conn.rollback();
      return res.status(404).json({ erro: 'Produto não encontrado.' });
    }

    // se o preço não vier no body, usa o preço atual do produto
    const preco = preco_unitario !== undefined ? Number(preco_unitario) : prod[0].preco;

    const [r] = await conn.query(
      'INSERT INTO itens_pedido (pedido_id, produto_id, quantidade, preco_unitario) VALUES (?, ?, ?, ?)',
      [req.params.id, produto_id, Number(quantidade), preco]
    );
    await recalcularTotal(conn, req.params.id);
    await conn.commit();

    const [item] = await db.query('SELECT * FROM itens_pedido WHERE id = ?', [r.insertId]);
    res.status(201).json(item[0]);
  } catch (err) {
    if (conn) await conn.rollback();
    erroBanco(res, err);
  } finally {
    if (conn) conn.release();
  }
});

// DELETE /pedidos/:id_pedido/itens/:id_item
router.delete('/:id_pedido/itens/:id_item', async (req, res) => {
  let conn;
  try {
    const { id_pedido, id_item } = req.params;
    if (!idValido(id_pedido) || !idValido(id_item)) {
      return res.status(400).json({ erro: 'IDs inválidos.' });
    }

    conn = await db.getConnection();
    await conn.beginTransaction();

    const [ped] = await conn.query('SELECT status FROM pedidos WHERE id = ? FOR UPDATE', [id_pedido]);
    if (ped.length === 0) {
      await conn.rollback();
      return res.status(404).json({ erro: 'Pedido não encontrado.' });
    }
    if (ped[0].status !== 'pendente') {
      await conn.rollback();
      return res.status(409).json({ erro: 'Só é possível alterar itens de pedidos pendentes.' });
    }

    const [r] = await conn.query('DELETE FROM itens_pedido WHERE id = ? AND pedido_id = ?', [id_item, id_pedido]);
    if (r.affectedRows === 0) {
      await conn.rollback();
      return res.status(404).json({ erro: 'Item não encontrado neste pedido.' });
    }

    await recalcularTotal(conn, id_pedido);
    await conn.commit();
    res.status(200).json({ mensagem: 'Item removido com sucesso.' });
  } catch (err) {
    if (conn) await conn.rollback();
    erroBanco(res, err);
  } finally {
    if (conn) conn.release();
  }
});

module.exports = router;