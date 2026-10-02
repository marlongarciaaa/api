const express = require('express');
const db = require('../db'); // ajuste para o mesmo require usado no clientes.js

const router = express.Router();

const PERFIS = ['admin', 'operador'];
const STATUS = ['ativo', 'inativo'];
const CAMPOS = 'id, nome, email, perfil, status, criado_em'; // nunca devolve a senha

function idValido(valor) {
  const n = Number(valor);
  return Number.isInteger(n) && n > 0;
}

function erroBanco(res, err) {
  if (err.code === 'ER_DUP_ENTRY') {
    return res.status(409).json({ erro: 'Já existe um usuário com esse e-mail.' });
  }
  if (err.code === 'ER_ROW_IS_REFERENCED_2') {
    return res.status(409).json({ erro: 'Usuário vinculado a outros registros e não pode ser removido.' });
  }
  console.error(err);
  return res.status(500).json({ erro: 'Erro interno do servidor.' });
}

// POST /usuarios
router.post('/', async (req, res) => {
  try {
    const { nome, email, senha, perfil = 'operador', status = 'ativo' } = req.body;

    if (!nome || !email || !senha) {
      return res.status(400).json({ erro: 'Campos obrigatórios: nome, email e senha.' });
    }
    if (!PERFIS.includes(perfil)) {
      return res.status(400).json({ erro: `Perfil inválido. Use: ${PERFIS.join(', ')}.` });
    }
    if (!STATUS.includes(status)) {
      return res.status(400).json({ erro: `Status inválido. Use: ${STATUS.join(', ')}.` });
    }

    const [r] = await db.query(
      'INSERT INTO usuarios (nome, email, senha, perfil, status) VALUES (?, ?, ?, ?, ?)',
      [nome, email, senha, perfil, status]
    );
    const [rows] = await db.query(`SELECT ${CAMPOS} FROM usuarios WHERE id = ?`, [r.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    erroBanco(res, err);
  }
});

// GET /usuarios
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`SELECT ${CAMPOS} FROM usuarios ORDER BY id`);
    res.status(200).json(rows);
  } catch (err) {
    erroBanco(res, err);
  }
});

// GET /usuarios/:id
router.get('/:id', async (req, res) => {
  try {
    if (!idValido(req.params.id)) return res.status(400).json({ erro: 'ID inválido.' });

    const [rows] = await db.query(`SELECT ${CAMPOS} FROM usuarios WHERE id = ?`, [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    res.status(200).json(rows[0]);
  } catch (err) {
    erroBanco(res, err);
  }
});

// PUT /usuarios/:id  (atualização completa)
router.put('/:id', async (req, res) => {
  try {
    if (!idValido(req.params.id)) return res.status(400).json({ erro: 'ID inválido.' });

    const { nome, email, senha, perfil, status } = req.body;
    if (!nome || !email || !senha || !perfil || !status) {
      return res.status(400).json({ erro: 'PUT exige todos os campos: nome, email, senha, perfil e status.' });
    }
    if (!PERFIS.includes(perfil)) {
      return res.status(400).json({ erro: `Perfil inválido. Use: ${PERFIS.join(', ')}.` });
    }
    if (!STATUS.includes(status)) {
      return res.status(400).json({ erro: `Status inválido. Use: ${STATUS.join(', ')}.` });
    }

    const [r] = await db.query(
      'UPDATE usuarios SET nome = ?, email = ?, senha = ?, perfil = ?, status = ? WHERE id = ?',
      [nome, email, senha, perfil, status, req.params.id]
    );
    if (r.affectedRows === 0) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    const [rows] = await db.query(`SELECT ${CAMPOS} FROM usuarios WHERE id = ?`, [req.params.id]);
    res.status(200).json(rows[0]);
  } catch (err) {
    erroBanco(res, err);
  }
});

// PATCH /usuarios/:id  (atualização parcial)
router.patch('/:id', async (req, res) => {
  try {
    if (!idValido(req.params.id)) return res.status(400).json({ erro: 'ID inválido.' });

    const permitidos = ['nome', 'email', 'senha', 'perfil', 'status'];
    const campos = [];
    const valores = [];

    for (const campo of permitidos) {
      if (req.body[campo] !== undefined) {
        const valor = req.body[campo];
        if (valor === '' || valor === null) {
          return res.status(400).json({ erro: `O campo ${campo} não pode ser vazio.` });
        }
        if (campo === 'perfil' && !PERFIS.includes(valor)) {
          return res.status(400).json({ erro: `Perfil inválido. Use: ${PERFIS.join(', ')}.` });
        }
        if (campo === 'status' && !STATUS.includes(valor)) {
          return res.status(400).json({ erro: `Status inválido. Use: ${STATUS.join(', ')}.` });
        }
        campos.push(`${campo} = ?`);
        valores.push(valor);
      }
    }

    if (campos.length === 0) {
      return res.status(400).json({ erro: `Envie ao menos um campo: ${permitidos.join(', ')}.` });
    }

    valores.push(req.params.id);
    const [r] = await db.query(`UPDATE usuarios SET ${campos.join(', ')} WHERE id = ?`, valores);
    if (r.affectedRows === 0) return res.status(404).json({ erro: 'Usuário não encontrado.' });

    const [rows] = await db.query(`SELECT ${CAMPOS} FROM usuarios WHERE id = ?`, [req.params.id]);
    res.status(200).json(rows[0]);
  } catch (err) {
    erroBanco(res, err);
  }
});

// DELETE /usuarios/:id
router.delete('/:id', async (req, res) => {
  try {
    if (!idValido(req.params.id)) return res.status(400).json({ erro: 'ID inválido.' });

    const [r] = await db.query('DELETE FROM usuarios WHERE id = ?', [req.params.id]);
    if (r.affectedRows === 0) return res.status(404).json({ erro: 'Usuário não encontrado.' });
    res.status(200).json({ mensagem: 'Usuário removido com sucesso.' });
  } catch (err) {
    erroBanco(res, err);
  }
});

module.exports = router;