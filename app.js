const API_URL = "https://script.google.com/macros/s/AKfycbzrmVxXa40QCbtzrB06XlYjblnramZOkF6PqWTIq2-e6ce0TTTQCEhYl5sVqlckmCUC/exec";

// 🧪 CAMBIA A false EL DÍA DEL EVENTO PARA GUARDAR DE VERDAD EN GOOGLE SHEETS
const MODO_PRUEBA = true;

let registrosGlobales = [];
let registroSeleccionado = null;
let mascotasModal = [];
let nuevasMascotas = [];

window.addEventListener("DOMContentLoaded", () => {
  mostrarBannerPrueba();
  cargarDatos();
  generarInputsNuevo();
});

function mostrarBannerPrueba() {
  if (!MODO_PRUEBA) return;
  const header = document.querySelector("header");
  if (!header) return;
  const banner = document.createElement("div");
  banner.style.cssText =
    "background:#fef3c7; color:#92400e; text-align:center; padding:8px 12px; font-size:0.85rem; font-weight:700; border-bottom:1px solid #f59e0b;";
  banner.textContent = "🧪 MODO PRUEBA ACTIVO: Los turnos simulados NO se guardan en Google Sheets";
  header.insertAdjacentElement("afterend", banner);
}

function cambiarTab(tab) {
  document.getElementById("tab-lista").classList.toggle("active", tab === "lista");
  document.getElementById("tab-nuevo").classList.toggle("active", tab === "nuevo");
  document.getElementById("vista-lista").classList.toggle("hidden", tab !== "lista");
  document.getElementById("vista-nuevo").classList.toggle("hidden", tab !== "nuevo");
}

async function cargarDatos() {
  const contenedor = document.getElementById("contenedor-tarjetas");
  contenedor.innerHTML = "<p>Sincronizando con Google Sheets...</p>";

  try {
    const resp = await fetch(`${API_URL}?t=${Date.now()}`);
    const json = await resp.json();
    if (json.status === "ok") {
      registrosGlobales = json.datos;
      renderizarLista();
    } else {
      contenedor.innerHTML = `<p>Error al leer datos: ${json.mensaje}</p>`;
    }
  } catch (err) {
    contenedor.innerHTML = `<p>Error de conexión. Verifica tu internet o la URL del script.</p>`;
  }
}

function renderizarLista() {
  const texto = document.getElementById("buscador").value.toLowerCase().trim();
  const bloqueFiltro = document.getElementById("filtro-bloque").value;
  const estado = document.getElementById("filtro-estado").value;
  const contenedor = document.getElementById("contenedor-tarjetas");

  const filtrados = registrosGlobales.filter(r => {
    const tieneId = r.idPaciente !== "";
    if (estado === "pendiente" && tieneId) return false;
    if (estado === "atendido" && !tieneId) return false;

    const numBloque = (String(r.bloque || "").match(/\d+/) || [""])[0];
    if (bloqueFiltro && numBloque !== bloqueFiltro) return false;

    if (texto) {
      const cadena = `${r.dueno} ${r.documento} ${r.mascotas} ${r.idPaciente}`.toLowerCase();
      if (!cadena.includes(texto)) return false;
    }
    return true;
  });

  if (filtrados.length === 0) {
    contenedor.innerHTML = "<p>No hay registros que coincidan con el filtro.</p>";
    return;
  }

  contenedor.innerHTML = filtrados.map(r => {
    const atendido = r.idPaciente !== "";
    const numBloque = (String(r.bloque || "").match(/\d+/) || [r.bloque])[0];
    const etiquetaBloque = numBloque ? `B${escapeHTML(numBloque)}` : "Sin bloque";

    return `
      <div class="card ${atendido ? 'atendido' : 'pendiente'}">
        <div class="card-header">
          <div>
            <strong>${escapeHTML(r.dueno)}</strong>
            <div class="meta">DOC: ${escapeHTML(r.documento)} • Tel: ${escapeHTML(r.telefono)}</div>
          </div>
          <span class="badge badge-bloque">${etiquetaBloque}</span>
        </div>
        <div class="meta">
          🐾 <strong>Mascotas (${r.cantidad}):</strong> ${escapeHTML(r.mascotas)}
          ${r.especie ? `• <em>${escapeHTML(r.especie)}</em>` : ""}
        </div>
        ${atendido
          ? `<div style="margin-top:8px"><span class="badge badge-id">Turno: ${escapeHTML(r.idPaciente)}</span></div>`
          : `<button class="btn-primary" onclick="abrirModalCheckin(${r.fila})">Registrar Llegada y Especie</button>`
        }
      </div>
    `;
  }).join("");
}

