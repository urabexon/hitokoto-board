const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

// データ保存先（gitignore対象）。Render等でも起動時に自動作成される
const dataDir = path.join(__dirname, 'data');
fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'board.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS posts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT    NOT NULL,
    message     TEXT    NOT NULL,
    likes       INTEGER NOT NULL DEFAULT 0,
    owner_token TEXT    NOT NULL,
    created_at  TEXT    NOT NULL
  )
`);

const stmts = {
  list: db.prepare('SELECT * FROM posts ORDER BY id DESC LIMIT 100'),
  create: db.prepare(
    'INSERT INTO posts (name, message, owner_token, created_at) VALUES (?, ?, ?, ?)'
  ),
  like: db.prepare('UPDATE posts SET likes = likes + 1 WHERE id = ?'),
  find: db.prepare('SELECT * FROM posts WHERE id = ?'),
  remove: db.prepare('DELETE FROM posts WHERE id = ? AND owner_token = ?'),
};

function listPosts() {
  return stmts.list.all();
}

function createPost(name, message, ownerToken) {
  stmts.create.run(name, message, ownerToken, new Date().toISOString());
}

function likePost(id) {
  stmts.like.run(id);
}

function findPost(id) {
  return stmts.find.get(id);
}

// 投稿時のトークンと一致する場合のみ削除できる（本人確認）
function deletePost(id, ownerToken) {
  return stmts.remove.run(id, ownerToken).changes > 0;
}

module.exports = { listPosts, createPost, likePost, findPost, deletePost };
