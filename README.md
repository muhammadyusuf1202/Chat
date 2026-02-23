# 💬 GlobalChat — Real-time Web Chat Platform

Facebook Messenger va Telegram uslubidagi professional global chat platformasi.

## 📁 Papka Strukturasi

```
globalchat/
├── backend/
│   ├── models/
│   │   ├── User.js          # Foydalanuvchi modeli (bcrypt hash)
│   │   └── Message.js       # Xabar modeli
│   ├── routes/
│   │   ├── auth.js          # Login, register, profile
│   │   ├── messages.js      # CRUD for messages
│   │   └── users.js         # Users list, avatar, admin
│   ├── middleware/
│   │   └── auth.js          # JWT verification middleware
│   ├── uploads/             # Avatar fayllar
│   ├── server.js            # Main server + Socket.io
│   ├── package.json
│   └── .env
└── frontend/
    ├── index.html           # Main HTML
    ├── css/
    │   └── style.css        # Dark/Light mode styles
    └── js/
        └── app.js           # Frontend JavaScript
```

## 🚀 Ishga Tushirish

### 1. MongoDB o'rnatish

**macOS:**
```bash
brew tap mongodb/brew
brew install mongodb-community
brew services start mongodb-community
```

**Ubuntu/Debian:**
```bash
sudo apt-get install -y mongodb
sudo systemctl start mongodb
```

**Windows:** https://www.mongodb.com/try/download/community dan yuklab o'rnating

### 2. Backend o'rnatish

```bash
cd globalchat/backend
npm install
```

### 3. .env konfiguratsiya

`backend/.env` faylini tahrirlang:
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/globalchat
JWT_SECRET=your_super_secret_key_here_change_this
CLIENT_URL=http://localhost:3000
```

### 4. Backend ishga tushirish

```bash
cd backend
npm start
# yoki dev mode uchun:
npx nodemon server.js
```

### 5. Frontend ishga tushirish

Frontend faqat static fayllar. Istalgan usulda serve qiling:

**Python bilan:**
```bash
cd frontend
python3 -m http.server 3000
```

**Node.js bilan:**
```bash
npx serve frontend -p 3000
```

**VSCode bilan:** Live Server extension orqali index.html ni oching

### 6. Brauzerda oching

```
http://localhost:3000
```

## 🔑 Admin Yaratish

MongoDB shell orqali:
```bash
mongosh globalchat
db.users.updateOne({username: "your_username"}, {$set: {isAdmin: true}})
```

## ✨ Funksiyalar

| Funksiya | Holat |
|----------|-------|
| Ro'yxatdan o'tish / Kirish | ✅ |
| JWT autentifikatsiya | ✅ |
| Real-time xabar | ✅ Socket.io |
| Online/Offline status | ✅ |
| Typing indicator | ✅ |
| Xabar tarjimasi | ✅ MyMemory API (bepul) |
| Profil rasm yuklash | ✅ |
| Dark / Light mode | ✅ |
| Xabar o'chirish | ✅ |
| Xabar tahrirlash | ✅ |
| Admin panel | ✅ |
| Emoji support | ✅ |
| Desktop notification | ✅ |
| Parol hash (bcrypt) | ✅ |
| XSS himoya | ✅ |
| Rate limiting | ✅ |

## 🌐 Tarjima API

Loyiha **MyMemory** bepul tarjima API dan foydalanadi (ro'yxatdan o'tmay, 1000 so'z/kun).
Ko'proq tarjima kerak bo'lsa, Google Cloud Translate API ulang va `server.js` dagi translate endpoint ni yangilang.

## 🔒 Xavfsizlik

- Parollar bcrypt bilan hash qilinadi
- JWT tokenlar 7 kun amal qiladi
- XSS himoya barcha xabarlarda
- Rate limiting: 10 ta login urinish / 15 daqiqa
- Helmet.js orqali HTTP headers himoyasi

