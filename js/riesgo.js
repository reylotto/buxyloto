// --- MÓDULO CONTROL DE RIESGO Y RESTRICCIONES POR BANCA (js/riesgo.js) ---

export function initRiesgoModule() {
    console.log("Módulo Control de Riesgo inicializado.");
    cargarConfiguracionGlobalRiesgo();
    cargarSelectorBancasRiesgo();
    cargarSelectorLoteriasRiesgo();
    
    // Listener para cambio de banca seleccionada en el selector
    const selectBanca = document.getElementById('select-banca-riesgo');
    if (selectBanca) {
        selectBanca.addEventListener('change', (e) => {
            const bancaId = e.target.value;
            cargarRestriccionesBancaRiesgo(bancaId);
        });
    }

    // Listener para guardar tope global dinámico
    const formGlobal = document.getElementById('form-riesgo-global');
    if (formGlobal) {
        formGlobal.addEventListener('submit', async (e) => {
            e.preventDefault();
            await guardarTopeGlobalRiesgo();
        });
    }

    // Listener para agregar nueva restricción individual
    const formIndividual = document.getElementById('form-nueva-restriccion-riesgo');
    if (formIndividual) {
        formIndividual.addEventListener('submit', async (e) => {
            e.preventDefault();
            await guardarRestriccionIndividualRiesgo();
        });
    }
}

// 1. Cargar y guardar el Tope Global
export async function cargarConfiguracionGlobalRiesgo() {
    const inputTopeGlobal = document.getElementById('input-tope-global-riesgo');
    if (!inputTopeGlobal) return;
    const supabase = window.supabase;
    if (!supabase) return;

    try {
        const { data, error } = await supabase.from('configuracion_riesgo_global').select('*').eq('id', 1).maybeSingle();
        if (error) throw error;
        if (data && data.limite_venta_global) inputTopeGlobal.value = data.limite_venta_global;
        else inputTopeGlobal.value = '';
    } catch (err) {
        console.warn("Aviso al consultar tope global:", err.message);
    }
}

async function guardarTopeGlobalRiesgo() {
    const inputTopeGlobal = document.getElementById('input-tope-global-riesgo');
    const valorRaw = inputTopeGlobal?.value;
    if (valorRaw === '' || valorRaw === undefined) return alert("Por favor ingrese el monto del tope global.");

    const valor = parseFloat(valorRaw);
    const supabase = window.supabase;
    if (!supabase) return;

    try {
        const { error } = await supabase.from('configuracion_riesgo_global').upsert({ id: 1, limite_venta_global: valor, updated_at: new Date() });
        if (error) throw error;
        alert("✅ Tope de riesgo global actualizado correctamente.");
    } catch (err) {
        alert("❌ Error al guardar tope global: " + err.message);
    }
}

// 2. Cargar Bancas (Añadiendo opción GLOBAL)
export async function cargarSelectorBancasRiesgo() {
    const selectBanca = document.getElementById('select-banca-riesgo');
    if (!selectBanca) return;
    const supabase = window.supabase;
    if (!supabase) return;

    try {
        // 🔥 FILTRO MULTI-TENANT INYECTADO
        let queryBancas = supabase.from('bancas').select('*').order('id', { ascending: false });
        const inquilinoId = localStorage.getItem('inquilino_id');
        if (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined') {
            queryBancas = queryBancas.eq('inquilino_id', inquilinoId);
        }

        const { data: bancas, error } = await queryBancas;
        if (error) throw error;

        selectBanca.innerHTML = opcionesHTML;
    } catch (err) {
        console.error("Error al cargar selector de bancas:", err);
    }
}

// 3. Cargar Loterias desde BD
export async function cargarSelectorLoteriasRiesgo() {
    const selectLoteria = document.getElementById('select-loteria-riesgo');
    if (!selectLoteria) return;
    const supabase = window.supabase;
    if (!supabase) return;

    try {
        // Consultar la tabla de sorteos, asegurándonos de que traiga los datos correctamente
        const { data: sorteos, error } = await supabase.from('sorteos').select('*').order('id', { ascending: true });
        if (error) throw error;

        let opcionesHTML = `<option value="TODAS">-- Todas las Loterías --</option>`;
        if (sorteos && sorteos.length > 0) {
            // Utilizamos 'nombre' o 'nombre_sorteo' dependiendo de cuál exista en tu tabla
            const nombresUnicos = [...new Set(sorteos.map(s => String(s.nombre || s.nombre_sorteo || 'Desconocido').toUpperCase().trim()))];
            nombresUnicos.forEach(nombre => {
                 if (nombre !== 'DESCONOCIDO') {
                    opcionesHTML += `<option value="${nombre}">${nombre}</option>`;
                 }
            });
        }
        selectLoteria.innerHTML = opcionesHTML;
    } catch (err) {
        console.error("Error al cargar loterías en riesgo:", err);
    }
}

