export async function initTarifasModule() {
    const select = document.getElementById('tarifas-inquilino-select');
    const form = document.getElementById('tarifas-formulario');
    if (!select || !form) return;

    try {
        const supabase = window.supabaseClient || window.supabase;
        const inquilinoId = localStorage.getItem('inquilino_id');
        const esInquilino = (inquilinoId && inquilinoId !== 'null' && String(inquilinoId).trim() !== '');

        if (esInquilino) {
            // LÓGICA INQUILINO: Oculta el selector y carga su propio formulario directo
            select.style.display = 'none';
            if (select.previousElementSibling) select.previousElementSibling.style.display = 'none'; // Oculta el label
            
            select.innerHTML = `<option value="${inquilinoId}" selected>Mi Empresa</option>`;
            await window.cargarTarifasInquilino();
        } else {
            // LÓGICA MAESTRO: Muestra el selector y busca todas las empresas
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
        const { data } = await supabase.from('inquilinos').select('config_premios').eq('id', inquilinoId).single();
        const config = data?.config_premios || {};

        // Extranjeras
        document.getElementById('t-dir-1').value = config.dir1 || '';
        document.getElementById('t-dir-2').value = config.dir2 || '';
        document.getElementById('t-dir-3').value = config.dir3 || '';
        document.getElementById('t-pale-1').value = config.pale1 || '';
        document.getElementById('t-pale-2').value = config.pale2 || '';
        document.getElementById('t-trip-3').value = config.trip3 || '';
        document.getElementById('t-trip-2').value = config.trip2 || '';
        
        // LNB Básicos
        document.getElementById('t-b1').value = config.b1 || '';
        document.getElementById('t-b2').value = config.b2 || '';
        document.getElementById('t-b3').value = config.b3 || '';
        document.getElementById('t-c1').value = config.c1 || '';
        document.getElementById('t-c2').value = config.c2 || '';
        document.getElementById('t-c3').value = config.c3 || '';

        // LNB Tres Cifras
        document.getElementById('t-3p1').value = config.tp1 || '';
        document.getElementById('t-3p2').value = config.tp2 || '';
        document.getElementById('t-3p3').value = config.tp3 || '';
        document.getElementById('t-3u1').value = config.tu1 || '';
        document.getElementById('t-3u2').value = config.tu2 || '';
        document.getElementById('t-3u3').value = config.tu3 || '';

        // LNB Dos Cifras
        document.getElementById('t-2p1').value = config.dp1 || '';
        document.getElementById('t-2p2').value = config.dp2 || '';
        document.getElementById('t-2p3').value = config.dp3 || '';
        document.getElementById('t-2u1').value = config.du1 || '';
        document.getElementById('t-2u2').value = config.du2 || '';
        document.getElementById('t-2u3').value = config.du3 || '';

    } catch (e) {
        console.error("Error al leer tarifas:", e);
    }
};

window.guardarTarifasInquilino = async function() {
    const inquilinoId = document.getElementById('tarifas-inquilino-select').value;
    if (!inquilinoId) return alert("Seleccione un inquilino primero.");

    const config = {
        dir1: document.getElementById('t-dir-1').value,
        dir2: document.getElementById('t-dir-2').value,
        dir3: document.getElementById('t-dir-3').value,
        pale1: document.getElementById('t-pale-1').value,
        pale2: document.getElementById('t-pale-2').value,
        trip3: document.getElementById('t-trip-3').value,
        trip2: document.getElementById('t-trip-2').value,
        b1: document.getElementById('t-b1').value,
        b2: document.getElementById('t-b2').value,
        b3: document.getElementById('t-b3').value,
        c1: document.getElementById('t-c1').value,
        c2: document.getElementById('t-c2').value,
        c3: document.getElementById('t-c3').value,
        tp1: document.getElementById('t-3p1').value,
        tp2: document.getElementById('t-3p2').value,
        tp3: document.getElementById('t-3p3').value,
        tu1: document.getElementById('t-3u1').value,
        tu2: document.getElementById('t-3u2').value,
        tu3: document.getElementById('t-3u3').value,
        dp1: document.getElementById('t-2p1').value,
        dp2: document.getElementById('t-2p2').value,
        dp3: document.getElementById('t-2p3').value,
        du1: document.getElementById('t-2u1').value,
        du2: document.getElementById('t-2u2').value,
        du3: document.getElementById('t-2u3').value
    };

    try {
        const supabase = window.supabaseClient || window.supabase;
        const { error } = await supabase.from('inquilinos').update({ config_premios: config }).eq('id', inquilinoId);
        
        if (error) throw error;
        alert("✅ Tarifas personalizadas guardadas con éxito.");
    } catch (e) {
        alert("❌ Error al guardar las tarifas: " + e.message);
    }
};

// Auto-inicializar corrigiendo el selector data-target
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('[data-target="section-tarifas"], [data-section="section-tarifas"]');
    navLinks.forEach(link => {
        link.addEventListener('click', () => { setTimeout(() => window.initTarifasModule(), 200); });
    });
});