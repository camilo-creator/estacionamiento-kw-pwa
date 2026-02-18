// Firebase SDKs desde CDN (GitHub Pages compatible)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 🔧 TU CONFIG
const firebaseConfig = {
  apiKey: "AIzaSyDXxvBG0HuFIH5b8vpQkggtqJVJAQZca88",
  authDomain: "estacionamiento-kw.firebaseapp.com",
  databaseURL: "https://estacionamiento-kw-default-rtdb.firebaseio.com",
  projectId: "estacionamiento-kw",
  storageBucket: "estacionamiento-kw.firebasestorage.app",
  messagingSenderId: "474380177810",
  appId: "1:474380177810:web:9448efb41c8682e8a4714b",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Helpers
const todayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const normPlate = (s) =>
  (s || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");

const el = (id) => document.getElementById(id);

function baseStyles() {
  const style = document.createElement("style");
  style.textContent = `
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:16px;background:#f8fafc;color:#0f172a}
    h1{font-size:28px;margin:8px 0 6px}
    .sub{opacity:.75;margin:0 0 16px}
    .card{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:14px;margin:12px 0}
    label{display:block;font-size:12px;opacity:.75;margin:10px 0 6px}
    input,select{width:100%;padding:12px;border:1px solid #cbd5e1;border-radius:12px;font-size:16px}
    button{padding:12px 14px;border-radius:12px;border:1px solid #0f172a;background:#0f172a;color:#fff;font-size:15px}
    button.secondary{background:#fff;color:#0f172a}
    .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .btns{display:flex;gap:10px;flex-wrap:wrap;margin-top:10px}
    .ok{color:#16a34a;font-weight:600}
    .warn{color:#b45309;font-weight:600}
    .muted{opacity:.75}
    .pill{display:inline-block;padding:6px 10px;border:1px solid #cbd5e1;border-radius:999px;margin:6px 6px 0 0}
    a.wa{display:inline-block;margin-top:10px;text-decoration:none}
  `;
  document.head.appendChild(style);
}

function renderLogin() {
  document.body.innerHTML = `
    <h1>Estacionamiento KW</h1>
    <p class="sub">Inicia sesión para usar la app.</p>

    <div class="card">
      <label>Email</label>
      <input id="email" type="email" placeholder="tu@correo.cl" autocomplete="username" />

      <label>Contraseña</label>
      <input id="pass" type="password" placeholder="••••••••" autocomplete="current-password" />

      <div class="btns">
        <button id="btnLogin">Entrar</button>
      </div>

      <p id="loginMsg" class="muted" style="margin-top:10px;"></p>
    </div>
  `;

  el("btnLogin").onclick = async () => {
    el("loginMsg").textContent = "Entrando...";
    try {
      await signInWithEmailAndPassword(
        auth,
        el("email").value.trim(),
        el("pass").value
      );
    } catch (e) {
      el("loginMsg").textContent =
        "❌ No pude iniciar sesión (email/clave o Auth no habilitado).";
      console.error(e);
    }
  };
}

function whatsappLink(phone, msg) {
  let p = (phone || "").replace(/\D/g, "");
  if (p.startsWith("56")) {
    // ok
  } else if (p.length === 9 && p.startsWith("9")) {
    p = "56" + p;
  }
  const text = encodeURIComponent(msg || "");
  return `https://wa.me/${p}?text=${text}`;
}

// Busca perfil por patente dentro de users.plates (array-contains)
async function findUserByPlate(plate) {
  const qy = query(collection(db, "users"), where("plates", "array-contains", plate));
  const snap = await getDocs(qy);
  if (snap.empty) return null;

  const docu = snap.docs[0];
  return { id: docu.id, ...docu.data() };
}

async function renderApp(user) {
  const email = (user.email || "").toLowerCase();
  const uid = user.uid;
  const today = todayStr();

  // Perfil del usuario actual (doc id = email)
  let myProfile = null;
  try {
    const meRef = doc(db, "users", email);
    const meSnap = await getDoc(meRef);
    if (meSnap.exists()) myProfile = meSnap.data();
  } catch (e) {
    console.warn("No pude leer users/<email>", e);
  }

  document.body.innerHTML = `
    <h1>Estacionamiento KW</h1>
    <div class="muted">👤 Sesión activa: <b>${email}</b></div>

    <div class="btns" style="margin:10px 0 2px;">
      <button class="secondary" id="btnLogout">Cerrar sesión</button>
      <span class="ok" id="statusOk">✅ Login correcto</span>
    </div>

    <div class="card">
      <h3 style="margin:0 0 10px;">🔎 Buscar por patente</h3>
      <label>Patente</label>
      <input id="searchPlate" placeholder="Ej: KHDC46" />
      <div class="btns">
        <button id="btnSearch">Buscar</button>
      </div>
      <div id="searchRes" class="muted" style="margin-top:10px;"></div>
    </div>

    <div class="card">
      <h3 style="margin:0 0 10px;">📍 Check-in (hoy)</h3>
      <div class="row">
        <div>
          <label>Mi patente</label>
          <input id="myPlate" placeholder="Ej: KHDC46" value="${(myProfile?.plates?.[0] || "")}" />
        </div>
        <div>
          <label>Mi sector hoy</label>
          <input id="mysectorToday" placeholder="Ej: Dental" value="${(myProfile?.sector || "")}" />
        </div>
      </div>
      <div class="btns">
        <button id="btnCheckin">Hacer check-in</button>
      </div>
      <div id="checkinRes" class="muted" style="margin-top:10px;"></div>
    </div>

    <div class="card">
      <h3 style="margin:0 0 10px;">🚗 Estoy bloqueando (hoy)</h3>
      <div class="row">
        <div>
          <label>Mi patente (quien bloquea)</label>
          <input id="blockerPlate" placeholder="Ej: KHDC46" value="${(myProfile?.plates?.[0] || "")}" />
        </div>
        <div>
          <label>Patente bloqueada</label>
          <input id="blockedPlate" placeholder="Ej: ABCD12" />
        </div>
      </div>
      <div class="btns">
        <button id="btnAddBlock">Agregar bloqueo</button>
        <button class="secondary" id="btnListBlocks">Ver bloqueos de hoy</button>
      </div>
      <div id="blocksRes" class="muted" style="margin-top:10px;"></div>
    </div>
  `;

  el("btnLogout").onclick = () => signOut(auth);

  // Buscar patente
  el("btnSearch").onclick = async () => {
    const plate = normPlate(el("searchPlate").value);
    el("searchRes").textContent = "Buscando...";

    if (!plate) {
      el("searchRes").innerHTML = `<span class="warn">⚠️ Escribe una patente.</span>`;
      return;
    }

    try {
      const found = await findUserByPlate(plate);
      if (!found) {
        el("searchRes").innerHTML = `<span class="warn">⚠️ No encontré esa patente en users.</span>`;
        return;
      }

      const name = found.name || "(sin nombre)";
      const phone = found.phone || "(sin teléfono)";
      // ✅ ahora mostramos SECTOR (y por si acaso, si alguien tiene "unit" antiguo, lo usa igual)
      const sector = found.sector || found.unit || "(sin unidad)";

      const msg = `Hola ${name}. Te contacto por Estacionamiento KW: tu vehículo (${plate}) está bloqueando mi salida. ¿Puedes moverlo por favor? Gracias.`;
      const wa = String(phone).includes("sin") ? null : whatsappLink(phone, msg);

      el("searchRes").innerHTML = `
        <div><b>${name}</b></div>
        <div>📞 ${phone}</div>
        <div>🏥 ${sector}</div>
        <div class="muted" style="margin-top:6px;">Patentes registradas: ${(found.plates || []).map(p=>`<span class="pill">${p}</span>`).join("")}</div>
        ${
          wa
            ? `<a class="wa" href="${wa}" target="_blank"><button>📲 Enviar WhatsApp</button></a>`
            : `<div class="warn" style="margin-top:8px;">⚠️ No puedo armar WhatsApp si falta teléfono.</div>`
        }
      `;
    } catch (e) {
      console.error(e);
      el("searchRes").innerHTML = `<span class="warn">❌ Error buscando. Revisa Console.</span>`;
    }
  };

  // ✅ Check-in (GUARDA sectorToday)
  el("btnCheckin").onclick = async () => {
    const plate = normPlate(el("myPlate").value);
    const sectorToday = (el("mysectorToday").value || "").trim();

    el("checkinRes").textContent = "Guardando check-in...";
    if (!plate || !sectorToday) {
      el("checkinRes").innerHTML = `<span class="warn">⚠️ Falta patente o sector.</span>`;
      return;
    }

    try {
      const id = `${uid}_${today}`;
      await setDoc(
        doc(db, "checkins", id),
        {
          uid,
          email,
          plate,
          sectorToday, // ✅
          date: today,
          ts: serverTimestamp(),
        },
        { merge: true }
      );

      el("checkinRes").innerHTML = `<span class="ok">✅ Check-in OK: ${plate} · ${sectorToday}</span>`;
    } catch (e) {
      console.error(e);
      el("checkinRes").innerHTML = `<span class="warn">❌ No pude guardar check-in. Revisa Rules.</span>`;
    }
  };

  // Agregar bloqueo
  el("btnAddBlock").onclick = async () => {
    const blockerPlate = normPlate(el("blockerPlate").value);
    const blockedPlate = normPlate(el("blockedPlate").value);

    el("blocksRes").textContent = "Guardando bloqueo...";
    if (!blockerPlate || !blockedPlate) {
      el("blocksRes").innerHTML = `<span class="warn">⚠️ Falta mi patente o la bloqueada.</span>`;
      return;
    }

    try {
      await addDoc(collection(db, "blocks"), {
        blockerUid: uid,
        blockerEmail: email,
        blockerPlate,
        blockedPlate,
        date: today,
        ts: serverTimestamp(),
      });

      el("blocksRes").innerHTML = `<span class="ok">✅ Bloqueo agregado: ${blockerPlate} → ${blockedPlate}</span>`;
      el("blockedPlate").value = "";
    } catch (e) {
      console.error(e);
      el("blocksRes").innerHTML = `<span class="warn">❌ No pude guardar bloqueo. Revisa Rules.</span>`;
    }
  };

  // Ver bloqueos de hoy
  el("btnListBlocks").onclick = async () => {
    el("blocksRes").textContent = "Cargando bloqueos de hoy...";
    try {
      const qy = query(
        collection(db, "blocks"),
        where("blockerUid", "==", uid),
        where("date", "==", today)
      );
      const snap = await getDocs(qy);

      if (snap.empty) {
        el("blocksRes").innerHTML = `<span class="muted">No tienes bloqueos hoy.</span>`;
        return;
      }

      const items = snap.docs.map((d) => d.data());
      el("blocksRes").innerHTML = `
        <div class="muted">Bloqueos hoy (${today}):</div>
        ${items
          .map(
            (it) =>
              `<div class="pill">${it.blockerPlate} → <b>${it.blockedPlate}</b></div>`
          )
          .join("")}
        <div class="muted" style="margin-top:10px;">Tip: para avisar, usa “Buscar por patente” y manda WhatsApp.</div>
      `;
    } catch (e) {
      console.error(e);
      el("blocksRes").innerHTML = `<span class="warn">❌ Error listando bloqueos. Revisa Console.</span>`;
    }
  };
}

// Inicio
baseStyles();

onAuthStateChanged(auth, (user) => {
  if (user) renderApp(user);
  else renderLogin();
});