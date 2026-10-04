// ==========================================
// BuxyLoto - Módulo de Métricas y Perfil Admin
// Archivo independiente: dashboard-metrics.js
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
  // Inicializar componentes al cargar
  cargarResumenVentasHoy();
  cargarGraficoVentasPorVendedor();
  cargarGraficoDistribucionSorteos();
  configurarFormularioPerfil();
  configurarCierreSesion();
});

// ------------------------------------------
// 1. GESTIÓN DE PERFIL Y CAMBIO DE CONTRASEÑA
// ------------------------------------------
function configurarFormularioPerfil() {
  const formPerfil = document.getElementById('formPerfilAdmin');
  if (!formPerfil) return;

  formPerfil.addEventListener('submit', async (e) => {
    e.preventDefault();

    const nuevoNombre = document.getElementById('inputNombreAdmin')?.value.trim();
    const nuevaPassword = document.getElementById('inputPasswordAdmin')?.value.trim();

    try {
      // 1. Actualizar datos en Supabase Auth
      const updateData = {};
      if (nuevoNombre) updateData.data = { display_name: nuevoNombre };
      if (nuevaPassword) updateData.password = nuevaPassword;

      if (Object.keys(updateData).length === 0) {
        alert('Ingresa al menos un campo para actualizar.');
        return;
      }

      const { data, error } = await supabase.auth.updateUser(updateData);

      if (error) throw error;

      // 2. Si hay tabla custom de usuarios/admin, actualizar el perfil allí
      const { data: userData } = await supabase.auth.getUser();
      if (userData?.user) {
        await supabase
          .from('usuarios')
          .update({ 
            nombre: nuevoNombre || userData.user.user_metadata.display_name 
          })
          .eq('id', userData.user.id);
      }

      alert('¡Perfil y/o contraseña actualizados correctamente!');
      if (nuevaPassword) {
        // Forzar nuevo login si cambió la contraseña
        cerrarSesionSincronizada();
      }
    } catch (err) {
      console.error('Error al actualizar perfil:', err);
      alert('Error al actualizar: ' + err.message);
    }
  });
}

// ------------------------------------------
// 2. CIERRE DE SESIÓN Y REDIRECCIÓN A LOGIN
// ------------------------------------------
function configurarCierreSesion() {
  const btnLogout = document.getElementById('btnCerrarSesionAdmin');
  if (!btnLogout) return;

  btnLogout.addEventListener('click', (e) => {
    e.preventDefault();
    cerrarSesionSincronizada();
  });
}

async function cerrarSesionSincronizada() {
  try {
    // Cerrar sesión en Supabase
    await supabase.auth.signOut();
  } catch (err) {
    console.error('Error al cerrar sesión en Supabase:', err);
  } finally {
    // Limpiar almacenamiento local y redirigir
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'login.html'; // Cambia por tu ruta exacta de login (ej: /login, login.html)
  }
}

// ------------------------------------------
// 3. MÉTRICAS Y GRÁFICOS DEL DASHBOARD (HOY)
// ------------------------------------------
async function cargarResumenVentasHoy() {
  try {
    const inicioHoy = new Date();
    inicioHoy.setHours(0, 0, 0, 0);

    // Consultar tickets del día excluyendo los cancelados/anulados
    const { data: tickets, error } = await supabase
      .from('tickets')
      .select('monto_total, estado, created_at')
      .gte('created_at', inicioHoy.toISOString())
      .neq('estado', 'cancelado');

    if (error) throw error;

    const totalVentas = tickets.reduce((acc, t) => acc + (parseFloat(t.monto_total) || 0), 0);
    const totalTickets = tickets.length;

    // Actualizar elementos DOM del resumen
    const elemVentas = document.getElementById('resumenVentasHoy');
    const elemTickets = document.getElementById('resumenTicketsHoy');

    if (elemVentas) elemVentas.textContent = `$${totalVentas.toFixed(2)}`;
    if (elemTickets) elemTickets.textContent = totalTickets;

  } catch (err) {
    console.error('Error cargando resumen del día:', err);
  }
}

// Gráfico: Ventas por Vendedor
async function cargarGraficoVentasPorVendedor() {
  const canvas = document.getElementById('chartVentasVendedor');
  if (!canvas) return;

  try {
    const inicioHoy = new Date();
    inicioHoy.setHours(0,0,0,0);

    const { data, error } = await supabase
      .from('tickets')
      .select('vendedor_nombre, monto_total')
      .gte('created_at', inicioHoy.toISOString())
      .neq('estado', 'cancelado');

    if (error) throw error;

    // Agrupar ventas por vendedor
    const ventasMap = {};
    data.forEach(t => {
      const vendedor = t.vendedor_nombre || 'Sin nombre';
      ventasMap[vendedor] = (ventasMap[vendedor] || 0) + parseFloat(t.monto_total || 0);
    });

    const labels = Object.keys(ventasMap);
    const valores = Object.values(ventasMap);

    // Destruir instancia anterior si existe
    if (window.chartVendedoresInstance) {
      window.chartVendedoresInstance.destroy();
    }

    // Renderizar gráfico con Chart.js
    window.chartVendedoresInstance = new Chart(canvas, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{
          label: 'Ventas por Vendedor ($)',
          data: valores,
          backgroundColor: '#3b82f6'
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

  } catch (err) {
    console.error('Error cargando gráfico de vendedores:', err);
  }
}

// Gráfico: Distribución por Sorteo
async function cargarGraficoDistribucionSorteos() {
  const canvas = document.getElementById('chartDistribucionSorteo');
  if (!canvas) return;

  try {
    const inicioHoy = new Date();
    inicioHoy.setHours(0,0,0,0);

    const { data, error } = await supabase
      .from('tickets')
      .select('sorteo_nombre, monto_total')
      .gte('created_at', inicioHoy.toISOString())
      .neq('estado', 'cancelado');

    if (error) throw error;

    // Agrupar por sorteo
    const sorteosMap = {};
    data.forEach(t => {
      const sorteo = t.sorteo_nombre || 'General';
      sorteosMap[sorteo] = (sorteosMap[sorteo] || 0) + parseFloat(t.monto_total || 0);
    });

    const labels = Object.keys(sorteosMap);
    const valores = Object.values(sorteosMap);

    if (window.chartSorteosInstance) {
      window.chartSorteosInstance.destroy();
    }

    window.chartSorteosInstance = new Chart(canvas, {
      type: 'pie',
      data: {
        labels: labels,
        datasets: [{
          data: valores,
          backgroundColor: ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4']
        }]
      },
      options: { responsive: true, maintainAspectRatio: false }
    });

  } catch (err) {
    console.error('Error cargando gráfico de sorteos:', err);
  }
}