function separarNombresMascotas(textoCrudo, cantidad) {
  const limpio = String(textoCrudo || "").trim();
  if (cantidad <= 1) {
    return [limpio || "Mascota 1"];
  }

  const partes = limpio
    .split(/\s*[,;]\s*|\s+y\s+/i)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  const resultado = [];
  for (let i = 0; i < cantidad; i++) {
    resultado.push(partes[i] || `Mascota ${i + 1}`);
  }
  return resultado;
}

function abrirModalCheckin(numFila) {
  registroSeleccionado = registrosGlobales.find(r => r.fila === numFila);
  if (!registroSeleccionado) return;

  const nombres = separarNombresMascotas(registroSeleccionado.mascotas, registroSeleccionado.cantidad);
  mascotasModal = nombres.map(n => ({ nombre: n, especie: "" }));

  const numBloque = (String(registroSeleccionado.bloque || "").match(/\d+/) || [registroSeleccionado.bloque])[0];
  document.getElementById("modal-titulo").textContent = `Check-in: ${registroSeleccionado.dueno}`;
  document.getElementById("modal-subtitulo").textContent =
    `Bloque ${numBloque} • Declaró ${registroSeleccionado.cantidad} mascota(s). Verifica nombre y especie:`;

  renderizarMascotasModal();
  document.getElementById("modal-checkin").style.display = "flex";
}

function renderizarMascotasModal() {
  const cont = document.getElementById("modal-mascotas-lista");
  cont.innerHTML = mascotasModal.map((m, idx) => `
    <div class="pet-row">
      <label style="font-size:0.8rem; font-weight:700; color:#475569">Mascota ${idx + 1}</label>
      <input type="text" value="${escapeHTML(m.nombre)}" oninput="mascotasModal[${idx}].nombre = this.value" style="margin-top:4px" />
      <div class="species-group">
        <button type="button" class="species-btn ${m.especie === 'Canino' ? 'selected-canino' : ''}"
          onclick="seleccionarEspecieModal(${idx}, 'Canino')">🐶 Canino</button>
        <button type="button" class="species-btn ${m.especie === 'Felino' ? 'selected-felino' : ''}"
          onclick="seleccionarEspecieModal(${idx}, 'Felino')">🐱 Felino</button>
      </div>
    </div>
  `).join("");
}

function seleccionarEspecieModal(idx, especie) {
  mascotasModal[idx].especie = especie;
  renderizarMascotasModal();
}

function cerrarModal() {
  document.getElementById("modal-checkin").style.display = "none";
  registroSeleccionado = null;
}

async function confirmarCheckin() {
  for (let i = 0; i < mascotasModal.length; i++) {
    if (!mascotasModal[i].nombre.trim()) {
      alert(`Escribe el nombre de la Mascota ${i + 1}`);
      return;
    }
    if (!mascotasModal[i].especie) {
      alert(`Selecciona si "${mascotasModal[i].nombre}" es Canino o Felino`);
      return;
    }
  }

  if (MODO_PRUEBA) {
    const bloqueObj = (String(registroSeleccionado.bloque || "").match(/\d+/) || ["1"])[0];
    let yaAsignados = registrosGlobales.filter(r =>
      (String(r.bloque || "").match(/\d+/) || [""])[0] === bloqueObj && r.idPaciente !== ""
    ).length;

    const simulados = mascotasModal.map(m => {
      yaAsignados++;
      return {
        nombre: m.nombre,
        especie: m.especie,
        id: `B${bloqueObj}-${String(yaAsignados).padStart(2, "0")}`
      };
    });

    const resumen = simulados.map(a => `${a.nombre} (${a.especie}): ${a.id}`).join("\n");
    alert("🧪 [MODO PRUEBA - NO GUARDADO EN SHEETS]\n\nTurnos que se asignarían:\n\n" + resumen);
    cerrarModal();
    return;
  }

  const btn = document.getElementById("btn-confirmar-checkin");
  btn.disabled = true;
  btn.textContent = "Asignando turnos...";

  try {
    const resp = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        accion: "checkin",
        fila: registroSeleccionado.fila,
        mascotas: mascotasModal
      })
    });
    const json = await resp.json();

    if (json.status === "ok") {
      const resumen = json.asignados.map(a => `${a.nombre} (${a.especie}): ${a.id}`).join("\n");
      alert("✅ Turnos asignados:\n\n" + resumen);
      cerrarModal();
      await cargarDatos();
    } else {
      alert("Error: " + json.mensaje);
    }
  } catch (err) {
    alert("Error al enviar datos. Intenta nuevamente.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Asignar ID(s)";
  }
}

