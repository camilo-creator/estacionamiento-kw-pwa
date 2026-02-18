// Firebase SDKs desde CDN (GitHub Pages compatible)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signOut
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
  serverTimestamp,
  Timestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/** ========= CONFIG ========= **/
const firebaseConfig = {
  apiKey: "AIzaSyDXxvBG0HuFIH5b8vpQkggtqJVJAQZca88",
  authDomain: "estacionamiento-kw.firebaseapp.com",
  databaseURL: "https://estacionamiento-kw-default-rtdb.firebaseio.com",
  projectId: "estacionamiento-kw",
  storageBucket: "estacionamiento-kw.firebasestorage.app",
  messagingSenderId: "474380177810",
  appId: "1:474380177810:web:9448efb41c8682e8a4714b"
};

// Dueños (solo para UI). La seguridad REAL la dan las Rules con UID.
const OWNER_EMAILS = new Set([
  "camilodelajara@gmail.com"
]);

/** ========= INIT ========= **/
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/** ========= HELPERS ========= **/
const el = (id) => document.getElementById(id);

const todayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

const endOfToday = () => {
  const d = new Date();
  d.setHours(23, 59, 59, 0);
  return d;
};

const normEmail = (s) => (s || "").trim().toLowerCase();

const normPlate = (s) =>
  (s || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9]/g, "");

function whatsappLink(phone, msg) {
  let p = String(phone || "").replace(/\D/g, "");
  if (p.startsWith("56")) {
    // ok
  } else if (p.length === 9 && p.startsWith("9")) {
    p = "56" + p;
  }
  const text = encodeURIComponent(msg || "");
  return `https://wa.me/${p}?text=${text}`;
}

