/**
 * ==========================================================
 * MÓDULO: Lotería Nacional de Beneficencia (LNB) de Panamá
 * Estructura Oficial: Billetes (Pick 4) y Denominaciones de Premios
 * ==========================================================
 */

export const LNB_CONFIG = {
    id: 'lnb_panama_billete',
    nombre: 'Lotería Nacional - Billetes (Pick 4)',
    diasSorteo: [3, 0], // Miércoles (3) y Domingo (0)
    horaCierreDefault: '12:55:00',
    denominacionesValidas: [0.25, 0.50, 0.75, 1.00]
};

/**
 * Tabla Oficial de Premios según la denominación del Billete ($1.00, $0.75, $0.50, $0.25)
 */
const TABLA_PREMIOS_LNB = {
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
 * Valida la jugada de Billete LNB
 */
export function validarJugadaBilleteLNB(numero, montoDenominacion) {
    if (!numero || typeof numero !== 'string' || numero.trim().length !== 4 || isNaN(numero.trim())) {
        return { valido: false, error: 'El billete Pick 4 de la LNB exige exactamente 4 dígitos (0000 a 9999).' };
    }

    const montoNum = parseFloat(montoDenominacion);
    if (!LNB_CONFIG.denominacionesValidas.includes(montoNum)) {
        return { valido: false, error: 'Denominación inválida. Los billetes permitidos son de $0.25, $0.50, $0.75 y $1.00.' };
    }

    return { valido: true, numeroLimpio: numero.trim(), denominacion: montoNum };
}

/**
 * Calcula los premios potenciales al escanear o simular un resultado oficial de la LNB
 */
export function calcularEscrutinioBilleteLNB(numeroJugado, montoDenominacion, resultadosOficiales) {
    const tabla = TABLA_PREMIOS_LNB[montoDenominacion];
    if (!tabla) return { premioTotal: 0, detalles: [] };

    let premioTotal = 0;
    const detalles = [];

    const num = String(numeroJugado).trim();
    const p3_jugado = num.slice(0, 3); // 3 primeras
    const u3_jugado = num.slice(1, 4); // 3 últimas
    const p2_jugado = num.slice(0, 2); // 2 primeras
    const u2_jugado = num.slice(2, 4); // 2 últimas

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

        const of_p3 = oficial.slice(0, 3);
        const of_u3 = oficial.slice(1, 4);
        const of_p2 = oficial.slice(0, 2);
        const of_u2 = oficial.slice(2, 4);

        // 1. 4 Cifras exactas
        if (num === oficial && pRules.c4 > 0) {
            premioTotal += pRules.c4;
            detalles.push({ concepto: `${numPremioStr} - 4 Cifras Exactas`, monto: pRules.c4 });
        }
        // 2. 3 Primeras Cifras
        if (p3_jugado === of_p3 && pRules.p3 > 0) {
            premioTotal += pRules.p3;
            detalles.push({ concepto: `${numPremioStr} - 3 Primeras Cifras`, monto: pRules.p3 });
        }
        // 3. 3 Últimas Cifras
        if (u3_jugado === of_u3 && pRules.u3 > 0) {
            premioTotal += pRules.u3;
            detalles.push({ concepto: `${numPremioStr} - 3 Últimas Cifras`, monto: pRules.u3 });
        }
        // 4. 2 Primeras Cifras
        if (p2_jugado === of_p2 && pRules.p2 > 0) {
            premioTotal += pRules.p2;
            detalles.push({ concepto: `${numPremioStr} - 2 Primeras Cifras`, monto: pRules.p2 });
        }
        // 5. 2 Últimas Cifras
        if (u2_jugado === of_u2 && pRules.u2 > 0) {
            premioTotal += pRules.u2;
            detalles.push({ concepto: `${numPremioStr} - 2 Últimas Cifras`, monto: pRules.u2 });
        }
    });

    return { premioTotal, detalles };
}

export function initLNBModule() {
    console.log('🏛️ Módulo Lotería Nacional de Panamá (Billetes / Pick 4) cargado con la tabla oficial de premios.');
}