// Obtiene el inquilino actual del navegador
export function obtenerInquilinoId() {
    const inquilinoId = localStorage.getItem('inquilino_id');
    if (!inquilinoId) {
        console.warn('No hay un inquilino activo en la sesión.');
        // Opcional: Redirigir al login si no hay sesión
    }
    return inquilinoId;
}

// Ejemplo de cómo consultar las ventas filtradas por inquilino
import { supabase } from '../lib/supabase'; // Tu cliente de Supabase

export async function obtenerVentasInquilino() {
    const inquilinoId = obtenerInquilinoId();
    if (!inquilinoId) return [];

    const { data, error } = await supabase
        .from('ventas')
        .select('*')
        .eq('inquilino_id', inquilinoId); // 🔥 Aquí ocurre la magia del aislamiento

    if (error) {
        console.error('Error al cargar ventas:', error);
        return [];
    }
    return data;
}