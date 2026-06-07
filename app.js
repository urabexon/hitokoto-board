const express = require('express');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

const MAX_NAME = 20;
const MAX_MESSAGE = 140;
const TOKEN_COOKIE = 'visitorToken';
const ONE_YEAR_MS = 1000 * 60 * 60 * 24 * 365;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// 訪問者ごとに匿名トークンを発行（自分の投稿だけ削除できるようにするため）
app.use((req, res, next) => {
  let token = req.cookies[TOKEN_COOKIE];
  if (!token || !/^[0-9a-f-]{36}$/.test(token)) {
    token = crypto.randomUUID();
    res.cookie(TOKEN_COOKIE, token, {
      maxAge: ONE_YEAR_MS,
      httpOnly: true,
      sameSite: 'lax',
    });
  }
  req.visitorToken = token;
  next();
});

function formatDate(isoString) {
  return new Date(isoString).toLocaleString('ja-JP', {
    timeZone: 'Asia/Tokyo',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

app.get('/', (req, res) => {
  // owner_token はビューに渡さず、本人かどうかのフラグだけ渡す
  const posts = db.listPosts().map((post) => ({
    id: post.id,
    name: post.name,
    message: post.message,
    likes: post.likes,
    createdAt: formatDate(post.created_at),
    isOwner: post.owner_token === req.visitorToken,
  }));
  res.render('index', {
    posts,
    error: req.query.error || null,
    MAX_NAME,
    MAX_MESSAGE,
  });
});

app.post('/posts', (req, res) => {
  const name = (req.body.name || '').trim().slice(0, MAX_NAME) || '匿名';
  const message = (req.body.message || '').trim();

  if (!message) {
    return res.redirect('/?error=' + encodeURIComponent('ひとことを入力してください'));
  }
  if (message.length > MAX_MESSAGE) {
    return res.redirect(
      '/?error=' + encodeURIComponent(`ひとことは${MAX_MESSAGE}文字以内で入力してください`)
    );
  }

  db.createPost(name, message, req.visitorToken);
  res.redirect('/');
});

app.post('/posts/:id/like', (req, res) => {
  const id = Number(req.params.id);
  if (Number.isInteger(id) && db.findPost(id)) {
    db.likePost(id);
  }
  res.redirect('/');
});

app.post('/posts/:id/delete', (req, res) => {
  const id = Number(req.params.id);
  if (Number.isInteger(id)) {
    db.deletePost(id, req.visitorToken); // 本人の投稿のみ削除される
  }
  res.redirect('/');
});

app.listen(PORT, () => {
  console.log(`ひとことボード started: http://localhost:${PORT}`);
});
