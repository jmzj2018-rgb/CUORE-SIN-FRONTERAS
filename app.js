// ⚠️ REEMPLAZA ESTA URL CON LA URL DE TU APLICACIÓN WEB DE APPS SCRIPT
const API_URL = "https://script.google.com/macros/s/AKfycbzrmVxXa40QCbtzrB06XlYjblnramZOkF6PqWTIq2-e6ce0TTTQCEhYl5sVqlckmCUC/exec";

let registrosGlobales = [];
let registroSeleccionado = null;
let mascotasModal = [];

window.addEventListener("DOMContentLoaded", () => {
  cargarDatos();
  generarInputsNuevo();
});

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
    const resp = await fetch(API_URL);
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
  const bloque = document.getElementById("filtro-bloque").value;
  const estado = document.getElementById("filtro-estado").value;
  const contenedor = document.getElementById("contenedor-tarjetas");

  const filtrados = registrosGlobales.filter(r => {
    const tieneId = r.idPaciente !== "";
    if (estado === "pendiente" && tieneId) return false;
    if (estado === "atendido" && !tieneId) return false;
    if (bloque && r.bloque !== bloque) return false;

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
    return `
      <div class="card ${atendido ? 'atendido' : 'pendiente'}">
        <div class="card-header">
          <div>
            <strong>${escapeHTML(r.dueno)}</strong>
            <div class="meta">DNI/Doc: ${escapeHTML(r.documento)} • Tel: ${escapeHTML(r.telefono)}</div>
          </div>
          <span class="badge badge-bloque">Bloque ${escapeHTML(r.bloque)}</span>
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

// Separador inteligente basado en Cantidad de Mascotas
function separarNombresMascotas(textoCrudo, cantidad) {
  const limpio = String(textoCrudo || "").trim();
  if (cantidad <= 1) {
    return [limpio || "Mascota 1"];
  }

  // Separa por coma, punto y coma, o " y " (respetando espacios para no cortar nombres como Mayra)
  let partes = limpio
    .split(/\s*[,;]\s*|\s+y\s+/i)
    .map(s => s.trim())
    .filter(s => s.length > 0);

  // Ajustar exactamente a la cantidad declarada por el dueño
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

  document.getElementById("modal-titulo").textContent = `Check-in: ${registroSeleccionado.dueno}`;
  document.getElementById("modal-subtitulo").textContent =
    `Bloque ${registroSeleccionado.bloque} • Declaró ${registroSeleccionado.cantidad} mascota(s). Verifica nombre y especie:`;

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
  // Validar que todas tengan nombre y especie elegida
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

// Lógica para registro presencial directo (sin Forms)
let nuevasMascotas = [];

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
