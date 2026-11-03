export async function initTarifasModule() {
    const select = document.getElementById('tarifas-inquilino-select');
    if (!select) return;

    try {
        const supabase = window.supabaseClient || window.supabase;
        const { data: inquilinos } = await supabase.from('inquilinos').select('id, nombre_empresa');
        
        select.innerHTML = '<option value="">-- Elija una empresa --</option>';
        (inquilinos || []).forEach(inq => {
            select.innerHTML += `<option value="${inq.id}">${inq.nombre_empresa}</option>`;
        });
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

        document.getElementById('t-directo').value = config.directo || '';
        document.getElementById('t-pale').value = config.pale || '';
        document.getElementById('t-tripleta').value = config.tripleta || '';
        
        document.getElementById('t-b1').value = config.b1 || '';
        document.getElementById('t-b2').value = config.b2 || '';
        document.getElementById('t-b3').value = config.b3 || '';
        
        document.getElementById('t-c1').value = config.c1 || '';
        document.getElementById('t-c2').value = config.c2 || '';
        document.getElementById('t-c3').value = config.c3 || '';
        
        document.getElementById('t-2pri').value = config.dos_primeras || '';
        document.getElementById('t-2ult').value = config.dos_ultimas || '';
        document.getElementById('t-letras').value = config.letras || '';
    } catch (e) {
        console.error("Error al leer tarifas:", e);
    }
};

window.guardarTarifasInquilino = async function() {
    const inquilinoId = document.getElementById('tarifas-inquilino-select').value;
    if (!inquilinoId) return alert("Seleccione un inquilino primero.");

    const config = {
        directo: document.getElementById('t-directo').value,
        pale: document.getElementById('t-pale').value,
        tripleta: document.getElementById('t-tripleta').value,
        b1: document.getElementById('t-b1').value,
        b2: document.getElementById('t-b2').value,
        b3: document.getElementById('t-b3').value,
        c1: document.getElementById('t-c1').value,
        c2: document.getElementById('t-c2').value,
        c3: document.getElementById('t-c3').value,
        dos_primeras: document.getElementById('t-2pri').value,
        dos_ultimas: document.getElementById('t-2ult').value,
        letras: document.getElementById('t-letras').value
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

// Auto-inicializar
document.addEventListener('DOMContentLoaded', () => {
    const navLinks = document.querySelectorAll('[data-section="section-tarifas"]');
    navLinks.forEach(link => {
        link.addEventListener('click', () => { setTimeout(() => window.initTarifasModule(), 200); });
    });
});