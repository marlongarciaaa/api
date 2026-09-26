// routes/usuarios.js
const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcrypt'); // npm install bcrypt

const PERFIS_VALIDOS = ['admin', 'operador'];
const STATUS_VALIDOS = ['ativo', 'inativo'];
const SALT_ROUNDS = 10;

// CREATE: Inserir Usuário
router.post('/', async (req, res) => {
  const { nome, email, senha, perfil } = req.body;

  if (!nome || !email || !senha) {
    return res.status(400).json({ mensagem: 'Nome, email e senha são obrigatórios.' });
  }

  if (perfil && !PERFIS_VALIDOS.includes(perfil)) {
    return res.status(400).json({ mensagem: `Perfil inválido. Use: ${PERFIS_VALIDOS.join(', ')}.` });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

    const [result] = await db.execute(
      'INSERT INTO usuarios (nome, email, senha, perfil) VALUES (?, ?, ?, ?)',
      [nome, email, senhaHash, perfil || 'operador']
    );

    res.status(201).json({
      id: result.insertId,
      nome,
      email,
      perfil: perfil || 'operador',
      status: 'ativo'
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ mensagem: 'Email já cadastrado.' });
    }
    res.status(500).json({ mensagem: 'Erro interno no servidor.', detalhes: error.message });
  }
});

// READ: Listar todos (nunca retornar a senha)
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.execute(
      'SELECT id, nome, email, perfil, status, criado_em FROM usuarios'
    );
    res.status(200).json(rows);
  } catch (error) {
    res.status(500).json({ mensagem: 'Erro ao buscar usuários.', detalhes: error.message });
  }
});

// READ: Buscar por ID (nunca retornar a senha)
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [rows] = await db.execute(
      'SELECT id, nome, email, perfil, status, criado_em FROM usuarios WHERE id = ?',
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
    }
    res.status(200).json(rows[0]);
  } catch (error) {
    res.status(500).json({ mensagem: 'Erro ao buscar usuário.', detalhes: error.message });
  }
});

// UPDATE Completo (PUT)
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { nome, email, senha, perfil, status } = req.body;

  if (!nome || !email || !senha || !status) {
    return res.status(400).json({
      mensagem: 'Para atualização completa (PUT), informe: nome, email, senha e status.'
    });
  }

  if (perfil && !PERFIS_VALIDOS.includes(perfil)) {
    return res.status(400).json({ mensagem: `Perfil inválido. Use: ${PERFIS_VALIDOS.join(', ')}.` });
  }
  if (!STATUS_VALIDOS.includes(status)) {
    return res.status(400).json({ mensagem: `Status inválido. Use: ${STATUS_VALIDOS.join(', ')}.` });
  }

  try {
    const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

    const [result] = await db.execute(
      'UPDATE usuarios SET nome = ?, email = ?, senha = ?, perfil = ?, status = ? WHERE id = ?',
      [nome, email, senhaHash, perfil || 'operador', status, id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
    }
    res.status(200).json({ mensagem: 'Usuário atualizado completamente com sucesso.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ mensagem: 'Email já cadastrado.' });
    }
    res.status(500).json({ mensagem: 'Erro ao atualizar usuário.', detalhes: error.message });
  }
});

// UPDATE Parcial (PATCH)
router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const campos = { ...req.body };

  if (Object.keys(campos).length === 0) {
    return res.status(400).json({ mensagem: 'Nenhum campo fornecido para atualização.' });
  }

  if (campos.perfil && !PERFIS_VALIDOS.includes(campos.perfil)) {
    return res.status(400).json({ mensagem: `Perfil inválido. Use: ${PERFIS_VALIDOS.join(', ')}.` });
  }
  if (campos.status && !STATUS_VALIDOS.includes(campos.status)) {
    return res.status(400).json({ mensagem: `Status inválido. Use: ${STATUS_VALIDOS.join(', ')}.` });
  }

  // Se a senha for enviada, faz o hash antes de montar a query
  if (campos.senha) {
    campos.senha = await bcrypt.hash(campos.senha, SALT_ROUNDS);
  }

  const setClauses = [];
  const queryParams = [];

  for (const [chave, valor] of Object.entries(campos)) {
    if (['nome', 'email', 'senha', 'perfil', 'status'].includes(chave)) {
      setClauses.push(`${chave} = ?`);
      queryParams.push(valor);
    }
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ mensagem: 'Nenhum campo válido enviado.' });
  }

  queryParams.push(id);
  const sql = `UPDATE usuarios SET ${setClauses.join(', ')} WHERE id = ?`;

  try {
    const [result] = await db.execute(sql, queryParams);
    if (result.affectedRows === 0) {
      return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
    }
    res.status(200).json({ mensagem: 'Usuário atualizado parcialmente com sucesso.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ mensagem: 'Email já cadastrado.' });
    }
    res.status(500).json({ mensagem: 'Erro ao atualizar usuário.', detalhes: error.message });
  }
});

// DELETE: Remover
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await db.execute('DELETE FROM usuarios WHERE id = ?', [id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ mensagem: 'Usuário não encontrado.' });
    }
    res.status(200).json({ mensagem: 'Usuário removido com sucesso.' });
  } catch (error) {
    res.status(500).json({ mensagem: 'Erro ao remover usuário.', detalhes: error.message });
  }
});

module.exports = router;