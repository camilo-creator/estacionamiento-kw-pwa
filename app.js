// app.js — Estacionamiento CESFAM (GitHub Pages + Firebase CDN)
// ✅ Login + Wizard Registro (3 pasos) + Perfil en /users/{uid} (create-only)
// ✅ Si el email ya existe en Auth, al hacer login: si no hay perfil Firestore, obliga a completar registro
// ✅ Aprobación por dueño (OWNER_UIDS) => status/estado pasa a active/activo
// ✅ Búsqueda por patente + WhatsApp
// ✅ Check-in diario uid_YYYY-MM-DD
// ✅ Bloqueos + WhatsApp automático

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInAnonymously,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/** =========================
 *  CONFIG
 *  ========================= */
const firebaseConfig = {
  apiKey: "AIzaSyDXxvBG0HuFIH5b8vpQkggtqJVJAQZca88",
  authDomain: "estacionamiento-kw.firebaseapp.com",
  databaseURL: "https://estacionamiento-kw-default-rtdb.firebaseio.com",
  projectId: "estacionamiento-kw",
  storageBucket: "estacionamiento-kw.firebasestorage.app",
  messagingSenderId: "474380177810",
  appId: "1:474380177810:web:9448efb41c8682e8a4714b"
};

const OWNER_UIDS = ["hnRLNmTe5uguxYWFNufET3YnGQL2"];

const COL_USERS = "users";
const COL_USERS_GUEST = "users_guest"
const COL_CHECKINS = "checkins";
const COL_BLOCKS = "blocks";

/** =========================
 *  INIT
 *  ========================= */
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/** =========================
 *  HELPERS
 *  ========================= */
const el = (id) => document.getElementById(id);

const todayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const normEmail = (s) => String(s || "").trim().toLowerCase();

const normPlate = (s) =>
  String(s || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");

const escapeHtml = (s) =>
  String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const isOwner = (user) => !!user && OWNER_UIDS.includes(user.uid);

// compat status/estado
function isUserActive(u) {
  const s = String(u?.status || "").toLowerCase();
  const e = String(u?.estado || "").toLowerCase();
  return s === "active" || e === "activo";
}
function isUserPending(u) {
  const s = String(u?.status || "").toLowerCase();
  const e = String(u?.estado || "").toLowerCase();
  return s === "pending" || e === "pendiente";
}

function formatPhoneChile(phone) {
  let p = String(phone || "").replace(/\D/g, "");
  if (!p) return "";
  if (p.startsWith("56")) return p;
  if (p.length === 9 && p.startsWith("9")) return "56" + p;
  return p;
}
function formatGuestPhoneToE164CL(raw) {
  // El usuario escribe SOLO 9 dígitos (ej: 912345678)
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length !== 9) return null;
  // Chile móvil usual parte con 9
  if (!d.startsWith("9")) return null;
  return "+56" + d;
}

