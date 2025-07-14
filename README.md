# 💬 Web Chat - MIS Classroom Edition

Welcome to the **MIS Web Chat** — a fun, minimal, real-time group chat built for students at Moser!  
The goal is to provide an easy-to-use platform to chat, share files, and hang out online during school time (or breaks 😉).

---

## 🌐 Live URLs

- **Frontend (chat site):** [https://chat.master3d.net](https://chat.master3d.net)
- **Backend (API & WebSocket):** [https://server.master3d.net](https://server.master3d.net)

---

## 🛠 Features

### 👤 User System
- Join instantly by choosing a username — no passwords or accounts needed.
- Username is saved locally, so you only enter it once.

### 🗨 Real-time Chat
- Messages are instant via WebSocket.
- General room (everyone joins by default).
- Create/join custom group chats (3–8 character names).
- `/clear`, `/kick`, `/unkick` commands supported.
- Typing indicators show who's typing.

### 👥 Room Features
- Up to **25 users per group**.
- History is saved **only for groups**, not general.
- You can switch between rooms easily.

### 📁 File Uploads
- Upload files **(PDF, JPG, PNG, TXT, DOCX, ZIP)** to groups (no videos).
- Max size: 10MB (drops to 5MB when MongoDB is above 400MB used).
- Auto-deletes after 8 days.
- Downloads are limited to 3 times per file to save bandwidth.

### ⚙️ Settings Panel
- Change your username at any time.
- Toggle dark mode 🌙
- See a list of all rooms you’ve joined.

### 📱 Mobile Support
- Works well on iPads and iPhones (fully responsive).

---

## 📦 Tech Stack

| Part       | Technology                 |
|------------|----------------------------|
| Frontend   | React + TailwindCSS        |
| Backend    | Node.js + Express          |
| Chat       | Socket.io                  |
| File Store | MongoDB + GridFS           |
| Deployment| Netlify (Frontend) & Render (Backend) |

---

## 🧠 How It Works

- Backend exposes WebSocket for real-time chat.
- Each room tracks its own members.
- Messages in General auto-delete after 10s.
- Files are uploaded using `POST /upload` with metadata.
- Files are stored in GridFS and cleaned after 8 days by a cronjob.
- Client checks server status — shows “waking up…” if backend is sleeping.
- Frontend is fully dynamic — all UI is in React.

---

## ✉️ Contact Admin Page

If something doesn’t work or you got kicked unfairly, go to [`/admin.html`](https://chat.master3d.net/admin.html) and fill out the form.

---

Made with 💙 by Dario & ChatGPT – Team Master3D
