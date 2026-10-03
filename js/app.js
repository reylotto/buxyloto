// ==========================================================
// LÓGICA PRINCIPAL DEL SISTEMA (js/app.js)
// ==========================================================
// Memoria para recordar qué alertas de sorteos ya fueron silenciadas
window._sorteosSilenciados = window._sorteosSilenciados || new Set();
// 1. CONFIGURACIÓN E INICIALIZACIÓN DE SUPABASE
const SUPABASE_URL = 'https://ruruabsbkvfbudnqkjby.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cnVhYnNia3ZmYnVkbnFramJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5NTc0MzEsImV4cCI6MjEwNTUzMzQzMX0.7w3de1uogpGtHFUIyh6sO3U0Ad9BU_7CMDVfOy50cxU';

if (typeof supabase !== 'undefined') {
    if (!window.supabase) {
        window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Cliente Supabase inicializado correctamente.');
    }
} else {
    console.error('❌ La librería CDN de Supabase no está cargada en el HTML.');
}

// 2. EVENT LISTENERS E INICIALIZACIÓN AL CARGAR EL DOM
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Aplicación inicializada.');

    // Cargar sorteos y bancas al iniciar
    cargarSorteosActivos();
    renderizarTablaLoterias();
    renderBancasTable();

    // Si existe el módulo de POS (pos.js), inicializar los sorteos de venta
    if (typeof window.renderizarSorteosPOS === 'function') {
        window.renderizarSorteosPOS();
    }

    // Event listener para el formulario de escrutinio/resultados
    const formResultados = document.getElementById('form-registrar-resultados');
    if (formResultados) {
        formResultados.addEventListener('submit', manejarEscrutinioSorteo);
    }

    // Event listener para el formulario de usuarios
    const formUsuario = document.getElementById('form-crear-usuario');
    if (formUsuario) {
        formUsuario.addEventListener('submit', guardarUsuarioSistema);
    }

    // Event listener para el formulario de loterías y sorteos
    const formLoteria = document.getElementById('form-loteria');
    if (formLoteria) {
        formLoteria.addEventListener('submit', guardarLoteriaSorteo);
    }

    // Botones de cerrar modal
    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            const modal = document.getElementById('modal-loteria');
            if (modal) modal.classList.add('hidden');
        });
    });
});

// 3. FUNCIÓN PARA CARGAR LOS SORTEOS Y LOTERÍAS EN LOS DESPLEGABLES
async function cargarSorteosActivos() {
    const selects = [
        document.getElementById('res-sorteo-id'),
        document.getElementById('select-sorteo-escrutinio'),
        document.getElementById('results-loteria-select')
    ].filter(Boolean);

    if (selects.length === 0) return;

    try {
        const supabase = window.supabase;
        if (!supabase) return;

        // Consultar únicamente la tabla 'sorteos' existente
        const { data: resSorteos, error } = await supabase
            .from('sorteos')
            .select('*')
            .neq('estatus', 'inactivo');

        if (error) {
            console.error('Error al obtener sorteos:', error.message);
            return;
        }

        const lista = resSorteos || [];

        selects.forEach(select => {
            select.innerHTML = '<option value="">-- Seleccione un Sorteo / Lotería --</option>';
            if (lista.length > 0) {
                lista.forEach(s => {
                    const option = document.createElement('option');
                    option.value = s.id;
                    const nombre = s.nombre || s.name || s.descripcion || `Sorteo #${s.id}`;
                    const horaInicio = s.hora_apertura || s.openTime || '';
                    const horaFin = s.hora_cierre || s.closeTime || '';
                    const horas = (horaInicio || horaFin) ? ` (${horaInicio} - ${horaFin})` : '';
                    
                    option.textContent = `${nombre}${horas}`;
                    select.appendChild(option);
                });
            }
        });

        console.log(`✅ ${lista.length} sorteos cargados correctamente.`);
    } catch (err) {
        console.error('Error al cargar sorteos activos:', err.message);
    }
}
window.cargarSorteosActivos = cargarSorteosActivos;

