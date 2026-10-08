// ==========================================================
// MÓDULO DE AUTENTICACIÓN HÍBRIDO (auth.js)
// Soporta Supabase Auth (admin@buxiloto.com) y Tablas Personalizadas (Bancas/Usuarios)
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
            if (user && (user.id || user.email || user.username)) {
                console.log("🟢 Sesión activa detectada.");
                aplicarAccesoYMostrarSistema(user);
                return;
            }
        }

        // Verificar sesión activa nativa de Supabase Auth
        const client = window.supabase;
        if (client && client.auth) {
            const { data: { session } } = await client.auth.getSession();
            if (session && session.user) {
                const { data: profile } = await client
                    .from('profiles')
                    .select('*')
                    .eq('id', session.user.id)
                    .maybeSingle();

                const usuarioMaster = profile || { 
                    id: session.user.id, 
                    nombre: 'Administrador Maestro', 
                    username: 'admin', 
                    rol: 'admin',
                    email: session.user.email 
                };

                localStorage.setItem('usuario_sesion', JSON.stringify(usuarioMaster));
                aplicarAccesoYMostrarSistema(usuarioMaster);
            }
        }
    } catch (err) {
        console.error("Error al comprobar sesión inicial:", err);
    }
});

// 2. Evento de inicio de sesión desde el formulario
const loginForm = document.getElementById('login-form');
if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inputIngresado = document.getElementById('login-usuario').value.trim();
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

            // CASO A: Si ingresó un correo (ej. admin@buxiloto.com), intentar Supabase Auth
            if (inputIngresado.includes('@')) {
                const { data: authData, error: authError } = await client.auth.signInWithPassword({
                    email: inputIngresado,
                    password: passwordInput
                });

                if (!authError && authData.user) {
                    const { data: profileData } = await client
                        .from('profiles')
                        .select('*')
                        .eq('id', authData.user.id)
                        .maybeSingle();

                    cuentaUsuario = profileData || {
                        id: authData.user.id,
                        nombre: 'Administrador Maestro',
                        username: 'admin',
                        rol: 'admin',
                        email: authData.user.email,
                        estatus: 'activo'
                    };
                }
            }

            // CASO B: Si no es correo o falló Supabase Auth, buscar por username en la tabla 'usuarios'
            if (!cuentaUsuario) {
                const usernameLimpio = inputIngresado.replace(/^@/, '');
                const { data: usuarioData } = await client
                    .from('usuarios')
                    .select('*')
                    .eq('username', usernameLimpio)
                    .eq('password', passwordInput)
                    .maybeSingle();

                if (usuarioData) {
                    cuentaUsuario = usuarioData;
                }
            }

            // CASO C: Si aún no se encuentra, buscar por username en la tabla 'bancas' (Vendedores)
            if (!cuentaUsuario) {
                const usernameLimpio = inputIngresado.replace(/^@/, '');
                const { data: bancaData } = await client
                    .from('bancas')
                    .select('*')
                    .eq('username', usernameLimpio)
                    .eq('password', passwordInput)
                    .maybeSingle();

                if (bancaData) {
                    cuentaUsuario = {
                        ...bancaData,
                        rol: 'caja',
                        nombre: bancaData.nombre_banca || bancaData.nombre || 'Banca'
                    };
                }
            }

            if (!cuentaUsuario) {
                alert('❌ Usuario o contraseña incorrectos.');
                resetBtn();
                return;
            }

            // Verificar estatus
            const estatus = String(cuentaUsuario.estatus || cuentaUsuario.estado || 'activo').toLowerCase();
            if (estatus !== 'activo') {
                alert(`⚠️ Esta cuenta se encuentra ${estatus}. Contacte al administrador.`);
                resetBtn();
                return;
            }

            // Guardar sesión y mostrar sistema
            localStorage.setItem('usuario_sesion', JSON.stringify(cuentaUsuario));
            aplicarAccesoYMostrarSistema(cuentaUsuario);

        } catch (err) {
            console.error('Error en el login:', err);
            alert('Ocurrió un error inesperado al iniciar sesión.');
            resetBtn();
        }
    });
}

function aplicarAccesoYMostrarSistema(usuario) {
    const loginWrapper = document.getElementById('auth-login-wrapper');
    const mainContainer = document.getElementById('main-app-container');

    if (loginWrapper) loginWrapper.classList.add('hidden');
    if (mainContainer) mainContainer.classList.remove('hidden');

    if (typeof window.iniciarAplicacionPrincipal === 'function') {
        window.iniciarAplicacionPrincipal();
    }
}

function resetBtn() {
    const submitBtn = document.getElementById('btn-login-submit');
    if (submitBtn) {
        submitBtn.innerHTML = `<span>Entrar al Sistema</span><i class="fa-solid fa-arrow-right-to-bracket"></i>`;
        submitBtn.disabled = false;
    }
}