// 4. Cargar Restricciones de la banca en la tabla
export async function cargarRestriccionesBancaRiesgo(bancaId) {
    const contenedor = document.getElementById('tabla-restricciones-riesgo-body');
    if (!contenedor) return;
    if (!bancaId) {
        contenedor.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">Seleccione una banca para consultar sus reglas.</td></tr>`;
        return;
    }

    contenedor.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Cargando restricciones...</td></tr>`;
    const supabase = window.supabase;
    if (!supabase) return;

    try {
        const { data, error } = await supabase.from('restricciones_vendedor').select('*').eq('banca_id', String(bancaId)).order('id', { ascending: false });
        if (error) throw error;

        if (!data || data.length === 0) {
            contenedor.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-500 italic">No hay restricciones configuradas para esta banca.</td></tr>`;
            return;
        }

        contenedor.innerHTML = data.map(r => `
            <tr class="hover:bg-slate-800/50 transition border-b border-slate-700/30 text-xs">
                <td class="p-3 font-bold text-slate-300 uppercase">${r.loteria || 'TODAS'}</td>
                <td class="p-3 font-bold text-cyan-400 uppercase">${r.tipo_jugada}</td>
                <td class="p-3 font-mono font-bold text-amber-400">${r.numero_especifico}</td>
                <td class="p-3 font-mono font-bold text-emerald-400">$${Number(r.monto_maximo).toFixed(2)}</td>
                <td class="p-3">
                    <span class="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded-full text-[10px] font-bold">Activa</span>
                </td>
                <td class="p-3 text-center">
                    <button onclick="window.eliminarRestriccionRiesgo('${r.id}', '${bancaId}')" class="p-1.5 hover:bg-rose-500/20 text-rose-400 rounded transition" title="Eliminar regla">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        console.error("Error al cargar reglas:", err);
        contenedor.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-rose-400">Error al cargar reglas de riesgo.</td></tr>`;
    }
}

// 5. Guardar Restricción Individual
async function guardarRestriccionIndividualRiesgo() {
    const bancaId = document.getElementById('select-banca-riesgo')?.value;
    const loteria = document.getElementById('select-loteria-riesgo')?.value || 'TODAS';
    const tipoJugada = document.getElementById('select-tipo-jugada-riesgo')?.value || 'todos';
    const numeroEspecifico = document.getElementById('input-numero-especifico-riesgo')?.value.trim() || '*';
    const montoMaximoInput = document.getElementById('input-monto-maximo-riesgo')?.value;

    if (!bancaId) return alert("Por favor seleccione una banca o vendedor.");
    if (montoMaximoInput === '' || parseFloat(montoMaximoInput) < 0) return alert("Ingrese un monto máximo válido.");

    const montoMaximo = parseFloat(montoMaximoInput);
    const supabase = window.supabase;
    if (!supabase) return;

    try {
        const { error } = await supabase.from('restricciones_vendedor').insert([{
            banca_id: String(bancaId),
            loteria: loteria,
            tipo_jugada: tipoJugada,
            numero_especifico: numeroEspecifico,
            monto_maximo: montoMaximo,
            estado: 'activo'
        }]);

        if (error) throw error;
        alert("✅ Restricción individual guardada con éxito.");
        
        document.getElementById('input-numero-especifico-riesgo').value = '*';
        document.getElementById('input-monto-maximo-riesgo').value = '';
        
        await cargarRestriccionesBancaRiesgo(bancaId);
    } catch (err) {
        alert("❌ Error al guardar restricción: " + err.message);
    }
}

// 6. Eliminar Restricción
window.eliminarRestriccionRiesgo = async function(idRestriccion, bancaId) {
    if (!confirm("¿Desea eliminar esta regla de restricción?")) return;
    const supabase = window.supabase;
    if (!supabase) return;

    try {
        const { error } = await supabase.from('restricciones_vendedor').delete().eq('id', idRestriccion);
        if (error) throw error;
        await cargarRestriccionesBancaRiesgo(bancaId);
    } catch (err) {
        alert("Error al eliminar regla: " + err.message);
    }
};

window.initRiesgoModule = initRiesgoModule;