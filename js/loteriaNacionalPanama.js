/**
 * ==========================================================
 * MÓDULO: Lotería Nacional de Beneficencia (LNB) de Panamá
 * Estructura Oficial: Billetes (Pick 4) y Chances (Pick 2)
 * ==========================================================
 */

export const LNB_CONFIG = {
    id: 'lnb_panama',
    nombre: 'Lotería Nacional de Panamá (LNB)',
    diasSorteo: [3, 0], // Miércoles (3) y Domingo (0)
    horaCierreDefault: '12:55:00',
    denominacionesValidas: [0.25, 0.50, 0.75, 1.00],
    modalidades: [
        { id: 'billete', nombre: 'Billete (4 Cifras / Pick 4)', digitos: 4 },
        { id: 'chance', nombre: 'Chance (2 Cifras / Pick 2)', digitos: 2 }
    ]
};

/**
 * Tabla Oficial de Premios para BILLETES (Pick 4) según denominación
 */
const TABLA_PREMIOS_BILLETE = {
    1.00: {
        premio1: { c4: 2500, p3: 50, u3: 50, p2: 3, u2: 3 },
        premio2: { c4: 700,  p3: 20, u3: 20, p2: 0, u2: 2 },
        premio3: { c4: 300,  p3: 10, u3: 10, p2: 0, u2: 1 }
    },
    0.75: {
        premio1: { c4: 1875, p3: 37.50, u3: 37.50, p2: 2.25, u2: 2.25 },
        premio2: { c4: 525,  p3: 15.00, u3: 15.00, p2: 0,    u2: 1.50 },
        premio3: { c4: 225,  p3: 7.50,  u3: 7.50,  p2: 0,    u2: 0.75 }
    },
    0.50: {
        premio1: { c4: 1250, p3: 25.00, u3: 25.00, p2: 1.50, u2: 1.50 },
        premio2: { c4: 350,  p3: 10.00, u3: 10.00, p2: 0,    u2: 1.00 },
        premio3: { c4: 150,  p3: 5.00,  u3: 5.00,  p2: 0,    u2: 0.50 }
    },
    0.25: {
        premio1: { c4: 625,  p3: 12.50, u3: 12.50, p2: 0.75, u2: 0.75 },
        premio2: { c4: 175,  p3: 5.00,  u3: 5.00,  p2: 0,    u2: 0.50 },
        premio3: { c4: 75,   p3: 2.50,  u3: 2.50,  p2: 0,    u2: 0.25 }
    }
};

/**
 * Tabla Oficial de Premios para CHANCES (Pick 2 de la LNB)
 * Paga igual que el directo: 1ro = $56, 2do = $12, 3ro = $8 (por cada $1.00)
 */
const TABLA_PREMIOS_CHANCE = {
    1.00: { premio1: 56.00, premio2: 12.00, premio3: 8.00 },
    0.75: { premio1: 42.00, premio2: 9.00,  premio3: 6.00 },
    0.50: { premio1: 28.00, premio2: 6.00,  premio3: 4.00 },
    0.25: { premio1: 14.00, premio2: 3.00,  premio3: 2.00 }
};

/**
 * Valida jugada general para la LNB (Billete o Chance)
 */
export function validarJugadaLNB(modalidad, numero, denominacion) {
    const mod = LNB_CONFIG.modalidades.find(m => m.id === modalidad);
    if (!mod) return { valido: false, error: 'Modalidad de LNB no válida (debe ser billete o chance).' };

    const numStr = String(numero || '').trim();
    if (numStr.length !== mod.digitos || isNaN(numStr)) {
        return { valido: false, error: `La modalidad ${mod.nombre} exige exactamente ${mod.digitos} dígitos.` };
    }

    const montoNum = parseFloat(denominacion);
    if (!LNB_CONFIG.denominacionesValidas.includes(montoNum)) {
        return { valido: false, error: 'Denominación inválida. Permitidas: $0.25, $0.50, $0.75 y $1.00.' };
    }

    return { valido: true, numeroLimpio: numStr, denominacion: montoNum, modalidad };
}