// 4. GESTIÓN DE BANCAS Y OPERADORES (TABLA DEDICADA)
async function renderBancasTable() {
    const tbody = document.getElementById('bancas-table-body') || 
                  document.querySelector('#section-bancas tbody');
    if (!tbody) return;

    try {
        const supabase = window.supabase;
        let bancas = [];

        if (supabase) {
            const { data, error } = await supabase.from('bancas').select('*').order('id', { ascending: true });
            if (!error && data) bancas = data;
        }

        tbody.innerHTML = '';

        if (bancas.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center p-4 text-slate-400">No hay bancas registradas en la base de datos.</td></tr>';
            return;
        }

        bancas.forEach(banca => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-800/50 border-b border-slate-700/50 text-xs';
            
            const estatusVal = (banca.status || banca.estado || 'activo').toLowerCase();
            const estadoBadge = estatusVal === 'activo'
                ? '<span class="bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20 font-bold">Activo</span>'
                : '<span class="bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded border border-rose-500/20 font-bold">Inactivo</span>';

            tr.innerHTML = `
                <td class="p-3 font-bold text-white">${banca.nombre || banca.name || 'Sin Nombre'}</td>
                <td class="p-3 text-slate-300 font-semibold">${banca.operador || banca.encargado || 'Sin Asignar'}</td>
                <td class="p-3 text-slate-400 font-mono">${banca.codigo || banca.id || 'N/A'}</td>
                <td class="p-3">${estadoBadge}</td>
                <td class="p-3 text-center space-x-1">
                    <button onclick="cambiarPasswordBanca('${banca.id}')" title="Cambiar Contraseña"
                            class="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-2 py-1 rounded transition-colors text-xs font-semibold">
                        <i class="fa-solid fa-key mr-1"></i> Pass
                    </button>
                    <button onclick="editarBanca('${banca.id}')" title="Editar Banca"
                            class="bg-amber-600/20 hover:bg-amber-600 text-amber-400 hover:text-white px-2 py-1 rounded transition-colors text-xs font-semibold">
                        <i class="fa-solid fa-pen mr-1"></i> Editar
                    </button>
                    <button onclick="toggleEstadoBanca('${banca.id}', '${estatusVal}')" title="Bloquear / Inhabilitar"
                            class="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white px-2 py-1 rounded transition-colors text-xs font-semibold">
                        <i class="fa-solid fa-ban mr-1"></i> ${estatusVal === 'activo' ? 'Bloquear' : 'Activar'}
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Error al renderizar tabla de bancas:", err);
    }
}
window.renderBancasTable = renderBancasTable;

// Funciones de acción para las bancas
window.cambiarPasswordBanca = async function(id) {
    const nuevaPass = prompt("Ingrese la nueva contraseña para la banca:");
    if (!nuevaPass) return;

    try {
        const { error } = await window.supabase
            .from('bancas')
            .update({ password: nuevaPass })
            .eq('id', id);

        if (error) throw error;
        alert('✅ Contraseña actualizada correctamente.');
    } catch (err) {
        alert('❌ Error al actualizar contraseña: ' + err.message);
    }
};

window.editarBanca = async function(id) {
    try {
        const { data: banca, error } = await window.supabase.from('bancas').select('*').eq('id', id).single();
        if (error || !banca) return;

        const nuevoNombre = prompt("Editar Nombre de Banca:", banca.nombre || banca.name || '');
        if (nuevoNombre === null) return;

        const nuevoOperador = prompt("Editar Operador / Encargado:", banca.operador || banca.encargado || '');
        if (nuevoOperador === null) return;

        const { error: updErr } = await window.supabase
            .from('bancas')
            .update({ nombre: nuevoNombre, operador: nuevoOperador })
            .eq('id', id);

        if (updErr) throw updErr;

        alert('✅ Banca actualizada con éxito.');
        await renderBancasTable();
    } catch (err) {
        alert('❌ Error al editar banca: ' + err.message);
    }
};

window.toggleEstadoBanca = async function(id, estatusActual) {
    const nuevoStatus = estatusActual === 'activo' ? 'inactivo' : 'activo';
    try {
        const { error } = await window.supabase
            .from('bancas')
            .update({ status: nuevoStatus, estado: nuevoStatus })
            .eq('id', id);

        if (error) throw error;

        await renderBancasTable();
    } catch (err) {
        alert('❌ Error al cambiar estado de la banca: ' + err.message);
    }
};

// 5. FUNCIÓN MANEJADORA DEL PROCESO DE ESCRUTINIO
async function manejarEscrutinioSorteo(e) {
    e.preventDefault();

    const inputSorteo = document.getElementById('res-sorteo-id') || document.getElementById('select-sorteo-escrutinio') || document.getElementById('results-loteria-select');
    const inputP1 = document.getElementById('res-premio1') || document.getElementById('input-premio-1') || document.getElementById('result-p1');
    const inputP2 = document.getElementById('res-premio2') || document.getElementById('input-premio-2') || document.getElementById('result-p2');
    const inputP3 = document.getElementById('res-premio3') || document.getElementById('input-premio-3') || document.getElementById('result-p3');

    const sorteoId = inputSorteo ? inputSorteo.value : null;
    const p1 = inputP1 ? inputP1.value.trim() : '';
    const p2 = inputP2 ? inputP2.value.trim() : '';
    const p3 = inputP3 ? inputP3.value.trim() : '';

    if (!sorteoId || !p1 || !p2 || !p3) {
        alert('⚠️ Por favor seleccione el sorteo y complete los tres premios ganadores.');
        return;
    }

    const resultadosOficiales = { p1, p2, p3 };

    try {
        if (typeof window.ejecutarEscrutinioSorteo !== 'function') {
            throw new Error('La función window.ejecutarEscrutinioSorteo no está definida en js/escrutinio.js.');
        }

        console.log(`Iniciando escrutinio para el Sorteo ID: ${sorteoId}...`);
        const resumen = await window.ejecutarEscrutinioSorteo(sorteoId, resultadosOficiales);

        alert(`✅ ¡Escrutinio completado con éxito!\n-----------------------------------\n🎟️ Total de Tickets Procesados: ${resumen.procesados}\n🏆 Tickets Ganadores: ${resumen.premiados}`);

        e.target.reset();
        await cargarSorteosActivos();
        await renderizarTablaLoterias();

    } catch (err) {
        console.error('Error al procesar el escrutinio:', err);
        alert(`❌ Ocurrió un error durante el escrutinio: ${err.message}`);
    }
}
window.manejarEscrutinioSorteo = manejarEscrutinioSorteo;

// 6. CREACIÓN Y EDICIÓN DE LOTERÍA / SORTEO
async function guardarLoteriaSorteo(e) {
    e.preventDefault();

    const inputEditId = document.getElementById('loteria-edit-id');
    const editId = inputEditId ? inputEditId.value.trim() : '';

    const nombre = document.getElementById('loteria-name')?.value || '';
    const horaApertura = document.getElementById('loteria-open-time')?.value || '';
    const horaCierre = document.getElementById('loteria-close-time')?.value || '';
    const multiplicador = document.getElementById('loteria-multiplier')?.value || 60;
    const estatus = document.getElementById('loteria-status')?.value || 'activo';

    const diasCheckboxes = document.querySelectorAll('input[name="loteria-days"]:checked');
    const dias = Array.from(diasCheckboxes).map(cb => cb.value);

    if (!nombre) {
        alert('⚠️ Por favor ingrese el nombre de la lotería / sorteo.');
        return;
    }

    try {
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        if (btnSubmit) btnSubmit.disabled = true;

        const payload = {
            nombre: nombre,
            hora_apertura: horaApertura,
            hora_cierre: horaCierre,
            multiplicador: parseFloat(multiplicador),
            estatus: estatus,
            dias: dias
        };

        let res;
        if (editId !== '' && editId !== 'null' && editId !== 'undefined') {
            console.log('🔄 Actualizando sorteo existente ID:', editId);
            res = await window.supabase.from('sorteos').update(payload).eq('id', editId);
        } else {
            console.log('➕ Insertando nuevo sorteo en Supabase...', payload);
            res = await window.supabase.from('sorteos').insert([payload]).select();
        }

        if (res.error) throw res.error;

        alert('✅ ¡Sorteo / Lotería guardado con éxito!');

        e.target.reset();
        if (inputEditId) inputEditId.value = '';

        const modalLoteria = document.getElementById('modal-loteria');
        if (modalLoteria) modalLoteria.classList.add('hidden');

        await cargarSorteosActivos();
        await renderizarTablaLoterias();
        if (typeof window.renderizarSorteosPOS === 'function') {
            await window.renderizarSorteosPOS();
        }

    } catch (err) {
        console.error('❌ Error al guardar sorteo:', err);
        alert('❌ Error de Supabase al guardar: ' + err.message);
    } finally {
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        if (btnSubmit) btnSubmit.disabled = false;
    }
}
window.guardarLoteriaSorteo = guardarLoteriaSorteo;

// 7. FUNCIONES AUXILIARES DE USUARIOS
function cerrarModal() {
    const modal = document.getElementById('modal-crear-usuario');
    if (modal) modal.classList.add('hidden');
}

async function guardarUsuarioSistema(e) {
    e.preventDefault();

    const nombre = document.getElementById('crear-nombre').value;
    const username = document.getElementById('crear-username').value;
    const rol = document.getElementById('crear-rol').value;
    const estatus = document.getElementById('crear-estatus').value;

    try {
        const { error } = await window.supabase
            .from('usuarios')
            .insert([{ nombre, username, rol, estatus }]);

        if (error) throw error;

        alert('✅ Usuario creado correctamente.');
        cerrarModal();
        e.target.reset();
    } catch (err) {
        console.error('Error al guardar usuario:', err.message);
        alert('❌ Error al guardar usuario: ' + err.message);
    }
}
window.guardarUsuarioSistema = guardarUsuarioSistema;

// 8. FUNCIÓN PARA MOSTRAR LOS SORTEOS EN LA TABLA O CONTENEDOR DEL DASHBOARD
async function renderizarTablaLoterias() {
    const tbody = document.getElementById('loterias-table-body');
    const contenedorTarjetas = document.getElementById('contenedor-loterias') || 
                               document.getElementById('lista-sorteos-gestion') || 
                               document.getElementById('grid-sorteos');

    if (!tbody && !contenedorTarjetas) return;

    try {
        const { data: sorteos, error } = await window.supabase
            .from('sorteos')
            .select('*')
            .order('id', { ascending: false });

        if (error) throw error;

        // A. Renderizado en TABLA
        if (tbody) {
            tbody.innerHTML = '';
            if (!sorteos || sorteos.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="text-center p-4 text-slate-400">No hay loterías registradas aún.</td></tr>';
            } else {
                sorteos.forEach(s => {
                    const tr = document.createElement('tr');
                    tr.className = 'hover:bg-slate-800/50';

                    const name = s.nombre || 'Sorteo Sin Nombre';
                    const openTime = s.hora_apertura || '--';
                    const closeTime = s.hora_cierre || '--';
                    const status = (s.estatus || 'activo').toLowerCase();
                    const daysText = (Array.isArray(s.dias) && s.dias.length > 0) ? s.dias.join(', ') : 'Todos';
                    const multiplier = s.multiplicador !== undefined ? s.multiplicador : 60;

                    tr.innerHTML = `
                        <td class="p-3 font-bold text-white">${name}</td>
                        <td class="p-3 font-mono text-emerald-400">${openTime}</td>
                        <td class="p-3 font-mono text-amber-400 font-bold">${closeTime}</td>
                        <td class="p-3 text-slate-300">${daysText}</td>
                        <td class="p-3 font-mono font-bold text-white">x${multiplier}</td>
                        <td class="p-3">
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold ${status === 'activo' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}">
                                ${status.toUpperCase()}
                            </span>
                        </td>
                        <td class="p-3 text-center space-x-1">
                            <button onclick="editLoteria('${s.id}')" class="bg-slate-700 hover:bg-slate-600 text-emerald-400 px-2 py-1 rounded text-xs">
                                <i class="fa-solid fa-pen-to-square"></i> Editar
                            </button>
                            <button onclick="toggleLoteriaStatus('${s.id}', '${status}')" class="bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded text-xs">
                                ${status === 'activo' ? 'Pausar' : 'Activar'}
                            </button>
                            <button onclick="deleteLoteria('${s.id}')" class="bg-slate-700 hover:bg-rose-600 text-rose-400 hover:text-white px-2 py-1 rounded text-xs transition-colors">
                                <i class="fa-solid fa-trash-can"></i>
                            </button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }
        }

        // B. Renderizado en TARJETAS
        if (contenedorTarjetas) {
            contenedorTarjetas.innerHTML = '';
            if (!sorteos || sorteos.length === 0) {
                contenedorTarjetas.innerHTML = '<p class="text-gray-400 p-4 col-span-full text-center">No hay loterías registradas aún.</p>';
            } else {
                sorteos.forEach(sorteo => {
                    const diasTexto = Array.isArray(sorteo.dias) && sorteo.dias.length > 0 ? sorteo.dias.join(', ') : 'Todos los días';
                    const card = document.createElement('div');
                    card.className = 'bg-gray-800 p-4 rounded-lg border border-gray-700 shadow flex flex-col justify-between';
                    card.innerHTML = `
                        <div class="flex justify-between items-center mb-2">
                            <h4 class="font-bold text-white text-lg">${sorteo.nombre}</h4>
                            <span class="px-2 py-1 text-xs font-semibold rounded ${sorteo.estatus === 'activo' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}">
                                ${(sorteo.estatus || 'activo').toUpperCase()}
                            </span>
                        </div>
                        <div class="text-sm text-gray-300 space-y-1 mt-2">
                            <p>🕒 <strong>Apertura - Cierre:</strong> ${sorteo.hora_apertura || '--'} - ${sorteo.hora_cierre || '--'}</p>
                            <p>✖️ <strong>Multiplicador:</strong> x${sorteo.multiplicador || 60}</p>
                            <p class="text-xs text-gray-400 mt-1">📅 <strong>Días:</strong> ${diasTexto}</p>
                        </div>
                    `;
                    contenedorTarjetas.appendChild(card);
                });
            }
        }

    } catch (err) {
        console.error('Error al cargar la lista de loterías:', err.message);
    }
}
window.renderizarTablaLoterias = renderizarTablaLoterias;