async function getMyUserDoc(uid) {
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

async function findUserByPlate(plate) {
  const qy = query(collection(db, "users"), where("plates", "array-contains", plate));
  const snap = await getDocs(qy);
  if (snap.empty) return null;
  const d = snap.docs[0];
  return { id: d.id, ...d.data() }; // id = uid del dueño del perfil
}

async function getTodayCheckinByPlate(plate) {
  const qy = query(
    collection(db, "checkins"),
    where("plate", "==", plate),
    where("date", "==", todayStr())
  );
  const snap = await getDocs(qy);
  if (snap.empty) return null;
  // si hay más de uno (no debería), tomamos el primero
  return snap.docs[0].data();
}

/** ========= UI RENDER ========= **/
function renderAuthScreen() {
  document.body.innerHTML = `
    <h1>Estacionamiento KW</h1>
    <p class="sub">Acceso personal CESFAM</p>

    <div class="tabs">
      <button class="tab active" id="tabLogin">Iniciar sesión</button>
      <button class="tab" id="tabRegister">Crear cuenta</button>
    </div>

    <div class="card" id="authCard"></div>
  `;

  const setTab = (which) => {
    el("tabLogin").classList.toggle("active", which === "login");
    el("tabRegister").classList.toggle("active", which === "register");
    if (which === "login") renderLoginForm();
    else renderRegisterWizardStep1();
  };

  el("tabLogin").onclick = () => setTab("login");
  el("tabRegister").onclick = () => setTab("register");

  renderLoginForm();
}

function renderLoginForm() {
  el("authCard").innerHTML = `
    <h3 style="margin:0 0 10px;">Iniciar sesión</h3>

    <label>Email</label>
    <input id="email" type="email" placeholder="tu@correo.cl" autocomplete="username" />

    <label>Contraseña</label>
    <input id="pass" type="password" placeholder="••••••••" autocomplete="current-password" />

    <div class="btns">
      <button id="btnLogin">Iniciar sesión</button>
    </div>
    <p id="loginMsg" class="muted" style="margin-top:10px;"></p>
  `;

  el("btnLogin").onclick = async () => {
    el("loginMsg").textContent = "Entrando...";
    try {
      await signInWithEmailAndPassword(auth, normEmail(el("email").value), el("pass").value);
    } catch (e) {
      console.error(e);
      el("loginMsg").textContent = "❌ No pude iniciar sesión (email/clave o Auth no habilitado).";
    }
  };
}

/** ===== Registro por pasos =====
  Paso 1: email/clave
  Paso 2: nombre/rut/teléfono
  Paso 3: patentes + sector habitual + T&C -> crea perfil estado=pending
**/
let REG = {
  email: "",
  pass: "",
  name: "",
  rut: "",
  phone: "",
  plates: [""],
  sector: ""
};

const SECTORES = [
  "Dirección","Dental","Farmacia","Ambulancia","UAC","Sector Rojo","Sector Amarillo",
  "Transversal","Box Psicosocial","Sala ERA","Vacunatorio","Telesalud","Oirs/Sau",
  "Esterilización","Bodega de Alimentos","Bodega de Farmacia","Dependencia Severa",
  "Sala de Psicomotricidad","Sala de Estimulación DSM","Apoyo Clínico","Ex SIGGES"
];

function renderRegisterWizardStep1() {
  el("authCard").innerHTML = `
    <h3 style="margin:0 0 10px;">Crear cuenta (Paso 1/3)</h3>

    <label>Email</label>
    <input id="rEmail" type="email" placeholder="tu@gmail.com" />

    <label>Contraseña</label>
    <input id="rPass" type="password" placeholder="mínimo 6 caracteres" />

    <label>Confirmar contraseña</label>
    <input id="rPass2" type="password" placeholder="repite tu contraseña" />

    <div class="btns">
      <button id="btnNext1">Siguiente</button>
    </div>
    <p id="rMsg1" class="muted" style="margin-top:10px;"></p>
  `;

  el("btnNext1").onclick = () => {
    const email = normEmail(el("rEmail").value);
    const pass = el("rPass").value;
    const pass2 = el("rPass2").value;

    if (!email.includes("@")) return el("rMsg1").textContent = "⚠️ Email inválido.";
    if (!pass || pass.length < 6) return el("rMsg1").textContent = "⚠️ Clave mínimo 6 caracteres.";
    if (pass !== pass2) return el("rMsg1").textContent = "⚠️ Las claves no coinciden.";

    REG.email = email;
    REG.pass = pass;
    renderRegisterWizardStep2();
  };
}

function renderRegisterWizardStep2() {
  el("authCard").innerHTML = `
    <h3 style="margin:0 0 10px;">Datos personales (Paso 2/3)</h3>

    <label>Nombre completo</label>
    <input id="rName" placeholder="Ej: María González Pérez" />

    <label>RUT (sin puntos ni guión)</label>
    <input id="rRut" placeholder="Ej: 123456789" />

    <label>Teléfono (9 dígitos)</label>
    <input id="rPhone" placeholder="Ej: 912345678" />

    <div class="btns">
      <button class="secondary" id="btnBack2">Anterior</button>
      <button id="btnNext2">Siguiente</button>
    </div>
    <p id="rMsg2" class="muted" style="margin-top:10px;"></p>
  `;

  el("btnBack2").onclick = () => renderRegisterWizardStep1();
  el("btnNext2").onclick = () => {
    const name = (el("rName").value || "").trim();
    const rut = (el("rRut").value || "").replace(/\D/g, "");
    const phone = (el("rPhone").value || "").replace(/\D/g, "");

    if (name.length < 5) return el("rMsg2").textContent = "⚠️ Escribe tu nombre completo.";
    if (rut.length < 7) return el("rMsg2").textContent = "⚠️ RUT inválido.";
    if (phone.length < 8) return el("rMsg2").textContent = "⚠️ Teléfono inválido.";

    REG.name = name;
    REG.rut = rut;
    REG.phone = phone;
    renderRegisterWizardStep3();
  };
}

function renderRegisterWizardStep3() {
  const sectorOptions = SECTORES.map(s => `<option value="${s}">${s}</option>`).join("");

  el("authCard").innerHTML = `
    <h3 style="margin:0 0 10px;">Vehículos (Paso 3/3)</h3>

    <label>Patente(s)</label>
    <div id="platesWrap"></div>
    <div class="btns">
      <button class="secondary" id="btnAddPlate">+ Agregar otra patente</button>
    </div>

    <label>Unidad/Sector donde trabaja (habitual)</label>
    <select id="rSector">
      <option value="">Selecciona tu unidad</option>
      ${sectorOptions}
    </select>

    <label style="margin-top:12px;">
      <input type="checkbox" id="rTos" /> Acepto Términos y Condiciones
    </label>

    <div class="btns">
      <button class="secondary" id="btnBack3">Anterior</button>
      <button id="btnFinish">Completar registro</button>
    </div>

    <p id="rMsg3" class="muted" style="margin-top:10px;"></p>
  `;

  const renderPlates = () => {
    el("platesWrap").innerHTML = REG.plates.map((p, idx) => `
      <input
        style="margin-bottom:10px"
        data-idx="${idx}"
        class="plateInput"
        placeholder="Ej: ABCD12"
        value="${p}"
      />
    `).join("");

    document.querySelectorAll(".plateInput").forEach(inp => {
      inp.oninput = (e) => {
        const i = Number(e.target.getAttribute("data-idx"));
        REG.plates[i] = e.target.value;
      };
    });
  };

  renderPlates();

  el("btnAddPlate").onclick = () => {
    REG.plates.push("");
    renderPlates();
  };

  el("btnBack3").onclick = () => renderRegisterWizardStep2();

  el("btnFinish").onclick = async () => {
    const sector = (el("rSector").value || "").trim();
    const tos = el("rTos").checked;

    const plates = REG.plates.map(normPlate).filter(Boolean);
    const uniquePlates = [...new Set(plates)];

    if (uniquePlates.length < 1) return el("rMsg3").textContent = "⚠️ Agrega al menos 1 patente.";
    if (!sector) return el("rMsg3").textContent = "⚠️ Selecciona tu sector habitual.";
    if (!tos) return el("rMsg3").textContent = "⚠️ Debes aceptar T&C.";

    REG.sector = sector;
    el("rMsg3").textContent = "Creando cuenta...";

    try {
      // 1) Crear usuario Auth
      const cred = await createUserWithEmailAndPassword(auth, REG.email, REG.pass);

      // 2) Crear perfil (pendiente)
      const uid = cred.user.uid;
      await setDoc(doc(db, "users", uid), {
        uid,
        email: REG.email,
        name: REG.name,
        rut: REG.rut,
        phone: REG.phone,
        plates: uniquePlates,
        sector: REG.sector,         // habitual
        estado: "pendiente",        // requiere aprobación
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      el("rMsg3").innerHTML = `<span class="ok">✅ Registro enviado. Quedas “pendiente de aprobación”.</span>`;
      // al quedar logueado, onAuthStateChanged lo redirige a pantalla pendiente
    } catch (e) {
      console.error(e);
      el("rMsg3").textContent = "❌ Error creando cuenta. ¿Email ya existe? ¿Auth habilitado?";
    }
  };
}

/** ===== App ===== **/
function renderPending(user, profile) {
  document.body.innerHTML = `
    <h1>Estacionamiento KW</h1>
    <p class="sub">Cuenta pendiente de autorización</p>

    <div class="card">
      <div>👤 <b>${profile?.name || user.email}</b></div>
      <div class="muted">Email: ${user.email}</div>
      <div class="muted">UID: <b>${user.uid}</b></div>

      <p style="margin-top:12px;">
        Tu registro está <b>pendiente</b>. El dueño de la app debe activarte.
      </p>

      <div class="btns">
        <button class="secondary" id="btnLogout">Cerrar sesión</button>
      </div>
    </div>
  `;
  el("btnLogout").onclick = () => signOut(auth);
}

function renderApp(user, myProfile) {
  const email = user.email || "";
  const uid = user.uid;
  const today = todayStr();
  const isOwner = OWNER_EMAILS.has(normEmail(email));

  document.body.innerHTML = `
    <h1>Estacionamiento KW</h1>
    <div class="muted">👤 Sesión activa: <b>${email}</b></div>

    <div class="btns" style="margin:10px 0 2px;">
      <button class="secondary" id="btnLogout">Cerrar sesión</button>
      <span class="ok">✅ Activo</span>
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
          <input id="mySectorToday" placeholder="Ej: Dental" value="${(myProfile?.sector || "")}" />
        </div>
      </div>
      <div class="btns">
        <button id="btnCheckin">Hacer check-in</button>
      </div>
      <div id="checkinRes" class="muted" style="margin-top:10px;"></div>
      <div class="muted" style="margin-top:8px;">Tu sector habitual: <b>${myProfile?.sector || "(sin sector)"}</b></div>
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

    ${isOwner ? `
    <div class="card">
      <h3 style="margin:0 0 10px;">🛡️ Admin (Dueño)</h3>
      <div class="muted">Tu UID (cópialo para Rules): <b>${uid}</b></div>

      <label style="margin-top:10px;">Buscar pendientes por email</label>
      <input id="pendingEmail" placeholder="alguien@gmail.com" />
      <div class="btns">
        <button id="btnFindPending">Buscar</button>
        <button class="secondary" id="btnActivate">Activar</button>
      </div>
      <div id="adminRes" class="muted" style="margin-top:10px;"></div>
    </div>
    ` : `
    <div class="card">
      <h3 style="margin:0 0 10px;">🔧 Debug</h3>
      <div class="muted">Tu UID: <b>${uid}</b></div>
    </div>
    `}
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
        el("searchRes").innerHTML = `<span class="warn">⚠️ No encontré esa patente.</span>`;
        return;
      }

      const name = found.name || "(sin nombre)";
      const phone = found.phone || "(sin teléfono)";
      const habitual = found.sector || "(sin sector habitual)";

      // check-in de HOY por patente
      const chk = await getTodayCheckinByPlate(plate);
      const sectorHoy = chk?.sectorToday || null;

      const distinto = (sectorHoy && habitual && sectorHoy.toLowerCase() !== habitual.toLowerCase());

      const msg = `Hola ${name}. Te contacto por Estacionamiento KW: tu vehículo (${plate}) está bloqueando mi salida. ¿Puedes moverlo por favor? Gracias.`;
      const wa = (String(phone).includes("sin") ? null : whatsappLink(phone, msg));

      el("searchRes").innerHTML = `
        <div><b>${name}</b></div>
        <div>📞 ${phone}</div>
        <div>🏥 Sector habitual: <b>${habitual}</b></div>
        ${sectorHoy ? `<div>📍 Check-in hoy: <b>${sectorHoy}</b> ${distinto ? `<span class="warn"> (distinto al habitual)</span>` : ""}</div>` : `<div class="muted">📍 Sin check-in hoy</div>`}
        <div class="muted" style="margin-top:6px;">Patentes: ${(found.plates || []).map(p=>`<span class="pill">${p}</span>`).join("")}</div>
        ${wa ? `<a class="wa" href="${wa}" target="_blank"><button>📲 Enviar WhatsApp</button></a>` : `<div class="warn" style="margin-top:8px;">⚠️ Falta teléfono para WhatsApp.</div>`}
      `;
    } catch (e) {
      console.error(e);
      el("searchRes").innerHTML = `<span class="warn">❌ Error buscando. Revisa Console.</span>`;
    }
  };

  // Check-in (hoy) + TTL
  el("btnCheckin").onclick = async () => {
    const plate = normPlate(el("myPlate").value);
    const sectorToday = (el("mySectorToday").value || "").trim();
    el("checkinRes").textContent = "Guardando check-in...";

    if (!plate || !sectorToday) {
      el("checkinRes").innerHTML = `<span class="warn">⚠️ Falta patente o sector hoy.</span>`;
      return;
    }

    try {
      // 1 check-in por usuario/día (se sobreescribe)
      const id = `${uid}_${today}`;
      await setDoc(doc(db, "checkins", id), {
        uid,
        email,
        plate,
        sectorToday,                 // ✅ lo que el usuario puso HOY
        date: today,
        ts: serverTimestamp(),
        // ✅ TTL: Firestore borrará el doc cuando pase expiresAt (si activas TTL en consola)
        expiresAt: Timestamp.fromDate(endOfToday())
      }, { merge: true });

      el("checkinRes").innerHTML = `<span class="ok">✅ Check-in OK: ${plate} · ${sectorToday}</span>`;
    } catch (e) {
      console.error(e);
      el("checkinRes").innerHTML = `<span class="warn">❌ No pude guardar check-in. Revisa Rules/TTL.</span>`;
    }
  };

  // Bloqueos
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
        ts: serverTimestamp()
      });

      el("blocksRes").innerHTML = `<span class="ok">✅ Bloqueo agregado: ${blockerPlate} → ${blockedPlate}</span>`;
      el("blockedPlate").value = "";
    } catch (e) {
      console.error(e);
      el("blocksRes").innerHTML = `<span class="warn">❌ No pude guardar bloqueo. Revisa Rules.</span>`;
    }
  };

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

      const items = snap.docs.map(d => d.data());
      el("blocksRes").innerHTML = `
        <div class="muted">Bloqueos hoy (${today}):</div>
        ${items.map(it => `<div class="pill">${it.blockerPlate} → <b>${it.blockedPlate}</b></div>`).join("")}
      `;
    } catch (e) {
      console.error(e);
      el("blocksRes").innerHTML = `<span class="warn">❌ Error listando bloqueos.</span>`;
    }
  };

  // Admin: activar
  if (el("btnFindPending")) {
    let pendingUid = null;

    el("btnFindPending").onclick = async () => {
      const em = normEmail(el("pendingEmail").value);
      el("adminRes").textContent = "Buscando...";
      pendingUid = null;

      if (!em) return el("adminRes").textContent = "⚠️ Escribe un email.";

      try {
        const qy = query(collection(db, "users"), where("email", "==", em));
        const snap = await getDocs(qy);
        if (snap.empty) return el("adminRes").textContent = "No encontré ese usuario.";

        const d = snap.docs[0];
        pendingUid = d.id;
        const data = d.data();

        el("adminRes").innerHTML = `
          <div><b>${data.name || em}</b></div>
          <div class="muted">UID: ${pendingUid}</div>
          <div>Estado: <b>${data.estado}</b></div>
          <div class="muted">Patentes: ${(data.plates || []).join(", ")}</div>
          <div class="muted">Sector: ${data.sector || ""}</div>
        `;
      } catch (e) {
        console.error(e);
        el("adminRes").textContent = "❌ Error buscando (Rules?).";
      }
    };

    el("btnActivate").onclick = async () => {
      if (!pendingUid) return el("adminRes").textContent = "⚠️ Primero busca un usuario.";
      el("adminRes").textContent = "Activando...";

      try {
        await updateDoc(doc(db, "users", pendingUid), {
          estado: "activo",
          approvedBy: uid,
          approvedAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        el("adminRes").innerHTML = `<span class="ok">✅ Usuario activado.</span>`;
      } catch (e) {
        console.error(e);
        el("adminRes").textContent = "❌ No pude activar (Rules: OWNER_UIDS).";
      }
    };
  }
}

/** ========= START ========= **/
renderAuthScreen();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    renderAuthScreen();
    return;
  }

  // Cargar perfil
  let profile = null;
  try {
    profile = await getMyUserDoc(user.uid);
  } catch (e) {
    console.error("No pude leer perfil:", e);
  }

  // Si no existe perfil, lo forzamos a “pendiente” (o logout)
  if (!profile) {
    renderPending(user, { name: user.email, estado: "pendiente" });
    return;
  }

  // Gate por estado
  if (profile.estado !== "activo") {
    renderPending(user, profile);
    return;
  }

  renderApp(user, profile);
});
