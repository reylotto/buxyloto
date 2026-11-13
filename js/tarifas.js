export async function initTarifasModule() {
    const select = document.getElementById('tarifas-inquilino-select');
    const form = document.getElementById('tarifas-formulario');
    if (!select || !form) return;

    try {
        const supabase = window.supabaseClient || window.supabase;
        const inquilinoId = localStorage.getItem('inquilino_id');
        const esInquilino = (inquilinoId && inquilinoId !== 'null' && String(inquilinoId).trim() !== '');

        if (esInquilino) {
            select.style.display = 'none';
            if (select.previousElementSibling) select.previousElementSibling.style.display = 'none'; 
            
            select.innerHTML = `<option value="${inquilinoId}" selected>Mi Empresa</option>`;
            await window.cargarTarifasInquilino();
        } else {
            select.style.display = 'block';
            if (select.previousElementSibling) select.previousElementSibling.style.display = 'block';
            
            const { data: inquilinos, error } = await supabase.from('inquilinos').select('id, nombre_empresa');
            if (error) throw error;
            
            select.innerHTML = '<option value="">-- Elija una empresa --</option>';
            (inquilinos || []).forEach(inq => {
                select.innerHTML += `<option value="${inq.id}">${inq.nombre_empresa}</option>`;
            });
            form.classList.add('hidden');
        }
    } catch (e) {
        console.error("Error al cargar inquilinos:", e);
    }
}
window.initTarifasModule = initTarifasModule;

window.cargarTarifasInquilino = async function() {
    const inquilinoId = document.getElementById('tarifas-inquilino-select').value;
    const form = document.getElementById('tarifas-formulario');
    
    if (!inquilinoId) {
        form.classList.add('hidden');
        return;
    }
    form.classList.remove('hidden');
    
    try {
        const supabase = window.supabaseClient || window.supabase;
        
        // Buscar las tarifas extranjeras del inquilino seleccionado en la nueva tabla
        const { data: tarifaExt } = await supabase
            .from('tarifas_inquilinos')
            .select('*')
            .eq('inquilino_id', inquilinoId)
            .eq('tipo_loteria', 'extranjera')
            .maybeSingle();

        // Extranjeras (Si no hay datos, muestra vacío para que aplique el default del sistema)
        document.getElementById('t-dir-1').value = tarifaExt?.pago_directo_1 || '';
        document.getElementById('t-dir-2').value = tarifaExt?.pago_directo_2 || '';
        document.getElementById('t-dir-3').value = tarifaExt?.pago_directo_3 || '';
        document.getElementById('t-pale-1').value = tarifaExt?.pago_pale_1_2 || ''; // 1ro con 2do
        document.getElementById('t-pale-2').value = tarifaExt?.pago_pale_2_3 || ''; // 2do con 3ro
        
        // (La lógica para cargar Lotería Nacional y Tripletas iría aquí cuando expandamos la tabla SQL)

    } catch (e) {
        console.error("Error al leer tarifas:", e);
    }
};

window.guardarTarifasInquilino = async function() {
    const inquilinoId = document.getElementById('tarifas-inquilino-select').value;
    if (!inquilinoId) return alert("Seleccione un inquilino primero.");

    const btn = document.querySelector('button[onclick="window.guardarTarifasInquilino()"]') || event?.target;
    if (btn) btn.disabled = true;

    try {
        const supabase = window.supabaseClient || window.supabase;

        // Leer valores extranjeras del HTML (Si están vacíos, se enviará nulo para que el SQL use el default)
        const vDir1 = document.getElementById('t-dir-1').value;
        const vDir2 = document.getElementById('t-dir-2').value;
        const vDir3 = document.getElementById('t-dir-3').value;
        const vPale1 = document.getElementById('t-pale-1').value;
        const vPale2 = document.getElementById('t-pale-2').value;

        const payloadExtranjera = {
            inquilino_id: inquilinoId,
            tipo_loteria: 'extranjera',
            pago_directo_1: vDir1 ? parseFloat(vDir1) : null,
            pago_directo_2: vDir2 ? parseFloat(vDir2) : null,
            pago_directo_3: vDir3 ? parseFloat(vDir3) : null,
            pago_pale_1_2: vPale1 ? parseFloat(vPale1) : null,
            pago_pale_1_3: vPale1 ? parseFloat(vPale1) : null, // Se paga igual que 1ro con 2do
            pago_pale_2_3: vPale2 ? parseFloat(vPale2) : null,
            updated_at: new Date().toISOString()
        };

        // Guardar en la nueva tabla matemática
        const { error } = await supabase
            .from('tarifas_inquilinos')
            .upsert(payloadExtranjera, { onConflict: 'inquilino_id,tipo_loteria' });
        
        if (error) throw error;
        alert("✅ Tarifas de Lotería Extranjera guardadas con éxito y vinculadas al Escrutinio.");
    } catch (e) {
        alert("❌ Error al guardar las tarifas: " + e.message);
    } finally {
        if (btn) btn.disabled = false;
    }
};

// Auto-inicializar
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('[data-target="section-tarifas"], [data-section="section-tarifas"]');
    navLinks.forEach(link => {
        link.addEventListener('click', () => { setTimeout(() => window.initTarifasModule(), 200); });
    });
});