// 9. ACCIONES GLOBALES DE SORTEOS
window.editLoteria = async function(id) {
    try {
        const { data: l, error } = await window.supabase.from('sorteos').select('*').eq('id', id).single();
        if (error || !l) return;

        const title = document.getElementById('modal-loteria-title');
        if (title) title.textContent = 'Editar Configuración de Sorteo';

        document.getElementById('loteria-edit-id').value = l.id;
        document.getElementById('loteria-name').value = l.nombre || '';
        document.getElementById('loteria-open-time').value = l.hora_apertura || '';
        document.getElementById('loteria-close-time').value = l.hora_cierre || '';
        document.getElementById('loteria-multiplier').value = l.multiplicador || 60;
        document.getElementById('loteria-status').value = l.estatus || 'activo';

        const cbs = document.querySelectorAll('input[name="loteria-days"]');
        cbs.forEach(cb => {
            cb.checked = Array.isArray(l.dias) ? l.dias.includes(cb.value) : false;
        });

        const modal = document.getElementById('modal-loteria');
        if (modal) modal.classList.remove('hidden');
    } catch (err) {
        console.error('Error al cargar sorteo para edición:', err);
    }
};

window.toggleLoteriaStatus = async function(id, statusActual) {
    const nuevoStatus = statusActual === 'activo' ? 'inactivo' : 'activo';
    try {
        const { error } = await window.supabase
            .from('sorteos')
            .update({ estatus: nuevoStatus })
            .eq('id', id);

        if (error) throw error;

        await cargarSorteosActivos();
        await renderizarTablaLoterias();
        if (typeof window.renderizarSorteosPOS === 'function') {
            await window.renderizarSorteosPOS();
        }
    } catch (err) {
        alert('❌ Error al cambiar estatus: ' + err.message);
    }
};