// ✅ Perfil invitado por UID (users_guest/{uid})
async function getGuestProfileByUid(uid) {
  if (!uid) return null;
  const ref = doc(db, COL_USERS_GUEST, uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

function guestPhoneToCL(raw) {
  // Usuario escribe SOLO 9 dígitos (ej: 912345678)
  const d = String(raw || "").replace(/\D/g, "");
  if (d.length !== 9) return null;
  if (!d.startsWith("9")) return null; // móvil típico
  return "+56" + d;
}
function whatsappLink(phone, msg) {
  const p = formatPhoneChile(phone);
  if (!p) return null;
  return `https://wa.me/${p}?text=${encodeURIComponent(msg || "")}`;
}

// Dropdown sectores
const SECTORES = [
  "Dirección",
  "Dental",
  "Farmacia",
  "Ambulancia",
  "UAC",
  "Sector Rojo",
  "Sector Amarillo",
  "Transversal",
  "Box Psicosocial",
  "Sala ERA",
  "Vacunatorio",
  "Telesalud",
  "Oirs/Sau",
  "Esterilización",
  "Bodega de Alimentos",
  "Bodega de Farmacia",
  "Dependencia Severa",
  "Sala de Psicomotricidad",
  "Sala de Estimulación DSM",
  "Apoyo Clínico",
  "Ex SIGGES"
];

/** =========================
 *  UI BASE (CSS)
 *  ========================= */
function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    :root{
      --bg:#eef2ff;
      --card:#ffffff;
      --ink:#0f172a;
      --muted:#475569;
      --line:#e2e8f0;
      --brand:#0f172a;
      --ok:#16a34a;
      --warn:#b45309;
      --soft:#f8fafc;
      --shadow: 0 10px 25px rgba(15,23,42,.08);
      --radius:18px;
    }
    *{box-sizing:border-box}
    body{
      margin:0;
      font-family: ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Arial;
      background: radial-gradient(1200px 600px at 50% -100px, #dbeafe, var(--bg));
      color:var(--ink);
    }
    .wrap{max-width:460px;margin:0 auto;padding:18px 16px 40px}
    .topbar{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}
    .pillUser{
      display:flex;align-items:center;gap:8px;
      padding:10px 12px;border:1px solid var(--line);background:#fff;border-radius:999px;
      box-shadow: 0 6px 16px rgba(15,23,42,.06);
      font-size:13px;color:var(--muted);
      overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px;
    }
    .btn{
      border:0;border-radius:14px;padding:13px 14px;
      background:linear-gradient(180deg,#111827,#0b1221);
      color:#fff;font-weight:700;font-size:15px;
      box-shadow: var(--shadow);
      cursor:pointer;
    }
    .btn:disabled{opacity:.6;cursor:not-allowed}
    .btn.secondary{
      background:#fff;color:var(--ink);
      border:1px solid var(--line);
      box-shadow:none;
    }
    .btn.link{
      background:transparent;border:0;color:#2563eb;
      padding:0;font-weight:600;box-shadow:none;
      cursor:pointer;
    }
    .hero{text-align:center;margin-top:6px}
    .logo{
      width:92px;height:92px;object-fit:contain;
      margin:6px auto 8px;display:block;
    }
    h1{margin:6px 0 0;font-size:34px;letter-spacing:-.5px}
    .subtitle{margin:4px 0 0;color:var(--muted);font-size:18px}
    .card{
      background:var(--card);
      border:1px solid var(--line);
      border-radius:var(--radius);
      box-shadow: var(--shadow);
      padding:16px;
      margin:14px 0;
    }
    .install{
      border:2px solid #bfe0ff;
      background:linear-gradient(180deg,#f0f9ff,#f8fafc);
      color:#0c4a6e;
      padding:16px;
      border-radius:16px;
      text-align:center;
      font-weight:700;
    }
    .install small{display:block;margin-top:6px;font-weight:600;color:#334155}
    .tabs{
      display:flex;gap:10px;background:#f1f5f9;border-radius:999px;padding:6px;margin-top:10px;
    }
    .tab{
      flex:1;border:0;border-radius:999px;padding:10px 12px;
      background:transparent;color:#334155;font-weight:800;cursor:pointer;
    }
    .tab.active{background:#fff;border:1px solid var(--line);color:#0f172a}
    label{display:block;margin:12px 0 6px;color:#334155;font-size:13px;font-weight:700}
    input,select{
      width:100%;
      padding:12px 12px;
      border-radius:14px;
      border:1px solid #cbd5e1;
      font-size:16px;
      background:#fff;
    }
    .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .muted{color:var(--muted)}
    .ok{color:var(--ok);font-weight:800}
    .warn{color:var(--warn);font-weight:800}
    .footer{margin-top:20px;text-align:center;color:#94a3b8;font-weight:700}
    .divider{height:1px;background:var(--line);margin:14px 0}
    .mini{
      font-size:12px;color:#64748b;margin-top:10px;
      display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;
    }
    .titleRow{display:flex;align-items:center;gap:10px;margin-bottom:4px}
    .titleRow h3{margin:0;font-size:18px}
    .pill{
      display:inline-block;border:1px solid var(--line);border-radius:999px;
      padding:6px 10px;margin:6px 6px 0 0;background:#fff;color:#0f172a;font-weight:800;
    }
    .badge{
      display:inline-flex;align-items:center;gap:8px;
      padding:10px 12px;border-radius:14px;border:1px solid var(--line);background:#fff;
      font-weight:800;color:#0f172a;
    }
    .badge.ok{border-color:#bbf7d0;background:#f0fdf4;color:#166534}
    .badge.warn{border-color:#fed7aa;background:#fff7ed;color:#9a3412}
    .wa button{
      width:100%;
      margin-top:12px;
      border:0;
      border-radius:14px;
      padding:13px 14px;
      background:linear-gradient(180deg,#16a34a,#15803d);
      color:#fff;
      font-weight:800;
      font-size:15px;
      cursor:pointer;
      box-shadow: var(--shadow);
    }
  `;
  document.head.appendChild(style);
}

/** =========================
 *  DATA ACCESS
 *  ========================= */

// ✅ Perfil del usuario actual (doc id = UID)
async function getMyProfileByUid(uid) {
  if (!uid) return null;
  const ref = doc(db, COL_USERS, uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

// Buscar usuario por patente (plates array-contains)
async function findUserByPlate(plate) {
  const qy = query(collection(db, COL_USERS), where("plates", "array-contains", plate));
  const snap = await getDocs(qy);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}
// Buscar VISITA por patente (users_guest.plates array-contains)
async function findGuestByPlate(plate) {
  const qy = query(collection(db, COL_USERS_GUEST), where("plates", "array-contains", plate));
  const snap = await getDocs(qy);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data(), __kind: "guest" };
}

// Checkin de hoy por uid
async function getTodayCheckinByUid(uid) {
  if (!uid) return null;
  const id = `${uid}_${todayStr()}`;
  const ref = doc(db, COL_CHECKINS, id);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

function renderLanding({ defaultTab = "login" } = {}) {
  document.body.innerHTML = `
    <div class="wrap">
      <div class="hero">
        <img class="logo" src="./logo-cesfam.png" alt="CESFAM" />
        <h1>Estacionamiento CESFAM</h1>
        <div class="subtitle">Karol Wojtyla - Puente Alto</div>
      </div>

      <div class="card">
        <div class="install">
          ¡Instala esta app!
          <small>Toca <b>Compartir</b> y luego "Agregar a pantalla de inicio"</small>
        </div>
      </div>

      <div class="card">
        <div class="titleRow">
          <div style="font-size:20px">👤</div>
          <h3>Acceso Personal CESFAM</h3>
        </div>

        <div class="tabs">
          <button id="tabLogin" class="tab ${defaultTab === "login" ? "active" : ""}">
            Iniciar Sesión
          </button>
          <button id="tabCreate" class="tab ${defaultTab === "create" ? "active" : ""}">
            Crear Cuenta
          </button>
        </div>

        <div id="panel"></div>

        <div class="mini">
          <button id="btnForgot" class="btn link">¿Olvidaste tu contraseña?</button>
          <button id="btnVisitor" class="btn link">👥 Entrar como visita</button>
        </div>

        <div id="msg" class="muted" style="margin-top:10px"></div>
      </div>

      <div class="footer">CESFAM Karol Wojtyla - Puente Alto, Chile</div>
    </div>
  `;

  /* ====== TABS ====== */

  // LOGIN → muestra login normal
  el("tabLogin").onclick = () => {
    el("tabLogin").classList.add("active");
    el("tabCreate").classList.remove("active");
    renderLanding({ defaultTab: "login" });
  };

  // CREAR CUENTA → VA DIRECTO AL FORMULARIO
  el("tabCreate").onclick = () => {
    renderRegisterWizard(); // 👈 directo al wizard
  };

  /* ====== PANEL ====== */
  const panel = el("panel");

  if (defaultTab === "login") {
    panel.innerHTML = `
      <label>Correo electrónico</label>
      <input id="email" type="email" placeholder="tu@email.cl" autocomplete="username" />

      <label>Contraseña</label>
      <input id="pass" type="password" placeholder="********" autocomplete="current-password" />

      <div style="margin-top:14px">
        <button id="btnLogin" class="btn" style="width:100%">Iniciar Sesión</button>
      </div>
    `;

    el("btnLogin").onclick = async () => {
      const email = normEmail(el("email").value);
      const pass = el("pass").value;
      el("msg").textContent = "Iniciando sesión…";
      try {
        await signInWithEmailAndPassword(auth, email, pass);
      } catch (e) {
        console.error(e);
        el("msg").innerHTML =
          `<span class="warn">❌ Email o contraseña incorrectos.</span>`;
      }
    };
  }

  /* ====== OTROS BOTONES ====== */

  el("btnForgot").onclick = () => renderForgotPassword();

  el("btnVisitor").onclick = () => renderGuestRegister();

  
}


function renderLoginPanelHtml() {
  return `
    <label>Correo electrónico</label>
    <input id="email" type="email" placeholder="tu@email.cl" autocomplete="username" />

    <label>Contraseña</label>
    <input id="pass" type="password" placeholder="********" autocomplete="current-password" />

    <div style="margin-top:14px">
      <button id="btnLogin" class="btn" style="width:100%">Iniciar Sesión</button>
    </div>
  `;
}

function renderCreatePanelHtml() {
  return `
    <div class="muted" style="margin-top:8px">
      Para crear cuenta como funcionario usa “Inscripción de Funcionario” (abajo).
    </div>
  `;
}

function wireLoginCreate(isLoginTab) {
  if (!isLoginTab) return;

  el("btnLogin").onclick = async () => {
    const email = normEmail(el("email").value);
    const pass = el("pass").value;
    el("msg").textContent = "Iniciando sesión…";

    try {
      await signInWithEmailAndPassword(auth, email, pass);

      // ✅ Si Auth existe pero NO hay perfil /users/{uid} => obliga a completar registro
      const u = auth.currentUser;
      if (u && !u.isAnonymous) {
        const prof = await getMyProfileByUid(u.uid);
        if (!prof) {
          renderRegisterWizard({
            step: 2,         // saltamos a datos personales
            email,
            pass,
            name: u.displayName || "",
            plates: [""]
          });
        }
      }
    } catch (e) {
      console.error(e);
      el("msg").innerHTML = `<span class="warn">❌ Email/clave incorrectos o Auth no habilitado.</span>`;
    }
  };
}

function renderForgotPassword() {
  document.body.innerHTML = `
    <div class="wrap">
      <div class="card">
        <div class="titleRow"><div style="font-size:20px">🔐</div><h3>Recuperar contraseña</h3></div>
        <div class="muted">Te enviaremos un correo para restablecer tu clave.</div>

        <label>Correo</label>
        <input id="fpEmail" type="email" placeholder="tu@email.cl" />

        <div style="margin-top:14px" class="row">
          <button id="btnBack" class="btn secondary">Volver</button>
          <button id="btnSend" class="btn">Enviar</button>
        </div>

        <div id="fpMsg" class="muted" style="margin-top:10px"></div>
      </div>
    </div>
  `;
  el("btnBack").onclick = () => renderLanding({ defaultTab: "login" });
  el("btnSend").onclick = async () => {
    const email = normEmail(el("fpEmail").value);
    el("fpMsg").textContent = "Enviando…";
    try {
      await sendPasswordResetEmail(auth, email);
      el("fpMsg").innerHTML = `<span class="ok">✅ Listo. Revisa tu correo.</span>`;
    } catch (e) {
      console.error(e);
      el("fpMsg").innerHTML = `<span class="warn">❌ No pude enviar. Revisa el correo o Auth.</span>`;
    }
  };
}

/** =========================
 *  REGISTRO (wizard 3 pasos)
 *  ========================= */
function renderRegisterWizard(state = { step: 1, plates: [""] }) {
  const step = state.step;

  const step1 = `
    <div class="titleRow"><div style="font-size:20px">🛡️</div><h3>Registro Seguro</h3></div>
    <div style="font-weight:900;font-size:20px;margin-top:8px">Inscripción de Funcionario</div>
    <div class="muted">Paso 1 de 3: Cuenta de acceso</div>

    <label>Correo electrónico</label>
    <input id="rEmail" type="email" placeholder="tu@gmail.com, tu@hotmail.com, etc." value="${escapeHtml(state.email || "")}" />

    <label>Contraseña</label>
    <input id="rPass" type="password" placeholder="Mínimo 8 caracteres" />

    <label>Confirmar contraseña</label>
    <input id="rPass2" type="password" placeholder="Repite tu contraseña" />

    <div class="row" style="margin-top:14px">
      <button id="btnBack" class="btn secondary">Volver</button>
      <button id="btnNext" class="btn">Siguiente</button>
    </div>

    <div id="rMsg" class="muted" style="margin-top:10px"></div>
  `;

  const step2 = `
    <div class="titleRow"><div style="font-size:20px">🛡️</div><h3>Registro Seguro</h3></div>
    <div style="font-weight:900;font-size:20px;margin-top:8px">Inscripción de Funcionario</div>
    <div class="muted">Paso 2 de 3: Datos personales</div>

    <label>Nombre completo</label>
    <input id="rName" placeholder="Ej: María González Pérez" value="${escapeHtml(state.name || "")}" />

    <label>RUT</label>
    <input id="rRut" placeholder="Ej: 12345678-9" value="${escapeHtml(state.rut || "")}" />
    <div class="muted" style="font-size:12px;margin-top:6px">Ingresa RUT sin puntos ni guión</div>

    <label>Teléfono</label>
    <input id="rPhone" placeholder="Ej: 912345678" value="${escapeHtml(state.phone || "")}" />

    <div class="row" style="margin-top:14px">
      <button id="btnPrev" class="btn secondary">Anterior</button>
      <button id="btnNext" class="btn">Siguiente</button>
    </div>

    <div id="rMsg" class="muted" style="margin-top:10px"></div>
  `;

  const platesHtml = (state.plates || [""]).map(
    (p, idx) => `
      <label>${idx === 0 ? "Patente(s) de tu(s) vehículo(s)" : "Patente adicional"}</label>
      <input class="plateInput" data-i="${idx}" placeholder="Ej: ABCD12" value="${escapeHtml(p)}" />
    `
  ).join("");

  const options = SECTORES
    .map(s => `<option value="${escapeHtml(s)}" ${state.sector === s ? "selected" : ""}>${escapeHtml(s)}</option>`)
    .join("");

  const step3 = `
    <div class="titleRow"><div style="font-size:20px">🛡️</div><h3>Registro Seguro</h3></div>
    <div style="font-weight:900;font-size:20px;margin-top:8px">Inscripción de Funcionario</div>
    <div class="muted">Paso 3 de 3: Información de vehículos</div>

    ${platesHtml}

    <button id="btnAddPlate" class="btn secondary" style="width:100%;margin-top:10px">＋ Agregar otra patente</button>

    <label style="margin-top:14px">Unidad/Sector donde trabaja</label>
    <select id="rSector">
      <option value="">Selecciona tu unidad</option>
      ${options}
    </select>

    <label style="margin-top:14px;display:flex;gap:10px;align-items:flex-start">
      <input id="rTerms" type="checkbox" style="width:auto;margin-top:3px" ${state.terms ? "checked" : ""}/>
      <span>
        Acepto los <a href="#" id="termsLink">Términos y Condiciones</a><br/>
        <span class="muted" style="font-size:12px">Conforme a la Ley 19.628 sobre protección de la vida privada</span>
      </span>
    </label>

    <div class="row" style="margin-top:14px">
      <button id="btnPrev" class="btn secondary">Anterior</button>
      <button id="btnFinish" class="btn">Completar Registro</button>
    </div>

    <div style="margin-top:16px">
      <button id="btnHome" class="btn link">← Volver al inicio</button>
    </div>

    <div id="rMsg" class="muted" style="margin-top:10px"></div>
  `;

  document.body.innerHTML = `
    <div class="wrap">
      <div class="hero">
        <img class="logo" src="./logo-cesfam.png" alt="CESFAM" />
        <h1 style="font-size:28px">Completa tu Registro</h1>
        <div class="subtitle" style="font-size:16px">Ingresa tus datos de funcionario</div>
      </div>

      <div class="card">
        ${step === 1 ? step1 : step === 2 ? step2 : step3}
      </div>
    </div>
  `;

  // Paso 1
  if (step === 1) {
    el("btnBack").onclick = () => renderLanding({ defaultTab: "login" });
    el("btnNext").onclick = () => {
      const email = normEmail(el("rEmail").value);
      const pass = el("rPass").value;
      const pass2 = el("rPass2").value;

      if (!email) return (el("rMsg").innerHTML = `<span class="warn">⚠️ Falta correo.</span>`);
      if (!pass || pass.length < 8) return (el("rMsg").innerHTML = `<span class="warn">⚠️ Clave mínimo 8 caracteres.</span>`);
      if (pass !== pass2) return (el("rMsg").innerHTML = `<span class="warn">⚠️ Las claves no coinciden.</span>`);

      renderRegisterWizard({ ...state, step: 2, email, pass });
    };
  }

  // Paso 2
  if (step === 2) {
    el("btnPrev").onclick = () => renderRegisterWizard({ ...state, step: 1 });
    el("btnNext").onclick = () => {
      const name = String(el("rName").value || "").trim();
      const rut = String(el("rRut").value || "").trim();
      const phone = String(el("rPhone").value || "").trim();
      if (!name) return (el("rMsg").innerHTML = `<span class="warn">⚠️ Falta nombre.</span>`);
      renderRegisterWizard({ ...state, step: 3, name, rut, phone });
    };
  }

  // Paso 3
  if (step === 3) {
    el("btnHome").onclick = () => renderLanding({ defaultTab: "login" });

    el("btnAddPlate").onclick = () => {
      const plates = readPlatesFromInputs();
      plates.push("");
      renderRegisterWizard({ ...state, plates });
    };

    el("termsLink").onclick = (ev) => {
      ev.preventDefault();
      alert("Términos y Condiciones: enlaza a un PDF o página oficial cuando lo tengas.");
    };

    el("btnPrev").onclick = () => renderRegisterWizard({ ...state, step: 2 });

    // ✅ FINISH: crea Auth solo si NO estás logueado; crea doc /users/{uid} (sin merge) + error real
    el("btnFinish").onclick = async () => {
      const plates = readPlatesFromInputs().map(normPlate).filter(Boolean);
      const sector = String(el("rSector").value || "").trim();
      const terms = !!el("rTerms").checked;

      if (!plates.length) return (el("rMsg").innerHTML = `<span class="warn">⚠️ Agrega al menos 1 patente.</span>`);
      if (!sector) return (el("rMsg").innerHTML = `<span class="warn">⚠️ Selecciona tu unidad/sector.</span>`);
      if (!terms) return (el("rMsg").innerHTML = `<span class="warn">⚠️ Debes aceptar los términos.</span>`);

      el("rMsg").textContent = "Creando cuenta / perfil…";

      try {
        const email = state.email;
        const pass = state.pass;

        // 1) Si ya estoy logueado (vengo desde login), NO creo Auth
        let user = auth.currentUser;

        // Si no estoy logueado, creo Auth
        if (!user) {
          const cred = await createUserWithEmailAndPassword(auth, email, pass);
          user = cred.user;
          try { await updateProfile(user, { displayName: state.name }); } catch {}
        }

        // 2) Crear perfil Firestore (docId = uid) — create-only (Rules)
        const profile = {
          uid: user.uid,
          email: normEmail(email),
          username: state.name?.split(" ")[0] || "",
          name: state.name || "",
          rut: state.rut || "",
          phone: state.phone || "",
          plates,
          sector,
          unit: sector, // compat
          status: "pending",
          estado: "pendiente",
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          source: "self_register"
        };

        await setDoc(doc(db, COL_USERS, user.uid), profile); // ✅ sin merge

        el("rMsg").innerHTML = `<span class="ok">✅ Registro completado. Quedas pendiente de autorización del dueño.</span>`;
      } catch (e) {
        console.error(e);
        const code = e?.code || "";
        const msg = e?.message || "";

        let nice = "❌ No pude crear la cuenta / perfil.";
        if (code === "auth/email-already-in-use") nice = "❌ Ese correo ya existe. Usa 'Iniciar sesión' o 'Olvidé mi contraseña'.";
        else if (code === "auth/weak-password") nice = "❌ Contraseña muy débil. Usa mínimo 8 caracteres (ideal: letras + números).";
        else if (code === "auth/invalid-email") nice = "❌ Correo inválido. Revisa el formato.";
        else if (code === "auth/operation-not-allowed") nice = "❌ Email/Password no está habilitado en Firebase Auth.";
        else if (code === "auth/unauthorized-domain") nice = "❌ Dominio no autorizado. Agrega camilo-creator.github.io en Authorized domains.";

        el("rMsg").innerHTML =
          `<span class="warn">${nice}</span>` +
          `<div class="muted" style="margin-top:6px;font-size:12px">${escapeHtml(code)}<br>${escapeHtml(msg)}</div>`;
      }
    };

    function readPlatesFromInputs() {
      const nodes = document.querySelectorAll(".plateInput");
      const arr = [];
      nodes.forEach((n) => arr.push(n.value));
      return arr;
    }
  }
}
function renderGuestRegister(state = {}) {
  const options = SECTORES.map(s => `<option value="${escapeHtml(s)}" ${state.sector === s ? "selected" : ""}>${escapeHtml(s)}</option>`).join("");

  document.body.innerHTML = `
    <div class="wrap">
      <div class="hero">
        <img class="logo" src="./logo-cesfam.png" alt="CESFAM" />
        <h1 style="font-size:28px">Registro de Visita</h1>
        <div class="subtitle" style="font-size:16px">Estacionamiento CESFAM KW</div>
      </div>

      <div class="card">
        <div class="titleRow"><div style="font-size:20px">👥</div><h3>Visitante</h3></div>
        <div class="muted">Completa estos datos para registrar tu presencia.</div>

        <label>Nombre</label>
        <input id="gName" placeholder="Ej: Juan Pérez" value="${escapeHtml(state.name || "")}" />

        <label>Teléfono (9 dígitos, sin +56)</label>
        <input id="gPhone" inputmode="numeric" placeholder="Ej: 912345678" value="${escapeHtml(state.phone || "")}" />
        <div class="muted" style="font-size:12px;margin-top:6px">Se guardará como <b>+56XXXXXXXXX</b>.</div>

        <label>Patente</label>
        <input id="gPlate" placeholder="Ej: ABCD12" value="${escapeHtml(state.plate || "")}" />

        <label>Sector / Unidad</label>
        <select id="gSector">
          <option value="">Selecciona tu unidad</option>
          ${options}
        </select>

        <div class="row" style="margin-top:14px">
          <button id="gBack" class="btn secondary">Volver</button>
          <button id="gSave" class="btn">Registrar visita</button>
        </div>

        <div id="gMsg" class="muted" style="margin-top:10px"></div>
      </div>

      <div class="footer">CESFAM Karol Wojtyla - Puente Alto, Chile</div>
    </div>
  `;

  el("gBack").onclick = () => renderLanding({ defaultTab: "login" });

  el("gSave").onclick = async () => {
    const name = String(el("gName").value || "").trim();
    const numero = guestPhoneToCL(el("gPhone").value);
    const plate = normPlate(el("gPlate").value);
    const sector = String(el("gSector").value || "").trim();
    const out = el("gMsg");

    if (!name) return (out.innerHTML = `<span class="warn">⚠️ Falta nombre.</span>`);
    if (!numero) return (out.innerHTML = `<span class="warn">⚠️ Teléfono inválido. Debe ser 9 dígitos y comenzar con 9.</span>`);
    if (!plate) return (out.innerHTML = `<span class="warn">⚠️ Falta patente.</span>`);
    if (!sector) return (out.innerHTML = `<span class="warn">⚠️ Selecciona un sector.</span>`);

    out.textContent = "Registrando…";
    el("gSave").disabled = true;

    try {
      const docId = `GUEST_${Date.now()}_${Math.random().toString(16).slice(2)}`;

      await setDoc(doc(db, COL_USERS_GUEST, docId), {
        name,
        numero,          // ✅ +56XXXXXXXXX
        plates: [plate], // ✅ array
        sector,
        createdAt: serverTimestamp()
      });

      // ✅ Mensaje + volver al inicio
      out.innerHTML = `<span class="ok">✅ Visitante registrado</span>`;
      setTimeout(() => renderLanding({ defaultTab: "login" }), 1200);
    } catch (e) {
      console.error(e);
      el("gSave").disabled = false;

      const code = e?.code || "";
      const msg = e?.message || "";
      out.innerHTML =
        `<span class="warn">❌ No pude registrar la visita.</span>` +
        `<div class="muted" style="margin-top:6px;font-size:12px">${escapeHtml(code)}<br>${escapeHtml(msg)}</div>`;
    }
  };
}

/** =========================
 *  APP (logged-in)
 *  ========================= */
async function renderApp(user) {
  const email = normEmail(user.email || "");
  const uid = user.uid;

  // Perfil
  const myProfile = user.isAnonymous
  ? await getGuestProfileByUid(uid) // ✅ visita desde users_guest
  : await getMyProfileByUid(uid);   // ✅ funcionario desde users

  const mySector = myProfile?.sector || myProfile?.unit || "";
  const myPlates = Array.isArray(myProfile?.plates) ? myProfile.plates : [];

  document.body.innerHTML = `
    <div class="wrap">
      <div class="topbar">
        <div class="pillUser">👤 ${escapeHtml(user.isAnonymous ? "Visita" : email)}</div>
        <button id="btnLogout" class="btn secondary">Cerrar sesión</button>
      </div>

      <div class="hero" style="margin-top:0">
        <img class="logo" src="./logo-cesfam.png" alt="CESFAM" />
        <h1>Estacionamiento<br/>CESFAM</h1>
        <div class="subtitle">Karol Wojtyla - Puente Alto</div>
      </div>

      ${isOwner(user) ? `
      <div class="card">
        <div class="titleRow"><div style="font-size:20px">🛠️</div><h3>Admin (Dueño)</h3></div>
        <div class="muted">UID: <b>${escapeHtml(uid)}</b></div>
        <div style="margin-top:12px">
          <button id="btnPending" class="btn" style="width:100%">Ver pendientes de autorización</button>
        </div>
        <div id="pendingRes" style="margin-top:10px"></div>
      </div>
      ` : ""}

      <div class="card">
        <div class="titleRow"><div style="font-size:20px">🔎</div><h3>Buscar por patente</h3></div>

        <label>Patente</label>
        <input id="searchPlate" placeholder="Ej: KHDC46" />

        <div style="margin-top:12px">
          <button id="btnSearch" class="btn" style="width:100%">Buscar</button>
        </div>

        <div id="searchRes" style="margin-top:12px"></div>
      </div>

      <div class="card">
        <div class="titleRow"><div style="font-size:20px">📍</div><h3>Check-in (hoy)</h3></div>

        <div class="row">
          <div>
            <label>Mi patente</label>
            <input id="myPlate" placeholder="Ej: KHDC46" value="${escapeHtml(myPlates[0] || "")}" />
          </div>
          <div>
            <label>Mi sector hoy</label>
            <input id="mySectorToday" placeholder="Ej: Dental" value="${escapeHtml(mySector || "")}" />
          </div>
        </div>

        <div style="margin-top:12px">
          <button id="btnCheckin" class="btn" style="width:100%">Hacer check-in</button>
        </div>

        <div id="checkinRes" style="margin-top:10px"></div>
      </div>

      <div class="card">
        <div class="titleRow"><div style="font-size:20px">🚗</div><h3>Estoy bloqueando (hoy)</h3></div>

        <div class="row">
          <div>
            <label>Mi patente (quien bloquea)</label>
            <input id="blockerPlate" placeholder="Ej: KHDC46" value="${escapeHtml(myPlates[0] || "")}" />
          </div>
          <div>
            <label>Patente bloqueada</label>
            <input id="blockedPlate" placeholder="Ej: ABCD12" />
          </div>
        </div>

        <div class="row" style="margin-top:12px">
          <button id="btnAddBlock" class="btn">Agregar</button>
          <button id="btnListBlocks" class="btn secondary">Ver hoy</button>
        </div>

        <div id="blocksRes" style="margin-top:10px"></div>
      </div>

      <div class="footer">CESFAM Karol Wojtyla - Puente Alto, Chile</div>
    </div>
  `;

  el("btnLogout").onclick = () => signOut(auth);

  // Admin pendientes
  if (isOwner(user)) {
    el("btnPending").onclick = async () => {
      const out = el("pendingRes");
      out.innerHTML = `<div class="muted">Cargando…</div>`;
      try {
        const qy1 = query(collection(db, COL_USERS), where("status", "==", "pending"));
        const s1 = await getDocs(qy1);

        const qy2 = query(collection(db, COL_USERS), where("estado", "==", "pendiente"));
        const s2 = await getDocs(qy2);

        const map = new Map();
        s1.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));
        s2.forEach(d => map.set(d.id, { id: d.id, ...d.data() }));

        const list = [...map.values()].filter(u => isUserPending(u));

        if (!list.length) {
          out.innerHTML = `<div class="badge ok">✅ No hay usuarios pendientes.</div>`;
          return;
        }

        out.innerHTML = `
          <div class="muted" style="margin-bottom:8px">Pendientes (${list.length})</div>
          ${list.map(u => `
            <div class="card" style="box-shadow:none;margin:10px 0">
              <div style="font-weight:900">${escapeHtml(u.name || "(sin nombre)")}</div>
              <div class="muted">${escapeHtml(u.email || u.id)}</div>
              <div class="muted">🏥 ${escapeHtml(u.sector || u.unit || "(sin sector)")}</div>
              <div class="muted">🚗 ${(u.plates || []).map(p=>`<span class="pill">${escapeHtml(p)}</span>`).join("")}</div>
              <button class="btn" data-approve="${escapeHtml(u.id)}" style="width:100%;margin-top:10px">
                Aprobar
              </button>
            </div>
          `).join("")}
        `;

        document.querySelectorAll("[data-approve]").forEach(btn => {
          btn.onclick = async () => {
            const id = btn.getAttribute("data-approve");
            btn.disabled = true;
            btn.textContent = "Aprobando…";
            try {
              await updateDoc(doc(db, COL_USERS, id), {
                status: "active",
                estado: "activo",
                updatedAt: serverTimestamp(),
                approvedBy: uid,
                approvedAt: serverTimestamp()
              });
              btn.textContent = "✅ Aprobado";
            } catch (e) {
              console.error(e);
              btn.disabled = false;
              btn.textContent = "❌ Error (revisa Rules)";
            }
          };
        });
      } catch (e) {
        console.error(e);
        out.innerHTML = `<div class="badge warn">❌ Error cargando (Rules).</div>`;
      }
    };
  }

  // Buscar patente
  el("btnSearch").onclick = async () => {
    const plate = normPlate(el("searchPlate").value);
    const out = el("searchRes");
  
    if (!plate) {
      out.innerHTML = `<div class="badge warn">⚠️ Escribe una patente.</div>`;
      return;
    }
  
    out.innerHTML = `<div class="muted">Buscando…</div>`;
  
    try {
      // 1) Buscar en FUNCIONARIOS (users)
      let found = await findUserByPlate(plate);
  
      // Si existe pero no está activo => lo ignoramos y buscamos en visitas
      if (found && !isUserActive(found)) found = null;
  
      // 2) Si no hay funcionario activo, buscar en VISITAS (users_guest)
      let guest = null;
      if (!found) {
        // Requiere que tengas: const COL_USERS_GUEST = "users_guest";
        // y que exista la colección en Firestore
        const qg = query(collection(db, COL_USERS_GUEST), where("plates", "array-contains", plate));
        const sg = await getDocs(qg);
        if (!sg.empty) {
          const d = sg.docs[0];
          guest = { id: d.id, ...d.data() };
        }
      }
  
      // 3) Si no existe en ninguno
      if (!found && !guest) {
        out.innerHTML = `<div class="badge warn">⚠️ No encontré esa patente.</div>`;
        return;
      }
  
      // ===========================
      // ✅ Render FUNCIONARIO (users)
      // ===========================
      if (found) {
        const name = found.name || "(sin nombre)";
        const phone = found.phone || "";
        const habitual = found.sector || found.unit || "(sin sector)";
        const plates = Array.isArray(found.plates) ? found.plates : [];
        const foundUid = found.uid || null;
  
        let todayCI = null;
        if (foundUid) todayCI = await getTodayCheckinByUid(foundUid);
  
        const sectorHoy = (todayCI?.sectorToday || todayCI?.unitToday || "").trim();
        const showHoy = sectorHoy && sectorHoy.toLowerCase() !== String(habitual).toLowerCase();
  
        const msg = `Hola ${name}. Te contacto por la app Estacionamiento CESFAM: tu vehículo (${plate}) está bloqueando mi salida. ¿Puedes moverlo por favor? Gracias.`;
        const wa = whatsappLink(phone, msg);
  
        out.innerHTML = `
          <div style="font-weight:900;font-size:20px">${escapeHtml(name)}</div>
          <div class="muted" style="margin-top:4px">📞 ${escapeHtml(phone || "(sin teléfono)")}</div>
  
          <div class="muted" style="margin-top:4px">
            🏥 Habitual: <b>${escapeHtml(habitual)}</b>
          </div>
  
          ${
            showHoy
              ? `<div class="badge warn" style="margin-top:10px">📍 Hoy hizo check-in en: <b>${escapeHtml(sectorHoy)}</b></div>`
              : sectorHoy
                ? `<div class="badge ok" style="margin-top:10px">📍 Hoy hizo check-in en: <b>${escapeHtml(sectorHoy)}</b></div>`
                : `<div class="badge" style="margin-top:10px">📍 Hoy: sin check-in</div>`
          }
  
          <div class="muted" style="margin-top:10px">
            Patentes registradas:
            <div>${plates.map(p => `<span class="pill">${escapeHtml(p)}</span>`).join("")}</div>
          </div>
  
          ${
            wa
              ? `<a href="${wa}" target="_blank" style="text-decoration:none">
                   <button class="btn" style="width:100%;margin-top:12px">📲 Enviar WhatsApp</button>
                 </a>`
              : `<div class="badge warn" style="margin-top:12px">⚠️ No puedo armar WhatsApp: falta teléfono.</div>`
          }
        `;
        return;
      }
  
      // ===========================
      // 👥 Render VISITA (users_guest)
      // ===========================
      const gName = guest?.name || "(sin nombre)";
      const gNumero = guest?.numero || "";   // +56XXXXXXXXX
      const gSector = guest?.sector || "(sin sector)";
      const gPlates = Array.isArray(guest?.plates) ? guest.plates : [];
  
      out.innerHTML = `
        <div class="badge ok">👥 Patente encontrada en <b>Visitas</b></div>
  
        <div style="font-weight:900;font-size:20px;margin-top:10px">${escapeHtml(gName)}</div>
        <div class="muted" style="margin-top:4px">📞 ${escapeHtml(gNumero || "(sin teléfono)")}</div>
        <div class="muted" style="margin-top:4px">🏥 Sector: <b>${escapeHtml(gSector)}</b></div>
  
        <div class="muted" style="margin-top:10px">
          Patentes registradas:
          <div>${gPlates.map(p => `<span class="pill">${escapeHtml(p)}</span>`).join("")}</div>
        </div>
  
      `;
    } catch (e) {
      console.error(e);
      out.innerHTML = `<div class="badge warn">❌ Error buscando (revisa Console/Rules).</div>`;
    }
  };
  

  // Check-in hoy
  el("btnCheckin").onclick = async () => {
    const plate = normPlate(el("myPlate").value);
    const sectorToday = String(el("mySectorToday").value || "").trim();
    const out = el("checkinRes");

    if (!plate || !sectorToday) {
      out.innerHTML = `<div class="badge warn">⚠️ Falta patente o sector.</div>`;
      return;
    }

    out.innerHTML = `<div class="muted">Guardando…</div>`;

    try {
      const id = `${uid}_${todayStr()}`;
      await setDoc(
        doc(db, COL_CHECKINS, id),
        {
          uid,
          email,
          plate,
          date: todayStr(),
          sectorToday,
          unitToday: sectorToday,
          ts: serverTimestamp()
        },
        { merge: true }
      );

      out.innerHTML = `<div class="badge ok">✅ Check-in OK: <b>${escapeHtml(plate)}</b> · <b>${escapeHtml(sectorToday)}</b></div>`;
    } catch (e) {
      console.error(e);
      out.innerHTML = `<div class="badge warn">❌ No pude guardar check-in (Rules).</div>`;
    }
  };

  // Bloqueo + WhatsApp
  el("btnAddBlock").onclick = async () => {
    const blockerPlate = normPlate(el("blockerPlate").value);
    const blockedPlate = normPlate(el("blockedPlate").value);
    const out = el("blocksRes");

    if (!blockerPlate || !blockedPlate) {
      out.innerHTML = `<div class="badge warn">⚠️ Falta mi patente o la bloqueada.</div>`;
      return;
    }

    out.innerHTML = `<div class="muted">Guardando…</div>`;

    try {
      await addDoc(collection(db, COL_BLOCKS), {
        blockerUid: uid,
        blockerEmail: email,
        blockerPlate,
        blockedPlate,
        date: todayStr(),
        ts: serverTimestamp()
      });

      const qy = query(collection(db, COL_USERS), where("plates", "array-contains", blockedPlate));
      const snap = await getDocs(qy);

      if (snap.empty) {
        out.innerHTML = `
          <div class="badge ok">✅ Bloqueo agregado: ${escapeHtml(blockerPlate)} → <b>${escapeHtml(blockedPlate)}</b></div>
          <div class="badge warn" style="margin-top:8px;">⚠️ No encontré a quién pertenece ${escapeHtml(blockedPlate)}.</div>
        `;
        el("blockedPlate").value = "";
        return;
      }

      const target = snap.docs[0].data();
      const name = target.name || "hola";
      const phone = target.phone || "";
      const sector = target.sector || target.unit || "";

      const msg = `Hola ${name}. Soy Camilin. Te contacto por la app Estacionamiento KW: estoy bloqueando tu vehículo (${blockedPlate}). Contáctame si necesitas salir.`;
      const wa = whatsappLink(phone, msg);

      if (!wa) {
        out.innerHTML = `
          <div class="badge ok">✅ Bloqueo agregado: ${escapeHtml(blockerPlate)} → <b>${escapeHtml(blockedPlate)}</b></div>
          <div style="margin-top:10px;">
            <div><b>${escapeHtml(target.name || "(sin nombre)")}</b></div>
            <div>📞 ${escapeHtml(String(phone || "(sin teléfono)"))}</div>
            <div>🏥 ${escapeHtml(String(sector || "(sin sector)"))}</div>
            <div class="badge warn" style="margin-top:8px;">⚠️ No puedo abrir WhatsApp (teléfono inválido).</div>
          </div>
        `;
        el("blockedPlate").value = "";
        return;
      }

      out.innerHTML = `
        <div class="badge ok">✅ Bloqueo agregado: ${escapeHtml(blockerPlate)} → <b>${escapeHtml(blockedPlate)}</b></div>
        <div style="margin-top:10px;">
          <div><b>${escapeHtml(target.name || "(sin nombre)")}</b></div>
          <div>📞 ${escapeHtml(String(phone))}</div>
          <div>🏥 ${escapeHtml(String(sector || "(sin sector)"))}</div>
          <a class="wa" href="${wa}" target="_blank" rel="noopener">
            <button>📲 Enviar WhatsApp ahora</button>
          </a>
        </div>
      `;

      window.open(wa, "_blank");
      el("blockedPlate").value = "";
    } catch (e) {
      console.error(e);
      out.innerHTML = `<div class="badge warn">❌ No pude guardar bloqueo (Rules).</div>`;
    }
  };

  // Ver bloqueos hoy
  el("btnListBlocks").onclick = async () => {
    const out = el("blocksRes");
    out.innerHTML = `<div class="muted">Cargando…</div>`;
    try {
      const qy = query(
        collection(db, COL_BLOCKS),
        where("blockerUid", "==", uid),
        where("date", "==", todayStr())
      );
      const snap = await getDocs(qy);

      if (snap.empty) {
        out.innerHTML = `<div class="muted">No tienes bloqueos hoy.</div>`;
        return;
      }

      const items = snap.docs.map((d) => d.data());
      out.innerHTML = `
        <div class="muted">Bloqueos hoy (${todayStr()}):</div>
        ${items.map(it => `<div class="pill">${escapeHtml(it.blockerPlate)} → <b>${escapeHtml(it.blockedPlate)}</b></div>`).join("")}
      `;
    } catch (e) {
      console.error(e);
      out.innerHTML = `<div class="badge warn">❌ Error listando (Rules).</div>`;
    }
  };
}

/** =========================
 *  START
 *  ========================= */
injectStyles();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    renderLanding({ defaultTab: "login" });
    return;
  }

  if (!user.isAnonymous) {
    const profile = await getMyProfileByUid(user.uid);

  if (!profile) {
    // ✅ Caso típico: Auth creado pero falló el setDoc en /users/{uid}
    // Creamos un perfil mínimo "pending" para que el owner lo pueda aprobar
    try {
      await setDoc(doc(db, COL_USERS, user.uid), {
        uid: user.uid,
        email: normEmail(user.email || ""),
        name: user.displayName || "",
        username: (user.displayName || "").split(" ")[0] || "",
        rut: "",
        phone: "",
        plates: [],
        sector: "",
        unit: "",
        status: "pending",
        estado: "pendiente",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        source: "auto_fix_missing_profile"
      });
    } catch (e) {
      console.error("No pude auto-crear perfil faltante:", e);
    }
  }

    // Si Auth existe pero no hay doc => obliga completar registro
    if (!profile) {
      renderRegisterWizard({
        step: 2,
        email: normEmail(user.email || ""),
        pass: "", // si viene desde login no lo necesitamos aquí
        name: user.displayName || "",
        plates: [""]
      });
      return;
    }

    // si está pendiente => bloqueado
    if (!isUserActive(profile)) {
      document.body.innerHTML = `
        <div class="wrap">
          <div class="topbar">
            <div class="pillUser">👤 ${escapeHtml(normEmail(user.email || ""))}</div>
            <button id="btnLogout" class="btn secondary">Cerrar sesión</button>
          </div>

          <div class="hero">
            <img class="logo" src="./logo-cesfam.png" alt="CESFAM" />
            <h1>Estacionamiento<br/>CESFAM</h1>
            <div class="subtitle">Karol Wojtyla - Puente Alto</div>
          </div>

          <div class="card">
            <div class="badge warn">⏳ Tu cuenta está pendiente de autorización.</div>
            <div class="muted" style="margin-top:10px">
              Cuando el dueño la apruebe, podrás usar la app.
            </div>
          </div>

          <div class="footer">CESFAM Karol Wojtyla - Puente Alto, Chile</div>
        </div>
      `;
      el("btnLogout").onclick = () => signOut(auth);
      return;
    }
  }

  await renderApp(user);
});
