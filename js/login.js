import { createClient } from '@supabase/supabase-js';

// Tus credenciales de Supabase
const supabaseUrl = 'https://ruruabsbkvfbudnqkjby.supabase.co'; 
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'; // (Asegúrate de poner tu llave anon real)
const supabase = createClient(supabaseUrl, supabaseKey);

document.addEventListener('DOMContentLoaded', () => {
    const formLogin = document.getElementById('login-form'); // Coincide con tu HTML
    
    if (formLogin) {
        formLogin.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const usuarioInput = document.getElementById('login-usuario').value.trim();
            const password = document.getElementById('login-password').value.trim();

            try {
                // 1. Buscamos primero en tu tabla 'usuarios' para ver si ingresó un nombre de usuario o un correo
                const { data: userData, error: userError } = await supabase
                    .from('usuarios')
                    .select('email, inquilino_id, username, rol') // 🔥 Ajustado a tus columnas reales
                    .or(`email.eq.${usuarioInput},username.eq.${usuarioInput}`) // 🔥 Ajustado a username
                    .single();

                if (userError || !userData) {
                    throw new Error('El usuario o banca no existe en el sistema.');
                }

                // 2. Autenticar en Supabase Auth usando el correo electrónico encontrado
                const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                    email: userData.email,
                    password: password
                });

                if (authError) throw new Error('Contraseña incorrecta.');

                if (!userData.inquilino_id) {
                    throw new Error('Este usuario no tiene un inquilino (banca) asignado.');
                }

                // 3. Guardar el inquilino_id y los datos del usuario en el navegador
                localStorage.setItem('inquilino_id', userData.inquilino_id);
                localStorage.setItem('usuario_actual', JSON.stringify(userData));

                // 4. Ocultar el login y mostrar la aplicación principal (o recargar)
                window.location.reload(); 

            } catch (error) {
                alert('Error de acceso: ' + error.message);
            }
        });
    }
});