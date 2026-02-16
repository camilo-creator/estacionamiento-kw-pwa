// Firebase SDKs desde CDN (compatible con GitHub Pages)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Config Firebase
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
const db = getFirestore(app);

// Debug visual
document.body.insertAdjacentHTML(
  "beforeend",
  "<p style='color:green'>🔥 Firebase cargado correctamente</p>"
);

// Auth listener
onAuthStateChanged(auth, user => {
  if (user) {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<p>✅ Sesión activa: ${user.email}</p>`
    );
  } else {
    document.body.insertAdjacentHTML(
      "beforeend",
      "<p>ℹ️ No hay sesión activa</p>"
    );
  }
});
