// ==========================================================
// MÓDULO DE AUTENTICACIÓN (auth.js)
// ==========================================================

const SUPABASE_URL = 'https://ruruabsbkvfbudnqkjby.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1cnVhYnNia3ZmYnVkbnFramJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODk5NTc0MzEsImV4cCI6MjEwNTUzMzQzMX0.7w3de1uogpGtHFUIyh6sO3U0Ad9BU_7CMDVfOy50cxU';

if (typeof supabase !== 'undefined' && !window.supabase) {
    window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// 1. Verificar sesión activa al cargar (Anti-cierre con F5)
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const sesionGuardada = localStorage.getItem('usuario_sesion');
        if (sesionGuardada) {
            const user = JSON.parse(sesionGuardada);
            if (user && user.id) {
                console.log("🟢 Sesión activa detectada en localStorage.");
                const loginWrapper = document.getElementById('auth-login-wrapper');
                const mainContainer = document.getElementById('main-app-container');

                if (loginWrapper) loginWrapper.classList.add('hidden');
                if (mainContainer) mainContainer.classList.remove('hidden');

                if (typeof window.iniciarAplicacionPrincipal === 'function') {
                    window.iniciarAplicacionPrincipal();
                }
            }
        }
    } catch (err) {
        console.error("Error al comprobar la sesión inicial:", err);
    }
});

// 2. Evento de inicio de sesión desde el formulario
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        // Ignorar el símbolo '@' si el usuario lo llega a colocar por error
        const usernameIngresado = document.getElementById('login-usuario').value.trim().replace(/^@/, '');
        const passwordInput = document.getElementById('login-password').value;
        const submitBtn = document.getElementById('btn-login-submit');

        if (submitBtn) {
            submitBtn.textContent = 'Verificando...';
            submitBtn.disabled = true;
        }

        try {
            const client = window.supabase;
            if (!client) throw new Error("Cliente Supabase no disponible.");

            let cuentaUsuario = null;

            // Paso A: Buscar en la tabla 'bancas' (Vendedores y Bancas)
            const { data: bancaData, error: bancaErr } = await client
                .from('bancas')
                .select('*')
                .eq('username', usernameIngresado)
                .eq('password', passwordInput)
                .maybeSingle();

            if (bancaData) {
                cuentaUsuario = bancaData;
            } else {
                // Paso B: Si no está en bancas, buscar en la tabla 'usuarios' (Admins y Supervisores)
                const { data: usuarioData, error: usuarioErr } = await client
                    .from('usuarios')
                    .select('*')
                    .eq('username', usernameIngresado)
                    .eq('password', passwordInput)
                    .maybeSingle();

                if (usuarioData) {
                    cuentaUsuario = usuarioData;
                }
            }

            if (!cuentaUsuario) {
                alert('❌ Usuario o contraseña incorrectos.');
                resetBtn();
                return;
            }

            // Verificar estatus activo
            const estatus = String(cuentaUsuario.estatus || cuentaUsuario.estado || 'activo').toLowerCase();
            if (estatus !== 'activo') {
                alert(`⚠️ Esta cuenta se encuentra ${estatus}. Contacte al administrador.`);
                resetBtn();
                return;
            }

            // Guardar sesión en localStorage
            localStorage.setItem('usuario_sesion', JSON.stringify(cuentaUsuario));

            // Ocultar login y mostrar el contenedor principal del sistema
            const loginWrapper = document.getElementById('auth-login-wrapper');
            const mainContainer = document.getElementById('main-app-container');

            if (loginWrapper) loginWrapper.classList.add('hidden');
            if (mainContainer) mainContainer.classList.remove('hidden');

            if (typeof window.iniciarAplicacionPrincipal === 'function') {
                window.iniciarAplicacionPrincipal();
            } else {
                window.location.reload();
            }

        } catch (err) {
            console.error('Error en el login:', err);
            alert('Ocurrió un error inesperado al iniciar sesión.');
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