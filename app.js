// ==============================
// Estacionamiento CESFAM KW - app.js (GitHub Pages + Firebase CDN)
// ==============================

// Firebase SDKs desde CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  addDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// 🔧 TU CONFIG (la que me diste)
const firebaseConfig = {
  apiKey: "AIzaSyDXxvBG0HuFIH5b8vpQkggtqJVJAQZca88",
  authDomain: "estacionamiento-kw.firebaseapp.com",
  databaseURL: "https://estacionamiento-kw-default-rtdb.firebaseio.com",
  projectId: "estacionamiento-kw",
  storageBucket: "estacionamiento-kw.firebasestorage.app",
  messagingSenderId: "474380177810",
  appId: "1:474380177810:web:9448efb41c8682e8a4714b"
};

// ✅ OWNER UID(s) - tu UID real
const OWNER_UIDS = new Set([
  "hnRLNmTe5uguxYWFNufET3YnGQL2"
]);

// Colecciones (Firestore)
const COL_USERS = "users";        // perfiles (docId recomendado: emailLower)
const COL_CHECKINS = "checkins";  // checkins diarios
const COL_BLOCKS = "blocks";      // bloqueos

// App init
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Helpers
const $ = (id) => document.getElementById(id);

const todayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const normEmail = (s) => (s || "").trim().toLowerCase();

const normPlate = (s) =>
  (s || "")
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

function injectStyles() {
  const style = document.createElement("style");
  style.textContent = `
    :root{
      --bg:#f3f6fb;
      --card:#ffffff;
      --ink:#0f172a;
      --muted:#64748b;
      --line:#dbe4f0;
      --brand:#0f172a;
      --brand2:#111827;
      --ok:#16a34a;
      --warn:#b45309;
      --bad:#b91c1c;
      --radius:16px;
    }
    *{box-sizing:border-box}
    body{margin:0;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;background:var(--bg);color:var(--ink)}
    a{color:#2563eb;text-decoration:none}
    .wrap{max-width:520px;margin:0 auto;padding:18px 16px 32px}
    .toplogo{display:flex;justify-content:center;margin-top:10px}
    .toplogo img{width:84px;height:auto}
    h1{font-size:30px;margin:12px 0 2px;text-align:center}
    .subtitle{color:var(--muted);text-align:center;margin:0 0 18px}
    .card{
      background:var(--card);
      border:1px solid var(--line);
      border-radius:20px;
      padding:16px;
      box-shadow:0 10px 30px rgba(15,23,42,.05);
      margin:14px 0;
    }
    .install{
      border:2px solid #bcd3ff;
      background:#eef6ff;
      padding:16px;
      border-radius:16px;
      text-align:center;
      color:#0b4a6f;
      font-weight:600;
    }
    .install small{display:block;color:#1f4f7a;font-weight:500;margin-top:6px}
    .cardTitle{
      display:flex;gap:10px;align-items:center;margin:0 0 10px;
      font-size:18px;font-weight:800;
    }
    .hint{color:var(--muted);margin:0 0 10px;font-size:13px}
    label{display:block;margin:10px 0 6px;color:var(--muted);font-size:13px}
    input,select{
      width:100%;
      padding:12px 12px;
      border:1px solid var(--line);
      border-radius:12px;
      font-size:16px;
      outline:none;
      background:#fff;
    }
    input:focus,select:focus{border-color:#93c5fd;box-shadow:0 0 0 3px rgba(147,197,253,.35)}
    .btn{
      width:100%;
      margin-top:12px;
      padding:12px 14px;
      border-radius:12px;
      border:1px solid var(--brand);
      background:linear-gradient(180deg,var(--brand2),var(--brand));
      color:#fff;
      font-size:16px;
      font-weight:700;
      cursor:pointer;
    }
    .btn.secondary{
      background:#fff;color:var(--ink);border-color:var(--line);
      font-weight:700;
    }
    .btnRow{display:flex;gap:10px;flex-wrap:wrap}
    .btnRow .btn{width:auto;flex:1}
    .row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
    .tabs{display:flex;background:#f4f5f7;border:1px solid var(--line);padding:4px;border-radius:14px;gap:4px}
    .tab{
      flex:1;
      padding:10px 12px;
      text-align:center;
      border-radius:12px;
      cursor:pointer;
      font-weight:700;
      color:var(--muted);
      user-select:none;
    }
    .tab.active{background:#fff;color:var(--ink);border:1px solid var(--line)}
    .linksRow{display:flex;justify-content:space-between;align-items:center;margin-top:12px}
    .linksRow a{font-weight:600}
    .footer{color:var(--muted);text-align:center;margin-top:18px;font-size:13px}
    .ok{color:var(--ok);font-weight:800}
    .warn{color:var(--warn);font-weight:800}
    .bad{color:var(--bad);font-weight:800}
    .pill{display:inline-block;padding:6px 10px;border:1px solid var(--line);border-radius:999px;margin:6px 6px 0 0;background:#fff}
    .hr{height:1px;background:var(--line);margin:14px 0}
    .small{font-size:13px;color:var(--muted)}
    .mini{font-size:12px;color:var(--muted)}
    .topBar{
      display:flex;justify-content:space-between;align-items:center;gap:10px;
      margin:10px 0 0;
    }
    .userChip{
      padding:8px 10px;border:1px solid var(--line);border-radius:999px;background:#fff;
      font-size:13px;color:var(--muted)
    }
  `;
  document.head.appendChild(style);
}