function generarInputsNuevo() {
  const cant = Math.max(1, Math.min(10, Number(document.getElementById("nuevo-cantidad").value) || 1));
  nuevasMascotas = Array.from({ length: cant }, (_, i) => ({
    nombre: nuevasMascotas[i]?.nombre || "",
    especie: nuevasMascotas[i]?.especie || ""
  }));
  renderizarInputsNuevo();
}

function renderizarInputsNuevo() {
  const cont = document.getElementById("nuevo-mascotas-container");
  cont.innerHTML = nuevasMascotas.map((m, idx) => `
    <div class="pet-row">
      <label style="font-size:0.8rem; font-weight:700; color:#475569">Nombre Mascota ${idx + 1}</label>
      <input type="text" placeholder="Ej: Firulais" value="${escapeHTML(m.nombre)}"
        oninput="nuevasMascotas[${idx}].nombre = this.value" style="margin-top:4px" />
      <div class="species-group">
        <button type="button" class="species-btn ${m.especie === 'Canino' ? 'selected-canino' : ''}"
          onclick="nuevasMascotas[${idx}].especie='Canino'; renderizarInputsNuevo()">🐶 Canino</button>
        <button type="button" class="species-btn ${m.especie === 'Felino' ? 'selected-felino' : ''}"
          onclick="nuevasMascotas[${idx}].especie='Felino'; renderizarInputsNuevo()">🐱 Felino</button>
      </div>
    </div>
  `).join("");
}

async function guardarNuevoPresencial() {
  const dueno = document.getElementById("nuevo-dueno").value.trim();
  const documento = document.getElementById("nuevo-doc").value.trim();
  const telefono = document.getElementById("nuevo-tel").value.trim();
  const bloque = document.getElementById("nuevo-bloque").value;

  if (!dueno) { alert("Ingresa el nombre del dueño"); return; }

  for (let i = 0; i < nuevasMascotas.length; i++) {
    if (!nuevasMascotas[i].nombre.trim() || !nuevasMascotas[i].especie) {
      alert(`Completa nombre y especie para la Mascota ${i + 1}`);
      return;
    }
  }

  if (MODO_PRUEBA) {
    let yaAsignados = registrosGlobales.filter(r =>
      (String(r.bloque || "").match(/\d+/) || [""])[0] === bloque && r.idPaciente !== ""
    ).length;

    const simulados = nuevasMascotas.map(m => {
      yaAsignados++;
      return {
        nombre: m.nombre,
        especie: m.especie,
        id: `B${bloque}-${String(yaAsignados).padStart(2, "0")}`
      };
    });

    const resumen = simulados.map(a => `${a.nombre} (${a.especie}): ${a.id}`).join("\n");
    alert("🧪 [MODO PRUEBA - NO GUARDADO EN SHEETS]\n\nPacientes que se crearían:\n\n" + resumen);
    return;
  }

  const btn = document.getElementById("btn-guardar-nuevo");
  btn.disabled = true;
  btn.textContent = "Registrando...";

  try {
    const resp = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify({
        accion: "nuevo",
        dueno,
        documento,
        telefono,
        bloque,
        mascotas: nuevasMascotas
      })
    });
    const json = await resp.json();

    if (json.status === "ok") {
      const resumen = json.asignados.map(a => `${a.nombre} (${a.especie}): ${a.id}`).join("\n");
      alert("✅ Paciente(s) registrado(s):\n\n" + resumen);
      document.getElementById("nuevo-dueno").value = "";
      document.getElementById("nuevo-doc").value = "";
      document.getElementById("nuevo-tel").value = "";
      document.getElementById("nuevo-cantidad").value = "1";
      nuevasMascotas = [];
      generarInputsNuevo();
      cambiarTab("lista");
      await cargarDatos();
    } else {
      alert("Error: " + json.mensaje);
    }
  } catch (err) {
    alert("Error de conexión al guardar.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Registrar y Generar ID(s)";
  }
}

function escapeHTML(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
