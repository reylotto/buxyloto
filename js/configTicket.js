// ==========================================================================
// 🎟️ MÓDULO DE PERSONALIZACIÓN DE TICKET (ADMIN)
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

            try {
                const supabase = window.supabaseClient || window.supabase;
                // Actualizamos la fila con ID 1 (siempre usaremos esa única fila)
                const { error } = await supabase
                    .from('configuracion_ticket')
                    .update({ 
                        titulo_empresa: titulo, 
                        icono: icono, 
                        telefono: telefono, 
                        pie_pagina: piePagina 
                    })
                    .eq('id', 1);

                if (error) throw error;
                
                alert('¡Configuración del ticket actualizada correctamente para todas las bancas!');
                
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
        const { data, error } = await supabase
            .from('configuracion_ticket')
            .select('*')
            .eq('id', 1)
            .single();

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