window.deleteLoteria = async function(id) {
    if (!confirm('¿Está seguro de eliminar este sorteo?')) return;
    try {
        const { error } = await window.supabase
            .from('sorteos')
            .delete()
            .eq('id', id);

        if (error) throw error;

        await cargarSorteosActivos();
        await renderizarTablaLoterias();
        if (typeof window.renderizarSorteosPOS === 'function') {
            await window.renderizarSorteosPOS();
        }
    } catch (err) {
        alert('❌ Error al eliminar el sorteo: ' + err.message);
    }
};

window.openNewLoteriaModal = function() {
    const title = document.getElementById('modal-loteria-title');
    if (title) title.textContent = 'Crear Nuevo Sorteo / Lotería';

    const editId = document.getElementById('loteria-edit-id');
    if (editId) editId.value = '';

    const name = document.getElementById('loteria-name');
    if (name) name.value = '';

    const openTime = document.getElementById('loteria-open-time');
    if (openTime) openTime.value = '08:00';

    const closeTime = document.getElementById('loteria-close-time');
    if (closeTime) closeTime.value = '20:00';

    const mult = document.getElementById('loteria-multiplier');
    if (mult) mult.value = '60';

    const status = document.getElementById('loteria-status');
    if (status) status.value = 'activo';

    const cbs = document.querySelectorAll('input[name="loteria-days"]');
    cbs.forEach(cb => cb.checked = true);

    const modal = document.getElementById('modal-loteria');
    if (modal) modal.classList.remove('hidden');
};
// CARGA Y RENDERING DEL HISTORIAL DE TICKETS CON BOTONES DE ACCIÓN
async function cargarHistorialTickets() {
    const tbody = document.getElementById('tabla-historial-tickets') || 
                  document.getElementById('tickets-table-body') ||
                  document.querySelector('#section-tickets tbody');

    if (!tbody) return;

    try {
        const supabase = window.supabase;
        if (!supabase) return;

        const { data: tickets, error } = await supabase
            .from('tickets')
            .select('*, sorteos(nombre), bancas(nombre)')
            .order('created_at', { ascending: false });

        if (error) throw error;

        tbody.innerHTML = '';

        if (!tickets || tickets.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center p-4 text-slate-400">No hay tickets registrados.</td></tr>';
            return;
        }

        tickets.forEach(t => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-slate-800/50 border-b border-slate-700/50 text-xs';

            const estatus = (t.estatus || t.estado || 'pendiente').toLowerCase();
            let badgeClass = 'bg-amber-500/10 text-amber-400 border-amber-500/20';
            let estatusText = 'PENDIENTE';

            if (estatus === 'premiado' || estatus === 'ganador') {
                badgeClass = 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
                estatusText = `PREMIADO ($${t.premio || t.monto_premio || 0})`;
            } else if (estatus === 'no_premiado' || estatus === 'perdedor') {
                badgeClass = 'bg-slate-500/10 text-slate-400 border-slate-500/20';
                estatusText = 'NO PREMIADO';
            } else if (estatus === 'cancelado' || estatus === 'anulado') {
                badgeClass = 'bg-rose-500/10 text-rose-400 border-rose-500/20';
                estatusText = 'CANCELADO';
            }

            const sorteoNom = t.sorteos ? t.sorteos.nombre : `Sorteo #${t.sorteo_id || ''}`;
            const bancaNom = t.bancas ? t.bancas.nombre : 'Banca General';
            const fecha = t.created_at ? new Date(t.created_at).toLocaleString() : '--';
            const codigoTkt = t.codigo || t.id;

            tr.innerHTML = `
                <td class="p-3 font-mono font-bold text-white">#${codigoTkt}</td>
                <td class="p-3 text-slate-300">${sorteoNom}</td>
                <td class="p-3 text-slate-300">${bancaNom}</td>
                <td class="p-3 font-mono font-bold text-emerald-400">$${Number(t.total || t.monto || 0).toFixed(2)}</td>
                <td class="p-3 text-slate-400 text-[11px]">${fecha}</td>
                <td class="p-3">
                    <span class="px-2 py-0.5 rounded text-[10px] font-bold border ${badgeClass}">
                        ${estatusText}
                    </span>
                </td>
                <td class="p-3 text-center space-x-1">
                    <button onclick="verTicketDetalle('${t.id}')" title="Ver / Imprimir Ticket"
                            class="bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white px-2 py-1 rounded transition-colors text-xs font-semibold">
                        <i class="fa-solid fa-print mr-1"></i> Ver
                    </button>
                    <button onclick="compartirWhatsAppTicket('${t.id}')" title="Compartir por WhatsApp"
                            class="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white px-2 py-1 rounded transition-colors text-xs font-semibold">
                        <i class="fa-brands fa-whatsapp mr-1"></i>
                    </button>
                    ${estatus === 'pendiente' ? `
                    <button onclick="anularTicket('${t.id}')" title="Anular Ticket"
                            class="bg-rose-600/20 hover:bg-rose-600 text-rose-400 hover:text-white px-2 py-1 rounded transition-colors text-xs font-semibold">
                        <i class="fa-solid fa-ban"></i> Anular
                    </button>` : ''}
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (err) {
        console.error("Error al cargar historial de tickets:", err.message);
    }
}

// FUNCIONES DE ACCIÓN PARA LOS TICKETS
window.verTicketDetalle = async function(id) {
    try {
        const { data: t, error } = await window.supabase.from('tickets').select('*, sorteos(nombre)').eq('id', id).single();
        if (error || !t) return alert("No se pudo cargar la información del ticket.");

        let jugadas = t.jugadas;
        if (typeof jugadas === 'string') {
            try { jugadas = JSON.parse(jugadas); } catch (e) { jugadas = []; }
        }

        let textoDetalle = `===========================\n`;
        textoDetalle += `     BUXYLOTO POS - TICKET     \n`;
        textoDetalle += `===========================\n`;
        textoDetalle += `Ticket #: ${t.codigo || t.id}\n`;
        textoDetalle += `Sorteo: ${t.sorteos ? t.sorteos.nombre : t.sorteo_id}\n`;
        textoDetalle += `Fecha: ${new Date(t.created_at).toLocaleString()}\n`;
        textoDetalle += `---------------------------\n`;
        textoDetalle += `JUGADAS:\n`;

        if (Array.isArray(jugadas)) {
            jugadas.forEach(j => {
                textoDetalle += `- ${j.tipo || 'Directo'}: ${j.numero} -> $${Number(j.monto).toFixed(2)}\n`;
            });
        }

        textoDetalle += `---------------------------\n`;
        textoDetalle += `TOTAL: $${Number(t.total || t.monto || 0).toFixed(2)}\n`;
        textoDetalle += `ESTATUS: ${(t.estatus || t.estado || 'PENDIENTE').toUpperCase()}\n`;
        textoDetalle += `===========================`;

        alert(textoDetalle);
    } catch (err) {
        alert("Error al obtener ticket: " + err.message);
    }
};

window.compartirWhatsAppTicket = async function(id) {
    try {
        const { data: t, error } = await window.supabase.from('tickets').select('*, sorteos(nombre)').eq('id', id).single();
        if (error || !t) return alert("No se pudo cargar el ticket.");

        let jugadas = t.jugadas;
        if (typeof jugadas === 'string') {
            try { jugadas = JSON.parse(jugadas); } catch (e) { jugadas = []; }
        }

        let msg = `*BUXYLOTO POS - COMPROBANTE DE JUGADA*%0A`;
        msg += `Ticket: #${t.codigo || t.id}%0A`;
        msg += `Sorteo: ${t.sorteos ? t.sorteos.nombre : t.sorteo_id}%0A`;
        msg += `----------------------------%0A`;
        if (Array.isArray(jugadas)) {
            jugadas.forEach(j => {
                msg += `• ${j.tipo || 'Directo'} *${j.numero}* ($${Number(j.monto).toFixed(2)})%0A`;
            });
        }
        msg += `----------------------------%0A`;
        msg += `*TOTAL: $${Number(t.total || t.monto || 0).toFixed(2)}*%0A`;

        window.open(`https://api.whatsapp.com/send?text=${msg}`, '_blank');
    } catch (err) {
        alert("Error al compartir por WhatsApp: " + err.message);
    }
};

window.anularTicket = async function(id) {
    if (!confirm("¿Está seguro de anular/cancelar este ticket?")) return;

    try {
        const { error } = await window.supabase
            .from('tickets')
            .update({ estatus: 'cancelado', estado: 'cancelado' })
            .eq('id', id);

        if (error) throw error;

        alert("✅ Ticket anulado correctamente.");
        await cargarHistorialTickets();
    } catch (err) {
        alert("❌ Error al anular ticket: " + err.message);
    }
};

window.cargarHistorialTickets = cargarHistorialTickets;
// =================================================================
// 1. CONTROL DE NAVEGACIÓN Y RECARGA DEL DASHBOARD ADMIN
// =================================================================
document.addEventListener('DOMContentLoaded', () => {
    // Buscar botones o enlaces de navegación al Dashboard
    const btnNavDashboard = document.getElementById('nav-dashboard') || document.querySelector('[href="#dashboard"]');
    
    if (btnNavDashboard) {
        btnNavDashboard.addEventListener('click', (e) => {
            e.preventDefault();

            // Ocultar todas las secciones principales y mostrar la del Dashboard
            document.querySelectorAll('main > section, .tab-content').forEach(sec => sec.classList.add('hidden'));
            
            const dashboardSection = document.getElementById('section-dashboard') || document.getElementById('dashboard-view');
            if (dashboardSection) {
                dashboardSection.classList.remove('hidden');
            }

            // Forzar actualización de métricas del Dashboard
            if (typeof window.cargarResumenOperacionesHoy === 'function') {
                window.cargarResumenOperacionesHoy();
            }
            if (typeof window.cargarGridSorteosEnVivo === 'function') {
                window.cargarGridSorteosEnVivo();
            }
        });
    }

    // Vinculación automática del botón de cerrar sesión por ID
    const btnLogout = document.getElementById('btn-logout') || document.getElementById('logout-btn');
    if (btnLogout) {
        btnLogout.addEventListener('click', (e) => {
            e.preventDefault();
            cerrarSesion();
        });
    }
});

// =================================================================
// CIERRE DE SESIÓN DEFINITIVO (MUESTRA LOGIN Y LIMPIA SESIÓN)
// =================================================================
async function cerrarSesion() {
    console.log("🔒 Cerrando sesión...");

    try {
        // 1. Usar los IDs REALES definidos en auth.js
        const loginWrapper = document.getElementById('auth-login-wrapper');
        const mainContainer = document.getElementById('main-app-container');

        // Alternar visibilidad de contenedores inmediatamente
        if (mainContainer) mainContainer.classList.add('hidden');
        if (loginWrapper) loginWrapper.classList.remove('hidden');

        // 2. Cerrar sesión en Supabase
        const client = window.supabaseClient || window.supabase || (typeof window.getSupabaseClient === 'function' ? window.getSupabaseClient() : null);
        if (client && client.auth) {
            await client.auth.signOut();
        }
    } catch (err) {
        console.warn("Aviso durante el cierre de sesión:", err);
    } finally {
        // 3. Borrar llaves de acceso en el navegador
        localStorage.clear();
        sessionStorage.clear();

        // 4. Redirección limpia a la raíz sin parámetros (Evita error 404 en Vercel)
        window.location.href = './';
    }
}

window.cerrarSesion = cerrarSesion;
// ==========================================================
// RECARGA AUTOMÁTICA AL HACER CLIC EN DASHBOARD ADMIN
// ==========================================================
document.addEventListener('DOMContentLoaded', () => {
    // Escuchar clics en botones de navegación hacia el Dashboard
    document.querySelectorAll('[href="#dashboard"], #nav-dashboard, .nav-item-dashboard').forEach(btn => {
        btn.addEventListener('click', () => {
            console.log('🔄 Actualizando pestaña Dashboard Admin...');

            // Forzar la recarga de métricas, gráficos y sorteos
            if (typeof window.cargarResumenOperacionesHoy === 'function') {
                window.cargarResumenOperacionesHoy();
            }
            if (typeof window.cargarHistorialTickets === 'function') {
                window.cargarHistorialTickets();
            }
            if (typeof window.suscribirTiempoReal === 'function') {
                window.suscribirTiempoReal();
            }
        });
    });
});