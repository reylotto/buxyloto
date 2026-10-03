import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { iniciarAplicacionPrincipal } from './main.js';

const supabase = createClient('https://ruruabsbkvfbudnqkjby.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cnVhYnNia3ZmYnVkbnFramJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5NTc0MzEsImV4cCI6MjEwNTUzMzQzMX0.7w3de1uogpGtHFUIyh6sO3U0Ad9BU_7CMDVfOy50cxU');

window.supabase = supabase;

// ==========================================================
// 1. VERIFICAR SESIÓN ACTIVA AL CARGAR LA PÁGINA (Anti-cierre con F5)
// ==========================================================
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) throw error;

        if (session) {
            console.log("🟢 Sesión activa detectada en el almacenamiento local.");
            const userId = session.user.id;

            // Obtener perfil asociado
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            window.currentUserProfile = profileData || { email: session.user.email };

            // Mostrar el sistema y ocultar el login
            const loginWrapper = document.getElementById('auth-login-wrapper');
            const mainContainer = document.getElementById('main-app-container');

            if (loginWrapper) loginWrapper.classList.add('hidden');
            if (mainContainer) mainContainer.classList.remove('hidden');

            // Iniciar la app
            iniciarAplicacionPrincipal();
        } else {
            console.log("🔒 No hay sesión activa. Se requiere inicio de sesión.");
        }
    } catch (err) {
        console.error("Error al comprobar la sesión inicial:", err);
    }
});

// ==========================================================
// 2. EVENTO DE INICIO DE SESIÓN DESDE EL FORMULARIO
// ==========================================================
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const correoIngresado = document.getElementById('login-usuario').value.trim();
        const passwordInput = document.getElementById('login-password').value;
        const submitBtn = document.getElementById('btn-login-submit');

        if (submitBtn) {
            submitBtn.textContent = 'Verificando...';
            submitBtn.disabled = true;
        }

        try {
            // Inicio de sesión directo con Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email: correoIngresado,
                password: passwordInput
            });

            if (authError) {
                alert('Correo o contraseña incorrectos.');
                resetBtn();
                return;
            }

            // Obtenemos el perfil de la tabla 'profiles'
            const userId = authData.user.id;
            const { data: profileData } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();

            window.currentUserProfile = profileData || { email: correoIngresado };

            // Ocultamos la pantalla de login y mostramos el sistema
            const loginWrapper = document.getElementById('auth-login-wrapper');
            const mainContainer = document.getElementById('main-app-container');

            if (loginWrapper) loginWrapper.classList.add('hidden');
            if (mainContainer) mainContainer.classList.remove('hidden');

            // Activamos todos los módulos conectados
            iniciarAplicacionPrincipal();

        } catch (err) {
            console.error('Error en el login:', err);
            alert('Ocurrió un error inesperado.');
            resetBtn();
        }
    });
}

function resetBtn() {
    const submitBtn = document.getElementById('btn-login-submit');
    if (submitBtn) {
        submitBtn.innerHTML = `<span>Entrar al Sistema</span><i class="fa-solid fa-arrow-right-to-bracket"></i>`;
        submitBtn.disabled = false;
    }
}