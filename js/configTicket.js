// ==========================================================================
// 🎟️ MÓDULO DE PERSONALIZACIÓN DE TICKET (ADMIN) MULTI-TENANT
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    setTimeout(cargarConfiguracionTicket, 1000);

    const formTicket = document.getElementById('form-ticket-custom');
    if (formTicket) {
        formTicket.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const btnSubmit = formTicket.querySelector('button[type="submit"]');
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
                
                const payload = {
                    titulo_empresa: titulo, 
                    icono: icono, 
                    telefono: telefono, 
                    pie_pagina: piePagina
                };

                if (esInquilino) payload.inquilino_id = inquilinoId;

                let queryCheck = supabase.from('configuracion_ticket').select('id');
                if (esInquilino) {
                    queryCheck = queryCheck.eq('inquilino_id', inquilinoId);
                } else {
                    queryCheck = queryCheck.is('inquilino_id', null);
                }
                
                const { data: existente } = await queryCheck.maybeSingle();

                if (existente && existente.id) {
                    const { error } = await supabase.from('configuracion_ticket').update(payload).eq('id', existente.id);
                    if (error) throw error;
                } else {
                    const { error } = await supabase.from('configuracion_ticket').insert([payload]);
                    if (error) throw error;
                }
                
                alert('¡Configuración del ticket actualizada en la Nube (Supabase)!');
                
            } catch (err) {
                console.error('Error:', err);
                alert('Error al guardar: ' + err.message);
            } finally {
                btnSubmit.innerHTML = 'Guardar Personalización del Ticket';
                btnSubmit.disabled = false;
            }
        });
    }
});

async function cargarConfiguracionTicket() {
    try {
        const supabase = window.supabaseClient || window.supabase;
        let queryConfig = supabase.from('configuracion_ticket').select('*');
        
        const inquilinoId = localStorage.getItem('inquilino_id');
        if (inquilinoId && inquilinoId !== 'null' && String(inquilinoId).trim() !== '') {
            queryConfig = queryConfig.eq('inquilino_id', inquilinoId);
        } else {
            queryConfig = queryConfig.is('inquilino_id', null);
        }

        const { data, error } = await queryConfig.maybeSingle();

        if (data) {
            const inputTitulo = document.getElementById('cfg-ticket-title');
            const inputIcono = document.getElementById('cfg-ticket-icon');
            const inputTel = document.getElementById('cfg-ticket-phone');
            const inputPie = document.getElementById('cfg-ticket-footer');

            if (inputTitulo) inputTitulo.value = data.titulo_empresa || '';
            if (inputIcono) inputIcono.value = data.icono || 'fa-clover';
            if (inputTel) inputTel.value = data.telefono || '';
            if (inputPie) inputPie.value = data.pie_pagina || '';
        }
    } catch (err) {
        console.error("Error cargando ticket:", err);
    }
}
window.cargarConfiguracionTicket = cargarConfiguracionTicket;