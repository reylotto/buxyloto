// ==========================================================================
// 🎟️ MÓDULO DE PERSONALIZACIÓN DE TICKET (ADMIN) MULTI-TENANT
// ==========================================================================

window.guardarConfiguracionTicket = async function(e) {
    if (e) e.preventDefault();
    
    const btnSubmit = e.currentTarget;
    const textoOriginal = btnSubmit.innerHTML;
    btnSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    btnSubmit.disabled = true;

    const titulo = document.getElementById('cfg-ticket-title').value;
    const icono = document.getElementById('cfg-ticket-icon').value;
    const telefono = document.getElementById('cfg-ticket-phone').value;
    const piePagina = document.getElementById('cfg-ticket-footer').value;
    
    const inquilinoId = localStorage.getItem('inquilino_id');
    const esInquilino = (inquilinoId && inquilinoId !== 'null' && String(inquilinoId).trim() !== '');

    try {
        const supabase = window.supabaseClient || window.supabase;
        if (!supabase) throw new Error("Supabase no está conectado.");
        
        const payload = { titulo_empresa: titulo, icono: icono, telefono: telefono, pie_pagina: piePagina };
        if (esInquilino) payload.inquilino_id = inquilinoId;

        let queryCheck = supabase.from('configuracion_ticket').select('id');
        queryCheck = esInquilino ? queryCheck.eq('inquilino_id', inquilinoId) : queryCheck.is('inquilino_id', null);
        
        const { data: existente } = await queryCheck.maybeSingle();

        if (existente && existente.id) {
            const { error } = await supabase.from('configuracion_ticket').update(payload).eq('id', existente.id);
            if (error) throw error;
        } else {
            const { error } = await supabase.from('configuracion_ticket').insert([payload]);
            if (error) throw error;
        }
        
        alert('✅ ¡Configuración del ticket actualizada en la Nube (Supabase)!');
    } catch (err) {
        console.error('Error:', err);
        alert('❌ Error al guardar: ' + err.message);
    } finally {
        btnSubmit.innerHTML = textoOriginal;
        btnSubmit.disabled = false;
    }
};

window.cargarConfiguracionTicket = async function() {
    try {
        const supabase = window.supabaseClient || window.supabase;
        if (!supabase) return;
        
        let queryConfig = supabase.from('configuracion_ticket').select('*');
        const inquilinoId = localStorage.getItem('inquilino_id');
        
        queryConfig = (inquilinoId && inquilinoId !== 'null' && String(inquilinoId).trim() !== '') 
            ? queryConfig.eq('inquilino_id', inquilinoId) 
            : queryConfig.is('inquilino_id', null);

        const { data } = await queryConfig.maybeSingle();

        if (data) {
            if (document.getElementById('cfg-ticket-title')) document.getElementById('cfg-ticket-title').value = data.titulo_empresa || '';
            if (document.getElementById('cfg-ticket-icon')) document.getElementById('cfg-ticket-icon').value = data.icono || 'fa-clover';
            if (document.getElementById('cfg-ticket-phone')) document.getElementById('cfg-ticket-phone').value = data.telefono || '';
            if (document.getElementById('cfg-ticket-footer')) document.getElementById('cfg-ticket-footer').value = data.pie_pagina || '';
        }
    } catch (err) {
        console.error("Error cargando ticket:", err);
    }
};

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(window.cargarConfiguracionTicket, 1000);
});