/**
 * Escrutinio automático para Billete o Chance de la LNB
 */
export function calcularEscrutinioLNB(modalidad, numeroJugado, denominacion, resultadosOficiales) {
    const validacion = validarJugadaLNB(modalidad, numeroJugado, denominacion);
    if (!validacion.valido) return { premioTotal: 0, detalles: [] };

    let premioTotal = 0;
    const detalles = [];
    const num = validacion.numeroLimpio;

    if (modalidad === 'billete') {
        const tabla = TABLA_PREMIOS_BILLETE[denominacion];
        if (!tabla) return { premioTotal: 0, detalles: [] };

        const p3_jugado = num.slice(0, 3);
        const u3_jugado = num.slice(1, 4);
        const p2_jugado = num.slice(0, 2);
        const u2_jugado = num.slice(2, 4);

        const premiosArray = [
            { key: 'premio1', valorOficial: resultadosOficiales?.p1 },
            { key: 'premio2', valorOficial: resultadosOficiales?.p2 },
            { key: 'premio3', valorOficial: resultadosOficiales?.p3 }
        ];

        premiosArray.forEach((premioObj, index) => {
            const oficial = String(premioObj.valorOficial || '').trim();
            if (oficial.length !== 4) return;

            const pRules = tabla[premioObj.key];
            const numPremioStr = (index + 1) + ' Premio';

            if (num === oficial && pRules.c4 > 0) {
                premioTotal += pRules.c4;
                detalles.push({ concepto: `${numPremioStr} - 4 Cifras Exactas`, monto: pRules.c4 });
            }
            if (p3_jugado === oficial.slice(0, 3) && pRules.p3 > 0) {
                premioTotal += pRules.p3;
                detalles.push({ concepto: `${numPremioStr} - 3 Primeras Cifras`, monto: pRules.p3 });
            }
            if (u3_jugado === oficial.slice(1, 4) && pRules.u3 > 0) {
                premioTotal += pRules.u3;
                detalles.push({ concepto: `${numPremioStr} - 3 Últimas Cifras`, monto: pRules.u3 });
            }
            if (p2_jugado === oficial.slice(0, 2) && pRules.p2 > 0) {
                premioTotal += pRules.p2;
                detalles.push({ concepto: `${numPremioStr} - 2 Primeras Cifras`, monto: pRules.p2 });
            }
            if (u2_jugado === oficial.slice(2, 4) && pRules.u2 > 0) {
                premioTotal += pRules.u2;
                detalles.push({ concepto: `${numPremioStr} - 2 Últimas Cifras`, monto: pRules.u2 });
            }
        });

    } else if (modalidad === 'chance') {
        const tablaChance = TABLA_PREMIOS_CHANCE[denominacion];
        if (!tablaChance) return { premioTotal: 0, detalles: [] };

        const chancesOficiales = [
            { nombre: '1er Premio (2 últimas)', val: resultadosOficiales?.p1 ? String(resultadosOficiales.p1).slice(2, 4) : '', premio: tablaChance.premio1 },
            { nombre: '2do Premio (2 últimas)', val: resultadosOficiales?.p2 ? String(resultadosOficiales.p2).slice(2, 4) : '', premio: tablaChance.premio2 },
            { nombre: '3er Premio (2 últimas)', val: resultadosOficiales?.p3 ? String(resultadosOficiales.p3).slice(2, 4) : '', premio: tablaChance.premio3 }
        ];

        chancesOficiales.forEach(c => {
            if (c.val && num === c.val) {
                premioTotal += c.premio;
                detalles.push({ concepto: `Chance LNB - ${c.nombre}`, monto: c.premio });
            }
        });
    }

    return { premioTotal, detalles };
}

export function initLNBModule() {
    console.log('🏛️ Módulo Lotería Nacional de Panamá (Billetes y Chances) cargado correctamente con tasas oficiales.');
}