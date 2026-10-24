// ==========================================================================
// 🎟️ MÓDULO DE PERSONALIZACIÓN DE TICKET (ADMIN) MULTI-TENANT
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
    // Retraso ligero para asegurar que Supabase esté conectado
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
            
            // 🔥 OBTENEMOS EL INQUILINO
            const inquilinoId = localStorage.getItem('inquilino_id');

            try {
                const supabase = window.supabaseClient || window.supabase;
                
                const payload = {
                    titulo_empresa: titulo, 
                    icono: icono, 
                    telefono: telefono, 
                    pie_pagina: piePagina,
                    inquilino_id: inquilinoId // VINCULACIÓN AL TENANT
                };

                // 1. Verificamos si este inquilino ya tiene una configuración guardada
                let queryCheck = supabase.from('configuracion_ticket').select('id');
                if (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined') {
                    queryCheck = queryCheck.eq('inquilino_id', inquilinoId);
                }
                const { data: existente } = await queryCheck.maybeSingle();

                let resError = null;

                // 2. Si ya existe, actualizamos su fila. Si no, creamos una nueva.
                if (existente && existente.id) {
                    const { error } = await supabase.from('configuracion_ticket').update(payload).eq('id', existente.id);
                    resError = error;
                } else {
                    const { error } = await supabase.from('configuracion_ticket').insert([payload]);
                    resError = error;
                }

                if (resError) throw resError;
                
                alert('¡Configuración del ticket actualizada correctamente para tu empresa!');
                
            } catch (err) {
                console.error('Error al guardar config de ticket:', err);
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
        
        // 🔥 ESCUDO MULTI-TENANT: CONFIGURACIÓN DE TICKET
        const inquilinoId = localStorage.getItem('inquilino_id');
        if (inquilinoId && inquilinoId !== 'null' && inquilinoId !== 'undefined') {
            queryConfig = queryConfig.eq('inquilino_id', inquilinoId);
        }

        // Usamos maybeSingle() para evitar error si la empresa nueva aún no guarda su primer diseño
        const { data, error } = await queryConfig.maybeSingle();

        if (error) throw error;

        if (data) {
            // Llenar el formulario del admin
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
        console.error("Error cargando la configuración del ticket:", err);
    }
}