function renderToApp(html) {
  const root = document.getElementById("app") || document.body;
  root.innerHTML = html;
}

// ==============================
// Data access helpers
// ==============================

// Busca perfil por patente en users.plates (array-contains)
async function findUserByPlate(plate) {
  const qy = query(collection(db, COL_USERS), where("plates", "array-contains", plate));
  const snap = await getDocs(qy);
  if (snap.empty) return null;
  const docu = snap.docs[0];
  return { id: docu.id, ...docu.data() };
}

async function getMyProfileByEmail(emailLower) {
  const ref = doc(db, COL_USERS, emailLower);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return snap.data();
}

async function getTodayCheckinByUid(uid) {
  const today = todayStr();
  const qy = query(
    collection(db, COL_CHECKINS),
    where("uid", "==", uid),
    where("date", "==", today)
  );
  const snap = await getDocs(qy);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() };
}

// 🔥 Limpieza “diaria” (solo owner): borra checkins con date < hoy
// OJO: requiere Rules que permitan delete al OWNER.
async function ownerCleanupOldCheckins() {
  const today = todayStr();
  const snap = await getDocs(collection(db, COL_CHECKINS));
  let del = 0;

  for (const d of snap.docs) {
    const data = d.data();
    const date = String(data.date || "");
    if (date && date < today) {
      try {
        await deleteDoc(doc(db, COL_CHECKINS, d.id));
        del++;
      } catch (e) {
        console.warn("No pude borrar checkin antiguo:", d.id, e);
      }
    }
  }
  return del;
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

// ==============================
// UI: Landing / Login / Signup
// ==============================

function landingHtml() {
  return `
    <div class="wrap">
      <div class="toplogo">
        <img src="./logo-cesfam.png" alt="CESFAM Karol Wojtyla" />
      </div>

      <h1>Estacionamiento CESFAM</h1>
      <p class="subtitle">Karol Wojtyla - Puente Alto</p>

      <div class="install">
        ¡Instala esta app! <small>Toca <b>Compartir</b> y luego "Agregar a pantalla de inicio"</small>
      </div>

      <div class="card">
        <div class="cardTitle">👤 Acceso Personal CESFAM</div>
        <p class="hint">Inicia sesión con tu correo (Gmail, Hotmail, Yahoo, etc.)</p>

        <div class="tabs">
          <div class="tab active" id="tabLogin">Iniciar Sesión</div>
          <div class="tab" id="tabSignup">Crear Cuenta</div>
        </div>

        <div id="panelLogin" style="margin-top:12px;">
          <label>Correo electrónico</label>
          <input id="email" type="email" placeholder="tu@email.cl" autocomplete="username" />

          <label>Contraseña</label>
          <input id="pass" type="password" placeholder="********" autocomplete="current-password" />

          <button class="btn" id="btnLogin">Iniciar Sesión</button>

          <div class="linksRow">
            <a href="#" id="lnkReset">¿Olvidaste tu contraseña?</a>
            <a href="#" id="lnkVisitor">👥 Entrar como visita</a>
          </div>

          <div id="msg" class="small" style="margin-top:10px;"></div>
        </div>

        <div id="panelSignup" style="margin-top:12px;display:none;">
          <label>Correo electrónico</label>
          <input id="semail" type="email" placeholder="tu@email.cl" autocomplete="username" />

          <label>Contraseña</label>
          <input id="spass" type="password" placeholder="Mínimo 8 caracteres" autocomplete="new-password" />

          <label>Confirmar contraseña</label>
          <input id="spass2" type="password" placeholder="Repite tu contraseña" autocomplete="new-password" />

          <button class="btn" id="btnSignup">Crear Cuenta</button>
          <div id="smsg" class="small" style="margin-top:10px;"></div>
          <div class="mini" style="margin-top:8px;">
            * Tu cuenta quedará <b>pendiente</b> hasta que el administrador la autorice.
          </div>
        </div>
      </div>

      <button class="btn secondary" id="btnStaffReg">👥 Inscripción de Funcionario</button>

      <div class="footer">CESFAM Karol Wojtyla - Puente Alto, Chile</div>
    </div>
  `;
}

function wireLandingHandlers() {
  // Tabs
  const setTab = (mode) => {
    const isLogin = mode === "login";
    $("tabLogin").classList.toggle("active", isLogin);
    $("tabSignup").classList.toggle("active", !isLogin);
    $("panelLogin").style.display = isLogin ? "block" : "none";
    $("panelSignup").style.display = isLogin ? "none" : "block";
  };

  $("tabLogin").onclick = () => setTab("login");
  $("tabSignup").onclick = () => setTab("signup");

  // Login
  $("btnLogin").onclick = async () => {
    $("msg").textContent = "Entrando...";
    try {
      await signInWithEmailAndPassword(auth, $("email").value.trim(), $("pass").value);
    } catch (e) {
      console.error(e);
      $("msg").innerHTML = `<span class="bad">❌ No pude iniciar sesión.</span> Revisa email/clave o habilitación de Auth.`;
    }
  };

  // Reset password
  $("lnkReset").onclick = async (ev) => {
    ev.preventDefault();
    const email = normEmail($("email").value);
    if (!email) {
      $("msg").innerHTML = `<span class="warn">⚠️ Escribe tu correo arriba y vuelve a tocar “¿Olvidaste tu contraseña?”.</span>`;
      return;
    }
    $("msg").textContent = "Enviando correo de recuperación...";
    try {
      await sendPasswordResetEmail(auth, email);
      $("msg").innerHTML = `<span class="ok">✅ Listo.</span> Revisa tu correo para recuperar contraseña.`;
    } catch (e) {
      console.error(e);
      $("msg").innerHTML = `<span class="bad">❌ No pude enviar el correo.</span>`;
    }
  };

  // Visitor
  $("lnkVisitor").onclick = (ev) => {
    ev.preventDefault();
    renderVisitor();
  };

  // Signup rápido (solo crea cuenta + perfil pendiente básico)
  $("btnSignup").onclick = async () => {
    const email = normEmail($("semail").value);
    const p1 = $("spass").value || "";
    const p2 = $("spass2").value || "";

    $("smsg").textContent = "Creando cuenta...";
    if (!email) {
      $("smsg").innerHTML = `<span class="warn">⚠️ Falta correo.</span>`;
      return;
    }
    if (p1.length < 8) {
      $("smsg").innerHTML = `<span class="warn">⚠️ Contraseña mínimo 8 caracteres.</span>`;
      return;
    }
    if (p1 !== p2) {
      $("smsg").innerHTML = `<span class="warn">⚠️ Las contraseñas no coinciden.</span>`;
      return;
    }

    try {
      const cred = await createUserWithEmailAndPassword(auth, email, p1);

      // Perfil pendiente (sin datos)
      const uid = cred.user.uid;
      await setDoc(doc(db, COL_USERS, email), {
        uid,
        email,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        source: "self_signup"
      }, { merge: true });

      $("smsg").innerHTML = `<span class="ok">✅ Cuenta creada.</span> Quedó <b>pendiente</b> de autorización.`;
    } catch (e) {
      console.error(e);
      $("smsg").innerHTML = `<span class="bad">❌ No pude crear la cuenta.</span> (¿Ya existe ese correo?)`;
    }
  };

  // Staff registration
  $("btnStaffReg").onclick = () => renderStaffRegStep1();
}

// ==============================
// Visitor mode (solo búsqueda)
// ==============================
function renderVisitor() {
  renderToApp(`
    <div class="wrap">
      <div class="toplogo">
        <img src="./logo-cesfam.png" alt="CESFAM" />
      </div>

      <h1>Estacionamiento CESFAM</h1>
      <p class="subtitle">Modo visita (solo búsqueda)</p>

      <div class="card">
        <div class="cardTitle">🔎 Buscar por patente</div>

        <label>Patente</label>
        <input id="vPlate" placeholder="Ej: KHDC46" />
        <button class="btn" id="vSearch">Buscar</button>

        <div id="vRes" class="small" style="margin-top:10px;"></div>
      </div>

      <button class="btn secondary" id="backHome">← Volver</button>
      <div class="footer">CESFAM Karol Wojtyla - Puente Alto, Chile</div>
    </div>
  `);

  $("backHome").onclick = () => renderLanding();
  $("vSearch").onclick = async () => {
    const plate = normPlate($("vPlate").value);
    $("vRes").textContent = "Buscando...";
    if (!plate) {
      $("vRes").innerHTML = `<span class="warn">⚠️ Escribe una patente.</span>`;
      return;
    }

    try {
      const found = await findUserByPlate(plate);
      if (!found || found.status !== "active") {
        $("vRes").innerHTML = `<span class="warn">⚠️ No encontré esa patente (o el usuario no está autorizado).</span>`;
        return;
      }

      const name = found.name || "(sin nombre)";
      const phone = found.phone || "(sin teléfono)";
      const sectorHabitual = found.sector || "(sin sector)";
      const wa = (!phone || String(phone).includes("sin"))
        ? null
        : whatsappLink(phone, `Hola ${name}. Te contacto por Estacionamiento CESFAM: tu vehículo (${plate}) está bloqueando mi salida. ¿Puedes moverlo por favor? Gracias.`);

      $("vRes").innerHTML = `
        <div><b>${escapeHtml(name)}</b></div>
        <div>📞 ${escapeHtml(phone)}</div>
        <div>🏥 Sector habitual: <b>${escapeHtml(sectorHabitual)}</b></div>
        <div class="muted" style="margin-top:6px;">
          Patentes: ${(found.plates || []).map(p=>`<span class="pill">${escapeHtml(p)}</span>`).join("")}
        </div>
        ${wa ? `<a href="${wa}" target="_blank"><button class="btn" style="margin-top:10px;">📲 Enviar WhatsApp</button></a>`
             : `<div class="warn" style="margin-top:10px;">⚠️ No puedo armar WhatsApp (falta teléfono).</div>`
        }
      `;
    } catch (e) {
      console.error(e);
      $("vRes").innerHTML = `<span class="bad">❌ Error buscando. Revisa consola.</span>`;
    }
  };
}

// ==============================
// Staff registration (3 pasos) + pendiente de aprobación
// ==============================

const SECTORS = [
  "Dirección","Dental","Farmacia","Ambulancia","UAC",
  "Sector Rojo","Sector Amarillo","Transversal","Box Psicosocial",
  "Sala ERA","Vacunatorio","Telesalud","Oirs/Sau","Esterilización",
  "Bodega de Alimentos","Bodega de Farmacia","Dependencia Severa",
  "Sala de Psicomotricidad","Sala de Estimulación DSM","Apoyo Clínico","Ex SIGGES"
];

let REG = {
  email: "",
  pass: "",
  pass2: "",
  name: "",
  rut: "",
  phone: "",
  plates: [],
  sector: "",
  accepted: false
};

function renderStaffRegStep1() {
  REG = { email:"", pass:"", pass2:"", name:"", rut:"", phone:"", plates:[], sector:"", accepted:false };

  renderToApp(`
    <div class="wrap">
      <div class="toplogo"><img src="./logo-cesfam.png" alt="CESFAM" /></div>
      <h1>Completa tu Registro</h1>
      <p class="subtitle">Ingresa tus datos de funcionario</p>

      <div class="card">
        <div class="cardTitle">🛡️ Registro Seguro</div>
        <div class="hint"><b>Inscripción de Funcionario</b><br/>Paso 1 de 3: Cuenta de acceso</div>

        <label>Correo electrónico</label>
        <input id="rEmail" type="email" placeholder="tu@gmail.com, tu@hotmail.com, etc." />

        <label>Contraseña</label>
        <input id="rPass" type="password" placeholder="Mínimo 8 caracteres" />

        <label>Confirmar contraseña</label>
        <input id="rPass2" type="password" placeholder="Repite tu contraseña" />

        <button class="btn" id="next1">Siguiente</button>
        <div id="rMsg1" class="small" style="margin-top:10px;"></div>
      </div>

      <button class="btn secondary" id="backHome">← Volver al inicio</button>
      <div class="footer">CESFAM Karol Wojtyla - Puente Alto, Chile</div>
    </div>
  `);

  $("backHome").onclick = () => renderLanding();

  $("next1").onclick = () => {
    const email = normEmail($("rEmail").value);
    const p1 = $("rPass").value || "";
    const p2 = $("rPass2").value || "";

    $("rMsg1").textContent = "";
    if (!email) { $("rMsg1").innerHTML = `<span class="warn">⚠️ Falta correo.</span>`; return; }
    if (p1.length < 8) { $("rMsg1").innerHTML = `<span class="warn">⚠️ Contraseña mínimo 8 caracteres.</span>`; return; }
    if (p1 !== p2) { $("rMsg1").innerHTML = `<span class="warn">⚠️ Las contraseñas no coinciden.</span>`; return; }

    REG.email = email; REG.pass = p1; REG.pass2 = p2;
    renderStaffRegStep2();
  };
}

function renderStaffRegStep2() {
  renderToApp(`
    <div class="wrap">
      <div class="toplogo"><img src="./logo-cesfam.png" alt="CESFAM" /></div>
      <h1>Completa tu Registro</h1>
      <p class="subtitle">Ingresa tus datos de funcionario</p>

      <div class="card">
        <div class="cardTitle">🛡️ Registro Seguro</div>
        <div class="hint"><b>Inscripción de Funcionario</b><br/>Paso 2 de 3: Datos personales</div>

        <label>Nombre completo</label>
        <input id="rName" placeholder="Ej: María González Pérez" />

        <label>RUT</label>
        <input id="rRut" placeholder="Ej: 12345678-9" />
        <div class="mini">Ingresa RUT sin puntos ni guión</div>

        <label>Teléfono</label>
        <input id="rPhone" placeholder="Ej: 912345678" />

        <div class="btnRow">
          <button class="btn secondary" id="prev2">Anterior</button>
          <button class="btn" id="next2">Siguiente</button>
        </div>

        <div id="rMsg2" class="small" style="margin-top:10px;"></div>
      </div>

      <button class="btn secondary" id="backHome">← Volver al inicio</button>
      <div class="footer">CESFAM Karol Wojtyla - Puente Alto, Chile</div>
    </div>
  `);

  $("backHome").onclick = () => renderLanding();
  $("prev2").onclick = () => renderStaffRegStep1();

  $("next2").onclick = () => {
    const name = ($("rName").value || "").trim();
    const rut = ($("rRut").value || "").trim();
    const phone = ($("rPhone").value || "").trim();

    $("rMsg2").textContent = "";
    if (!name) { $("rMsg2").innerHTML = `<span class="warn">⚠️ Falta nombre.</span>`; return; }

    REG.name = name; REG.rut = rut; REG.phone = phone;
    renderStaffRegStep3();
  };
}

function renderStaffRegStep3() {
  renderToApp(`
    <div class="wrap">
      <div class="toplogo"><img src="./logo-cesfam.png" alt="CESFAM" /></div>
      <h1>Completa tu Registro</h1>
      <p class="subtitle">Ingresa tus datos de funcionario</p>

      <div class="card">
        <div class="cardTitle">🛡️ Registro Seguro</div>
        <div class="hint"><b>Inscripción de Funcionario</b><br/>Paso 3 de 3: Información de vehículos</div>

        <label>Patente(s) de tu(s) vehículo(s)</label>
        <div class="mini">Puedes agregar más de una patente si tienes varios vehículos</div>
        <input id="plateInput" placeholder="Ej: ABCD12" />

        <button class="btn secondary" id="addPlate">＋ Agregar otra patente</button>

        <div id="plateList" class="small" style="margin-top:10px;"></div>

        <label style="margin-top:14px;">Unidad/Sector donde trabaja</label>
        <select id="sectorSel">
          <option value="">Selecciona tu unidad</option>
          ${SECTORS.map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("")}
        </select>

        <label style="margin-top:14px;display:flex;gap:10px;align-items:flex-start;">
          <input id="terms" type="checkbox" style="width:auto;margin-top:3px;" />
          <span>
            Acepto los <a href="#" id="termsLink">Términos y Condiciones</a>
            <div class="mini">Conforme a la Ley 19.628 sobre protección de la vida privada</div>
          </span>
        </label>

        <div class="btnRow">
          <button class="btn secondary" id="prev3">Anterior</button>
          <button class="btn" id="finish">Completar Registro</button>
        </div>

        <div id="rMsg3" class="small" style="margin-top:10px;"></div>
      </div>

      <button class="btn secondary" id="backHome">← Volver al inicio</button>
      <div class="footer">CESFAM Karol Wojtyla - Puente Alto, Chile</div>
    </div>
  `);

  $("backHome").onclick = () => renderLanding();
  $("prev3").onclick = () => renderStaffRegStep2();

  const refreshPlates = () => {
    $("plateList").innerHTML = REG.plates.length
      ? `<div class="mini">Patentes agregadas:</div>${REG.plates.map(p=>`<span class="pill">${escapeHtml(p)}</span>`).join("")}`
      : `<span class="muted">Aún no agregas patentes.</span>`;
  };
  refreshPlates();

  $("addPlate").onclick = () => {
    const p = normPlate($("plateInput").value);
    $("rMsg3").textContent = "";
    if (!p) { $("rMsg3").innerHTML = `<span class="warn">⚠️ Escribe una patente válida.</span>`; return; }
    if (!REG.plates.includes(p)) REG.plates.push(p);
    $("plateInput").value = "";
    refreshPlates();
  };

  $("termsLink").onclick = (ev) => {
    ev.preventDefault();
    alert("Términos: Uso interno CESFAM. Los datos se usan solo para contacto por estacionamiento.");
  };

  $("finish").onclick = async () => {
    const sector = ($("sectorSel").value || "").trim();
    const accepted = $("terms").checked;

    $("rMsg3").textContent = "Creando cuenta y guardando datos...";
    if (REG.plates.length === 0) { $("rMsg3").innerHTML = `<span class="warn">⚠️ Agrega al menos 1 patente.</span>`; return; }
    if (!sector) { $("rMsg3").innerHTML = `<span class="warn">⚠️ Selecciona tu unidad/sector.</span>`; return; }
    if (!accepted) { $("rMsg3").innerHTML = `<span class="warn">⚠️ Debes aceptar términos.</span>`; return; }

    REG.sector = sector;
    REG.accepted = accepted;

    try {
      // 1) Crear cuenta Auth
      const cred = await createUserWithEmailAndPassword(auth, REG.email, REG.pass);
      const uid = cred.user.uid;

      // 2) Guardar perfil PENDIENTE en Firestore (docId=emailLower)
      await setDoc(doc(db, COL_USERS, REG.email), {
        uid,
        email: REG.email,
        status: "pending",
        name: REG.name,
        rut: REG.rut,
        phone: REG.phone,
        plates: REG.plates,
        sector: REG.sector,     // 👈 habitual
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        source: "staff_registration"
      }, { merge: true });

      $("rMsg3").innerHTML = `<span class="ok">✅ Registro enviado.</span> Quedaste <b>pendiente</b> de autorización.`;
    } catch (e) {
      console.error(e);
      $("rMsg3").innerHTML = `<span class="bad">❌ No pude completar el registro.</span> (¿Ya existe ese correo?)`;
    }
  };
}

// ==============================
// Logged-in App (activo / pendiente / owner)
// ==============================

function renderPending(user, profile) {
  const email = user.email || "";
  renderToApp(`
    <div class="wrap">
      <div class="toplogo"><img src="./logo-cesfam.png" alt="CESFAM" /></div>
      <h1>Estacionamiento CESFAM</h1>
      <p class="subtitle">Karol Wojtyla - Puente Alto</p>

      <div class="card">
        <div class="cardTitle">⏳ Cuenta pendiente</div>
        <div class="small">👤 Sesión activa: <b>${escapeHtml(email)}</b></div>
        <div class="hr"></div>
        <div class="warn">⚠️ Tu cuenta aún no está autorizada por el administrador.</div>
        <div class="small" style="margin-top:8px;">
          Cuando te activen, podrás buscar patentes y hacer check-in.
        </div>

        <button class="btn secondary" id="btnLogout" style="margin-top:14px;">Cerrar sesión</button>
      </div>

      <div class="footer">CESFAM Karol Wojtyla - Puente Alto, Chile</div>
    </div>
  `);

  $("btnLogout").onclick = () => signOut(auth);
}

async function renderActiveApp(user, profile) {
  const email = user.email || "";
  const uid = user.uid;
  const today = todayStr();
  const isOwner = OWNER_UIDS.has(uid);

  // Si es owner, intenta limpiar checkins antiguos
  let cleaned = 0;
  if (isOwner) {
    try { cleaned = await ownerCleanupOldCheckins(); } catch {}
  }

  // Intentar checkin de hoy (para mostrarlo)
  let myToday = null;
  try { myToday = await getTodayCheckinByUid(uid); } catch {}

  renderToApp(`
    <div class="wrap">
      <div class="topBar">
        <div class="userChip">👤 ${escapeHtml(email)}</div>
        <button class="btn secondary" id="btnLogout" style="width:auto;margin:0;">Cerrar sesión</button>
      </div>

      <div class="toplogo" style="margin-top:14px;"><img src="./logo-cesfam.png" alt="CESFAM" /></div>
      <h1>Estacionamiento CESFAM</h1>
      <p class="subtitle">Karol Wojtyla - Puente Alto</p>

      ${isOwner ? `
        <div class="card">
          <div class="cardTitle">🛠️ Admin (Dueño)</div>
          <div class="small">UID: <b>${escapeHtml(uid)}</b></div>
          ${cleaned ? `<div class="ok">✅ Limpieza: borré ${cleaned} check-in(s) antiguos.</div>` : `<div class="small">Limpieza diaria: OK.</div>`}
          <button class="btn" id="btnAdmin">Ver pendientes de autorización</button>
          <div id="adminBox" class="small" style="margin-top:10px;"></div>
        </div>
      ` : ""}

      <div class="card">
        <div class="cardTitle">🔎 Buscar por patente</div>

        <label>Patente</label>
        <input id="searchPlate" placeholder="Ej: KHDC46" />

        <button class="btn" id="btnSearch">Buscar</button>

        <div id="searchRes" class="small" style="margin-top:10px;"></div>
      </div>

      <div class="card">
        <div class="cardTitle">📍 Check-in (hoy)</div>

        <div class="row">
          <div>
            <label>Mi patente</label>
            <input id="myPlate" placeholder="Ej: KHDC46" value="${escapeHtml((profile?.plates?.[0] || ""))}" />
          </div>
          <div>
            <label>Mi sector hoy</label>
            <input id="mySectorToday" placeholder="Ej: Farmacia" value="${escapeHtml((myToday?.sectorToday || profile?.sector || ""))}" />
          </div>
        </div>

        <button class="btn" id="btnCheckin">Hacer check-in</button>
        <div id="checkinRes" class="small" style="margin-top:10px;"></div>

        <div class="mini" style="margin-top:8px;">
          * El check-in es <b>solo por hoy</b> (${today}). Mañana partes en blanco.
        </div>
      </div>

      <div class="card">
        <div class="cardTitle">🚗 Estoy bloqueando (hoy)</div>

        <div class="row">
          <div>
            <label>Mi patente (quien bloquea)</label>
            <input id="blockerPlate" placeholder="Ej: KHDC46" value="${escapeHtml((profile?.plates?.[0] || ""))}" />
          </div>
          <div>
            <label>Patente bloqueada</label>
            <input id="blockedPlate" placeholder="Ej: ABCD12" />
          </div>
        </div>

        <div class="btnRow">
          <button class="btn" id="btnAddBlock">Agregar bloqueo</button>
          <button class="btn secondary" id="btnListBlocks">Ver bloqueos de hoy</button>
        </div>

        <div id="blocksRes" class="small" style="margin-top:10px;"></div>
      </div>

      <div class="footer">CESFAM Karol Wojtyla - Puente Alto, Chile</div>
    </div>
  `);

  // Logout
  $("btnLogout").onclick = () => signOut(auth);

  // Admin panel
  if (isOwner) {
    $("btnAdmin").onclick = async () => {
      $("adminBox").textContent = "Cargando pendientes...";
      try {
        const qy = query(collection(db, COL_USERS), where("status", "==", "pending"));
        const snap = await getDocs(qy);

        if (snap.empty) {
          $("adminBox").innerHTML = `<span class="ok">✅ No hay usuarios pendientes.</span>`;
          return;
        }

        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        $("adminBox").innerHTML = `
          <div class="small">Pendientes (${rows.length}):</div>
          ${rows.map(u => `
            <div class="card" style="margin:10px 0;padding:12px;border-radius:14px;">
              <div><b>${escapeHtml(u.name || "(sin nombre)")}</b></div>
              <div class="mini">Email: ${escapeHtml(u.email || u.id)}</div>
              <div class="mini">Sector: ${escapeHtml(u.sector || "")}</div>
              <div class="mini">Patentes: ${(u.plates || []).map(p=>`<span class="pill">${escapeHtml(p)}</span>`).join("")}</div>
              <div class="btnRow" style="margin-top:10px;">
                <button class="btn" data-approve="${escapeHtml(u.id)}">Aprobar</button>
                <button class="btn secondary" data-reject="${escapeHtml(u.id)}">Rechazar</button>
              </div>
            </div>
          `).join("")}
        `;

        // wire buttons
        document.querySelectorAll("[data-approve]").forEach(btn => {
          btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-approve");
            try {
              await updateDoc(doc(db, COL_USERS, id), { status:"active", updatedAt: serverTimestamp() });
              $("adminBox").innerHTML = `<span class="ok">✅ Aprobado: ${escapeHtml(id)}</span>`;
            } catch (e) {
              console.error(e);
              $("adminBox").innerHTML = `<span class="bad">❌ No pude aprobar (revisa Rules).</span>`;
            }
          });
        });
        document.querySelectorAll("[data-reject]").forEach(btn => {
          btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-reject");
            try {
              await updateDoc(doc(db, COL_USERS, id), { status:"rejected", updatedAt: serverTimestamp() });
              $("adminBox").innerHTML = `<span class="ok">✅ Rechazado: ${escapeHtml(id)}</span>`;
            } catch (e) {
              console.error(e);
              $("adminBox").innerHTML = `<span class="bad">❌ No pude rechazar (revisa Rules).</span>`;
            }
          });
        });

      } catch (e) {
        console.error(e);
        $("adminBox").innerHTML = `<span class="bad">❌ Error cargando pendientes.</span>`;
      }
    };
  }

  // Buscar patente: muestra habitual + checkin hoy si difiere
  $("btnSearch").onclick = async () => {
    const plate = normPlate($("searchPlate").value);
    $("searchRes").textContent = "Buscando...";
    if (!plate) {
      $("searchRes").innerHTML = `<span class="warn">⚠️ Escribe una patente.</span>`;
      return;
    }

    try {
      const found = await findUserByPlate(plate);
      if (!found || found.status !== "active") {
        $("searchRes").innerHTML = `<span class="warn">⚠️ No encontré esa patente (o el usuario no está autorizado).</span>`;
        return;
      }

      const name = found.name || "(sin nombre)";
      const phone = found.phone || "(sin teléfono)";
      const sectorHabitual = found.sector || "(sin sector)";
      const theirUid = found.uid;

      // check-in hoy del dueño de esa patente
      let todayCheck = null;
      try { todayCheck = await getTodayCheckinByUid(theirUid); } catch {}

      const sectorToday = todayCheck?.sectorToday || "";
      const showToday = sectorToday && sectorToday !== sectorHabitual;

      const msg = `Hola ${name}. Te contacto por Estacionamiento CESFAM: tu vehículo (${plate}) está bloqueando mi salida. ¿Puedes moverlo por favor? Gracias.`;
      const wa = (!phone || String(phone).includes("sin")) ? null : whatsappLink(phone, msg);

      $("searchRes").innerHTML = `
        <div><b>${escapeHtml(name)}</b></div>
        <div>📞 ${escapeHtml(phone)}</div>
        <div>🏥 Sector habitual: <b>${escapeHtml(sectorHabitual)}</b></div>
        ${showToday ? `<div class="ok">📍 Hoy hizo check-in en: <b>${escapeHtml(sectorToday)}</b></div>` : (sectorToday ? `<div class="small">📍 Check-in hoy: ${escapeHtml(sectorToday)}</div>` : `<div class="small muted">Sin check-in hoy.</div>`)}
        <div class="muted" style="margin-top:6px;">
          Patentes: ${(found.plates || []).map(p=>`<span class="pill">${escapeHtml(p)}</span>`).join("")}
        </div>
        ${wa ? `<a href="${wa}" target="_blank"><button class="btn" style="margin-top:10px;">📲 Enviar WhatsApp</button></a>`
             : `<div class="warn" style="margin-top:10px;">⚠️ No puedo armar WhatsApp (falta teléfono).</div>`
        }
      `;
    } catch (e) {
      console.error(e);
      $("searchRes").innerHTML = `<span class="bad">❌ Error buscando. Revisa consola.</span>`;
    }
  };

  // Check-in
  $("btnCheckin").onclick = async () => {
    const plate = normPlate($("myPlate").value);
    const sectorToday = ($("mySectorToday").value || "").trim();
    $("checkinRes").textContent = "Guardando check-in...";

    if (!plate || !sectorToday) {
      $("checkinRes").innerHTML = `<span class="warn">⚠️ Falta patente o sector hoy.</span>`;
      return;
    }

    try {
      // 1) Guarda checkin (docId estable por usuario+fecha)
      const id = `${uid}_${today}`;
      await setDoc(doc(db, COL_CHECKINS, id), {
        uid,
        email: normEmail(email),
        plate,
        sectorToday, // 👈 HOY
        date: today,
        ts: serverTimestamp()
      }, { merge: true });

      // 2) Mensaje OK
      $("checkinRes").innerHTML = `<span class="ok">✅ Check-in OK: ${escapeHtml(plate)} · ${escapeHtml(sectorToday)}</span>`;
    } catch (e) {
      console.error(e);
      $("checkinRes").innerHTML = `<span class="bad">❌ No pude guardar check-in. Revisa Rules.</span>`;
    }
  };

  // Bloqueos
  $("btnAddBlock").onclick = async () => {
    const blockerPlate = normPlate($("blockerPlate").value);
    const blockedPlate = normPlate($("blockedPlate").value);

    $("blocksRes").textContent = "Guardando bloqueo...";
    if (!blockerPlate || !blockedPlate) {
      $("blocksRes").innerHTML = `<span class="warn">⚠️ Falta mi patente o la bloqueada.</span>`;
      return;
    }

    try {
      await addDoc(collection(db, COL_BLOCKS), {
        blockerUid: uid,
        blockerEmail: normEmail(email),
        blockerPlate,
        blockedPlate,
        date: today,
        ts: serverTimestamp()
      });

      $("blocksRes").innerHTML = `<span class="ok">✅ Bloqueo agregado: ${escapeHtml(blockerPlate)} → ${escapeHtml(blockedPlate)}</span>`;
      $("blockedPlate").value = "";
    } catch (e) {
      console.error(e);
      $("blocksRes").innerHTML = `<span class="bad">❌ No pude guardar bloqueo. Revisa Rules.</span>`;
    }
  };

  $("btnListBlocks").onclick = async () => {
    $("blocksRes").textContent = "Cargando bloqueos de hoy...";
    try {
      const qy = query(
        collection(db, COL_BLOCKS),
        where("blockerUid", "==", uid),
        where("date", "==", today)
      );
      const snap = await getDocs(qy);

      if (snap.empty) {
        $("blocksRes").innerHTML = `<span class="muted">No tienes bloqueos hoy.</span>`;
        return;
      }

      const items = snap.docs.map(d => d.data());
      $("blocksRes").innerHTML = `
        <div class="muted">Bloqueos hoy (${today}):</div>
        ${items.map(it => `<div class="pill">${escapeHtml(it.blockerPlate)} → <b>${escapeHtml(it.blockedPlate)}</b></div>`).join("")}
        <div class="muted" style="margin-top:10px;">Tip: usa “Buscar por patente” para avisar por WhatsApp.</div>
      `;
    } catch (e) {
      console.error(e);
      $("blocksRes").innerHTML = `<span class="bad">❌ Error listando bloqueos.</span>`;
    }
  };
}

// ==============================
// App entry
// ==============================

function renderLanding() {
  renderToApp(landingHtml());
  wireLandingHandlers();
}

injectStyles();
renderLanding();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    renderLanding();
    return;
  }

  const email = normEmail(user.email || "");
  if (!email) {
    renderLanding();
    return;
  }

  // Leer perfil
  let profile = null;
  try { profile = await getMyProfileByEmail(email); } catch {}

  // Si no existe perfil, créalo como pendiente
  if (!profile) {
    try {
      await setDoc(doc(db, COL_USERS, email), {
        uid: user.uid,
        email,
        status: "pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        source: "auto_profile"
      }, { merge: true });
    } catch {}
    profile = { status: "pending" };
  }

  // Gate por status
  if (OWNER_UIDS.has(user.uid)) {
    await renderActiveApp(user, profile);
    return;
  }

  const status = profile.status || "pending";
  if (status !== "active") {
    renderPending(user, profile);
    return;
  }

  await renderActiveApp(user, profile);
});
