// Firebase SDKs desde CDN (compatible con GitHub Pages)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// 🔥 Config Firebase
const firebaseConfig = {
  apiKey: "AIzaSyDXxvBG0HuFIH5b8vpQkggtqJVJAQZca88",
  authDomain: "estacionamiento-kw.firebaseapp.com",
  databaseURL: "https://estacionamiento-kw-default-rtdb.firebaseio.com",
  projectId: "estacionamiento-kw",
  storageBucket: "estacionamiento-kw.firebasestorage.app",
  messagingSenderId: "474380177810",
  appId: "1:474380177810:web:9448efb41c8682e8a4714b"
};

// Init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// UI básica
document.body.innerHTML = `
  <h1>Estacionamiento KW</h1>

  <div id="login">
    <input id="email" type="email" placeholder="Email" /><br><br>
    <input id="password" type="password" placeholder="Contraseña" /><br><br>
    <button id="btnLogin">Ingresar</button>
  </div>

  <div id="panel" style="display:none">
    <p id="userInfo"></p>
    <button id="btnLogout">Cerrar sesión</button>
  </div>

  <p id="msg"></p>
`;

// Login
document.getElementById("btnLogin").onclick = async () => {
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  try {
    await signInWithEmailAndPassword(auth, email, password);
    document.getElementById("msg").innerText = "✅ Login correcto";
  } catch (e) {
    document.getElementById("msg").innerText = "❌ Error: " + e.message;
  }
};

// Logout
document.getElementById("btnLogout").onclick = async () => {
  await signOut(auth);
};

// Auth listener
onAuthStateChanged(auth, (user) => {
  if (user) {
    document.getElementById("login").style.display = "none";
    document.getElementById("panel").style.display = "block";
    document.getElementById("userInfo").innerText =
      `👤 Sesión activa: ${user.email}`;
  } else {
    document.getElementById("login").style.display = "block";
    document.getElementById("panel").style.display = "none";
  }
});

// Registrar Service Worker
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("./sw.js");
}
