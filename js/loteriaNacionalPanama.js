/**
 * ==========================================================
 * MÓDULO: Lotería Nacional de Beneficencia (LNB) de Panamá
 * Arquitectura: Modo Pick 4 (4 Cifras: 0000 al 9999)
 * ==========================================================
 */

export const LNB_CONFIG = {
    id: 'lnb_panama_pick4',
    nombre: 'Lotería Nacional (Pick 4)',
    diasSorteo: [3, 0], // Miércoles (3) y Domingo (0)
    horaCierreDefault: '12:55:00', // Cierre habitual a la 1:00 PM
    minDigitos: 4,
    maxDigitos: 4,
    modalidades: [
        { 
            id: 'directo', 
            nombre: 'Directo (Exacto)', 
            descripcion: 'Acierta los 4 dígitos en el orden exacto del Primer Premio de la LNB.',
            multiplicadorBase: 5000 
        },
        { 
            id: 'combinado', 
            nombre: 'Combinado (Box)', 
            descripcion: 'Acierta los 4 dígitos en cualquier combinación de posición.',
            multiplicadorBase: 200 
        }
    ]
};

/**
 * Valida que la jugada cumpla con el formato Pick 4 de la LNB
 * @param {string} numero - Número de 4 cifras (ej. "4589")
 * @param {string} modalidad - 'directo' o 'combinado'
 * @param {number} monto - Monto apostado
 */
export function validarJugadaPick4LNB(numero, modalidad, monto) {
    if (!numero || typeof numero !== 'string') {
        return { valido: false, error: 'Debe ingresar un número válido.' };
    }
    
    // Limpiar espacios o caracteres extraños
    const limpio = numero.trim();

    if (limpio.length !== 4 || isNaN(limpio)) {
        return { valido: false, error: 'El formato Pick 4 de la LNB exige exactamente 4 dígitos (0000 a 9999).' };
    }

    if (!monto || parseFloat(monto) <= 0) {
        return { valido: false, error: 'El monto de la apuesta debe ser mayor a $0.00.' };
    }

    const modValida = LNB_CONFIG.modalidades.find(m => m.id === modalidad);
    if (!modValida) {
        return { valido: false, error: 'Modalidad de juego no reconocida para la LNB.' };
    }

    return { valido: true, numeroLimpio: limpio };
}

/**
 * Calcula el premio potencial para el sorteo LNB Pick 4
 */
export function calcularPremioPick4LNB(modalidad, monto) {
    const mod = LNB_CONFIG.modalidades.find(m => m.id === modalidad);
    if (!mod) return 0;
    return parseFloat(monto) * mod.multiplicadorBase;
}

/**
 * Inicializador del módulo para integrarse con el DOM del POS
 */
export function initLNBModule() {
    console.log('🏛️ Módulo Lotería Nacional de Panamá (Pick 4) inicializado correctamente.');
    
    // Opcional: Registrar el sorteo globalmente para que el POS o Sorteos lo reconozcan
    if (window.registerSorteoType) {
        window.registerSorteoType(LNB_CONFIG);
    }
}