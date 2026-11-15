import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const MESES_ES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

const MESES_EN = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december'
];

const DELIMITADORES_LOTERIAS = /\b(?:ANGUILLA|FLORIDA|NEW\s*YORK|LA\s*PRIMERA|PRIMERA\s*NOCHE|QUINIELA|NACIONAL|LEIDSA|LOTEKA|REAL|KING\s*LOTTERY|DOMI|TICA|NICA|HONDURAS|MONAZO|PEGA\s*3|PREMIA\s*2|PREMIA2|LA\s*DIARIA|TRIPLETA|JUGA\s*3|SUPER\s*PREMIO|TERMINACION)\b/;
const DELIMITADORES_HORAS_CA = /\b(?:11:00|3:00|6:00|9:00|11\s*AM|3\s*PM|6\s*PM|9\s*PM|SORTEOS\s+ANTERIORES|RESULTADOS\s+ANTERIORES)\b/;

function normalizar(texto) {
    return texto ? texto.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
}

function limpiarHtmlATexto(html) {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
}

function getInfoFechaPanama() {
    const ahora = new Date();
    const fechaISO = ahora.toLocaleDateString('en-CA', { timeZone: 'America/Panama' }); // YYYY-MM-DD
    const hora24 = ahora.toLocaleTimeString('en-GB', { timeZone: 'America/Panama', hour12: false }); // HH:MM:SS
    const horaNY24 = ahora.toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour12: false }); // ET (NY/Florida)
    const horaRD24 = ahora.toLocaleTimeString('en-GB', { timeZone: 'America/Santo_Domingo', hour12: false }); // AST (Anguilla/RD)
    const [anio, mes, dia] = fechaISO.split('-');
    const idxMes = parseInt(mes, 10) - 1;
    return {
        fechaISO,
        hora24,
        horaNY24,
        horaRD24,
        anio,
        dia,
        mes,
        diaNum: String(parseInt(dia, 10)),
        mesNombre: MESES_ES[idxMes],
        mesNombreEn: MESES_EN[idxMes]
    };
}

function yaPasoHoraRealSorteo(sorteo, infoFecha) {
    const n = normalizar(sorteo.nombre);

    if (n.includes('FLORIDA')) {
        if (n.includes('12') || n.includes('1') || n.includes('DIA') || n.includes('TARDE') || n.includes('AM')) {
            return infoFecha.horaNY24 >= '13:30:00';
        }
        if (n.includes('6') || n.includes('8') || n.includes('9') || n.includes('10') || n.includes('NOCHE') || n.includes('PM')) {
            return infoFecha.horaNY24 >= '21:45:00';
        }
    }

    if (n.includes('YORK')) {
        if (n.includes('1') || n.includes('2') || n.includes('DIA') || n.includes('TARDE') || n.includes('AM')) {
            return infoFecha.horaNY24 >= '14:30:00';
        }
        if (n.includes('9') || n.includes('10') || n.includes('11') || n.includes('NOCHE') || n.includes('PM')) {
            return infoFecha.horaNY24 >= '22:30:00';
        }
    }

    if (n.includes('ANGUILLA')) {
        if (n.includes('9AM') || n.includes('10')) return infoFecha.horaRD24 >= '10:05:00';
        if (n.includes('12') || n.includes('1PM') || n.includes('TARDE')) return infoFecha.horaRD24 >= '13:05:00';
        if (n.includes('5') || n.includes('6')) return infoFecha.horaRD24 >= '18:05:00';
        if (n.includes('8') || n.includes('9PM') || n.includes('NOCHE')) return infoFecha.horaRD24 >= '21:05:00';
    }

    return !sorteo.hora_cierre || infoFecha.hora24 >= sorteo.hora_cierre;
}

function obtenerVariantesFecha(infoFecha) {
    const { fechaISO, dia, diaNum, mes, mesNombre, mesNombreEn } = infoFecha;
    const mesNorm = normalizar(mesNombre);
    const mesCorto = mesNorm.substring(0, 3);
    const mesEnNorm = normalizar(mesNombreEn);
    const mesEnCorto = mesEnNorm.substring(0, 3);

    return [
        fechaISO,
        `${dia}/${mes}`,
        `${dia}-${mes}`,
        `${diaNum}/${mes}`,
        `${diaNum}-${mes}`,
        `${diaNum} DE ${mesNorm}`,
        `${dia} DE ${mesNorm}`,
        `${diaNum} ${mesCorto}`,
        `${dia} ${mesCorto}`,
        `${mesNorm} ${diaNum}`,
        `${mesNorm} ${dia}`,
        `${mesCorto} ${diaNum}`,
        `${mesCorto} ${dia}`,
        `${diaNum} ${mesEnCorto}`,
        `${dia} ${mesEnCorto}`,
        `${mesEnNorm} ${diaNum}`,
        `${mesEnCorto} ${diaNum}`
    ];
}

function contieneFechaHoy(textoPlano, infoFecha) {
    const norm = normalizar(textoPlano);
    return obtenerVariantesFecha(infoFecha).some(v => norm.includes(v));
}

function extraerSeccionDesdeFechaHoy(textoNorm, infoFecha, largo = 550) {
    if (!textoNorm) return '';
    for (const v of obtenerVariantesFecha(infoFecha)) {
        const idx = textoNorm.indexOf(v);
        if (idx !== -1) {
            return textoNorm.substring(idx, idx + largo);
        }
    }
    return '';
}

function limpiarFechasYHoras(textoNorm) {
    return textoNorm
        .replace(/\b20\d{2}\b/g, ' ')
        .replace(/\b\d{4}-\d{2}-\d{2}\b/g, ' ')
        .replace(/\b(?:0?[1-9]|[12]\d|3[01])[-\/](?:0?[1-9]|1[0-2])(?:[-\/]\d{2,4})?\b/g, ' ')
        .replace(/\b\d{1,2}\s*(?:DE\s+)?(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC|JAN|APR|AUG|DEC)[A-Z]*\b/g, ' ')
        .replace(/\b(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC|JAN|APR|AUG|DEC)[A-Z]*\s+\d{1,2}(?:,?\s*\d{4})?\b/g, ' ')
        .replace(/\b(?:LUNES|MARTES|MIERCOLES|JUEVES|VIERNES|SABADO|DOMINGO|MONDAY|TUESDAY|WEDNESDAY|THURSDAY|FRIDAY|SATURDAY|SUNDAY)\s*,?\s*\d{0,2}\b/g, ' ')
        .replace(/\b\d{1,2}:\d{2}\s*(?:A\.?M\.?|P\.?M\.?|M\.?D\.?)?\b/g, ' ')
        .replace(/\b\d{1,2}\s*(?:A\.?M\.?|P\.?M\.?)\b/g, ' ')
        .replace(/\b(?:POSICION|PREMIO)\s*\d+\b/g, ' ');
}

async function descargarPaginaAbierta(url, timeoutMs = 5500, usarProxySiFalla = false) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'es-ES,es;q=0.9',
                'Referer': 'https://www.google.com/'
            }
        });
        if (!res.ok) {
            if (usarProxySiFalla) {
                return await descargarPaginaAbierta(`https://r.jina.ai/${url}`, 7000, false);
            }
            return { html: null, estado: `HTTP_${res.status}` };
        }
        const html = await res.text();
        if (!html || html.includes('Just a moment...') || html.includes('cf-browser-verification')) {
            if (usarProxySiFalla) {
                return await descargarPaginaAbierta(`https://r.jina.ai/${url}`, 7000, false);
            }
            return { html: null, estado: 'BLOQUEO_CF' };
        }
        return { html, estado: url.includes('r.jina.ai') ? 'PROXY_200' : 'HTTP_200' };
    } catch (e) {
        if (usarProxySiFalla) {
            return await descargarPaginaAbierta(`https://r.jina.ai/${url}`, 7000, false);
        }
        return { html: null, estado: e.name === 'AbortError' ? 'TIMEOUT' : 'ERROR_RED' };
    } finally {
        clearTimeout(timer);
    }
}

// ==========================================================
// A. EXTRACTOR ENLOTERIA / KINGARROBA (FLORIDA, NEW YORK, PRIMERA, ANGUILLA)
// ==========================================================
function obtenerEtiquetas3Premios(nombreSorteo) {
    const n = normalizar(nombreSorteo);

    if (n.includes('PRIMERA')) {
        if (n.includes('11') || n.includes('DIA') || n.includes('12') || n.includes('AM')) {
            return ['LA PRIMERA DIA', 'PRIMERA DIA', 'LA PRIMERA 12:00', 'LA PRIMERA'];
        }
        if (n.includes('6') || n.includes('7') || n.includes('8') || n.includes('NOCHE') || n.includes('PM')) {
            return ['PRIMERA NOCHE', 'LA PRIMERA NOCHE', 'LA PRIMERA 8:00'];
        }
    }
    if (n.includes('FLORIDA')) {
        if (n.includes('12') || n.includes('1') || n.includes('DIA') || n.includes('TARDE') || n.includes('AM')) {
            return ['FLORIDA DIA', 'FLORIDA TARDE', 'FLORIDA AM'];
        }
        if (n.includes('6') || n.includes('8') || n.includes('9') || n.includes('10') || n.includes('NOCHE') || n.includes('PM')) {
            return ['FLORIDA NOCHE', 'FLORIDA PM'];
        }
    }
    if (n.includes('YORK')) {
        if (n.includes('1') || n.includes('2') || n.includes('DIA') || n.includes('TARDE') || n.includes('AM')) {
            return ['NEW YORK TARDE', 'NEW YORK DIA', 'NEW YORK AM'];
        }
        if (n.includes('9') || n.includes('10') || n.includes('11') || n.includes('NOCHE') || n.includes('PM')) {
            return ['NEW YORK NOCHE', 'NEW YORK PM'];
        }
    }
    if (n.includes('ANGUILLA')) {
        if (n.includes('9AM') || n.includes('10')) {
            return ['ANGUILLA 10:00', 'ANGUILLA 10AM', 'ANGUILLA MANANA'];
        }
        if (n.includes('12') || n.includes('1PM') || n.includes('TARDE')) {
            return ['ANGUILLA 1:00', 'ANGUILLA 1PM', 'ANGUILLA TARDE'];
        }
        if (n.includes('5') || n.includes('6')) {
            return ['ANGUILLA 6:00', 'ANGUILLA 6PM'];
        }
        if (n.includes('8') || n.includes('9PM') || n.includes('NOCHE')) {
            return ['ANGUILLA 9:00', 'ANGUILLA 9PM', 'ANGUILLA NOCHE'];
        }
    }
    return [n];
}

function extraer3PremiosAbierto(html, nombreSorteo, infoFecha) {
    if (!html) return null;
    const texto = normalizar(limpiarHtmlATexto(html));
    const etiquetas = obtenerEtiquetas3Premios(nombreSorteo);
    const buscaDiaPrimera = normalizar(nombreSorteo).includes('PRIMERA') && !normalizar(nombreSorteo).includes('NOCHE');

    for (const etq of etiquetas) {
        let idx = texto.indexOf(etq);
        while (idx !== -1) {
            let bloqueTarjeta = texto.substring(idx + etq.length, idx + etq.length + 130);
            if (buscaDiaPrimera && etq === 'LA PRIMERA' && bloqueTarjeta.startsWith(' NOCHE')) {
                idx = texto.indexOf(etq, idx + etq.length);
                continue;
            }
            bloqueTarjeta = bloqueTarjeta.split(DELIMITADORES_LOTERIAS)[0];

            if (contieneFechaHoy(bloqueTarjeta, infoFecha)) {
                const despuesLimpio = limpiarFechasYHoras(bloqueTarjeta);
                const nums = despuesLimpio.match(/\b\d{2}\b/g);
                if (nums && nums.length >= 3) {
                    return { p1: nums[0], p2: nums[1], p3: nums[2] };
                }
            }
            idx = texto.indexOf(etq, idx + etq.length);
        }
    }
    return null;
}

// ==========================================================
// B. UTILIDADES CENTROAMÉRICA (PORTAL CR + YELU)
// ==========================================================
function extraerDeLoteriasCRPreciso(textoNorm, etiquetas, fechaISO, digitos = 2, cantidad = 1) {
    if (!textoNorm) return null;
    const regexNum = digitos === 3 ? /\b\d{3}\b/g : /\b\d{2}\b/g;

    for (const etq of etiquetas) {
        let idx = textoNorm.indexOf(etq);
        while (idx !== -1) {
            const charAntes = idx > 0 ? textoNorm[idx - 1] : ' ';
            if (/[A-Z0-9]/.test(charAntes)) {
                idx = textoNorm.indexOf(etq, idx + etq.length);
                continue;
            }

            const tarjetaPropia = textoNorm
                .substring(idx + etq.length, idx + etq.length + 115)
                .split(DELIMITADORES_LOTERIAS)[0]
                .split(DELIMITADORES_HORAS_CA)[0];

            if (tarjetaPropia.includes(fechaISO)) {
                const textoAntesDeFecha = tarjetaPropia.split(fechaISO)[0];
                const limpio = limpiarFechasYHoras(textoAntesDeFecha);
                const nums = limpio.match(regexNum);
                if (nums && nums.length >= cantidad) {
                    return cantidad === 1 ? nums[0] : nums.slice(0, cantidad);
                }
            }
            idx = textoNorm.indexOf(etq, idx + etq.length);
        }
    }
    return null;
}

function buscarEnYelu(textoYelu, etiquetasHora, infoFecha, cantidad = 1) {
    const bloqueHoy = extraerSeccionDesdeFechaHoy(textoYelu, infoFecha, 600);
    if (!bloqueHoy) return null;

    for (const etq of etiquetasHora) {
        const idx = bloqueHoy.indexOf(etq);
        if (idx !== -1) {
            const rawDespues = bloqueHoy
                .substring(idx + etq.length, idx + etq.length + 70)
                .split(DELIMITADORES_HORAS_CA)[0];

            if (cantidad === 2) {
                const mGuion = rawDespues.match(/\b(\d{2})\s*[-\/•|]\s*(\d{2})\b/);
                if (mGuion) return [mGuion[1], mGuion[2]];
            }
            const limpio = limpiarFechasYHoras(rawDespues);
            const nums = limpio.match(/\b\d{2}\b/g);
            if (nums && nums.length >= cantidad) {
                return nums.slice(0, cantidad);
            }
        }
    }
    return null;
}

function getTurnoCentroamerica(nombreSorteo) {
    const n = normalizar(nombreSorteo);
    if (n.includes('12') || n.includes('11') || n.includes('AM') || n.includes('DIA')) return '11AM';
    if (n.includes('4') || n.includes('3') || n.includes('TARDE')) return '3PM';
    if (n.includes('7') || n.includes('6')) return '6PM';
    if (n.includes('10') || n.includes('9') || n.includes('NOCHE') || n.includes('PM')) return '9PM';
    return '';
}

// ==========================================================
// C. EXTRACTOR TICA (TICA REVENTADOS = P1 + MONAZO TICA XYZ -> XY Y YZ)
// ==========================================================
function extraerTicaCompleto(textoCR, textoKingTica, textoYeluCr, nombreSorteo, infoFecha) {
    const n = normalizar(nombreSorteo);
    let etiquetasCR = [];
    let etiquetasMonazo = [];
    let etiquetasKing = [];
    let etiquetasYeluCr = [];

    if (n.includes('2PM') || n.includes('2:00') || n.includes('DIA') || n.includes('1PM') || n.includes('AM')) {
        etiquetasCR = ['TICA DIA REVENTADOS', 'TICA DIA', 'TICA 12:55', 'TICA 1:00'];
        etiquetasMonazo = ['MONAZO TICA DIA', '3 MONAZOS TICA DIA', 'MONAZOS TICA DIA', 'MONAZO DIA', 'MONAZO 12:55', 'MONAZO 1:00'];
        etiquetasKing = ['12:55', '1:00', 'TICA DIA', 'MEDIODIA', 'MEDIO DIA'];
        etiquetasYeluCr = ['12:55PM', '12:55 PM', '1:00PM', '1:00 PM', 'MEDIODIA'];
    } else if (n.includes('5:30') || n.includes('5PM') || n.includes('TARDE') || n.includes('3:00')) {
        etiquetasCR = ['TICA TARDE REVENTADOS', 'TICA TARDE', 'TICA 4:30'];
        etiquetasMonazo = ['MONAZO TICA TARDE', '3 MONAZOS TICA TARDE', 'MONAZOS TICA TARDE', 'MONAZO TARDE', 'MONAZO 4:30'];
        etiquetasKing = ['4:30', 'TICA TARDE'];
        etiquetasYeluCr = ['4:30PM', '4:30 PM', 'TARDE'];
    } else if (n.includes('8:30') || n.includes('8PM') || n.includes('NOCHE') || n.includes('7:30') || n.includes('PM')) {
        etiquetasCR = ['TICA NOCHE REVENTADOS', 'TICA NOCHE', 'TICA 7:30'];
        etiquetasMonazo = ['MONAZO TICA NOCHE', '3 MONAZOS TICA NOCHE', 'MONAZOS TICA NOCHE', 'MONAZO NOCHE', 'MONAZO 7:30'];
        etiquetasKing = ['7:30', 'TICA NOCHE'];
        etiquetasYeluCr = ['7:30PM', '7:30 PM', 'NOCHE'];
    }

    let p1 = extraerDeLoteriasCRPreciso(textoCR, etiquetasCR, infoFecha.fechaISO, 2, 1);

    if (!p1 && textoKingTica && contieneFechaHoy(textoKingTica, infoFecha)) {
        for (const etq of etiquetasKing) {
            let idx = textoKingTica.indexOf(etq);
            while (idx !== -1) {
                const despues = limpiarFechasYHoras(textoKingTica.substring(idx + etq.length, idx + etq.length + 65));
                const m = despues.match(/\b(\d{2})\b/);
                if (m) { p1 = m[1]; break; }
                idx = textoKingTica.indexOf(etq, idx + etq.length);
            }
            if (p1) break;
        }
    }
    if (!p1) {
        const numsYelu = buscarEnYelu(textoYeluCr, etiquetasYeluCr, infoFecha, 1);
        if (numsYelu) p1 = numsYelu[0];
    }

    let p2 = null;
    let p3 = null;
    const monazoStr = extraerDeLoteriasCRPreciso(textoCR, etiquetasMonazo, infoFecha.fechaISO, 3, 1);
    if (monazoStr && monazoStr.length === 3) {
        p2 = monazoStr.substring(0, 2);
        p3 = monazoStr.substring(1, 3);
    }

    if (p1 || (p2 && p3)) {
        return { p1, p2, p3 };
    }
    return null;
}

// ==========================================================
// D. EXTRACTOR NICA (AISLADO ESTRICTAMENTE POR BLOQUE HORARIO)
// ==========================================================
function extraerNicaDeNuevaYa(textoNuevaYa, nombreSorteo, infoFecha) {
    if (!textoNuevaYa || !contieneFechaHoy(textoNuevaYa, infoFecha)) return null;

    const turno = getTurnoCentroamerica(nombreSorteo);
    const mapaHoras = {
        '11AM': ['11:00 AM', '11:00AM'],
        '3PM':  ['3:00 PM', '3:00PM'],
        '6PM':  ['6:00 PM', '6:00PM'],
        '9PM':  ['9:00 PM', '9:00PM']
    };
    const horas = mapaHoras[turno] || [];

    for (const h of horas) {
        let idx = textoNuevaYa.indexOf(h);
        while (idx !== -1) {
            const bloqueTurno = textoNuevaYa
                .substring(idx + h.length, idx + h.length + 320)
                .split(DELIMITADORES_HORAS_CA)[0];

            const matchDiaria = bloqueTurno.match(/\b(\d{2})\s*\([A-Z\s]+\)/);
            const matchPremia2 = bloqueTurno.match(/\b(\d{2})\s*[-\/]\s*(\d{2})\b/);
            if (matchDiaria) {
                return {
                    p1: matchDiaria[1],
                    p2: matchPremia2 ? matchPremia2[1] : null,
                    p3: matchPremia2 ? matchPremia2[2] : null
                };
            }
            idx = textoNuevaYa.indexOf(h, idx + h.length);
        }
    }
    return null;
}

function extraerNicaCompleto(textoCR, textoNuevaYa, textoYeluNi, nombreSorteo, infoFecha) {
    const turno = getTurnoCentroamerica(nombreSorteo);
    const mapa = {
        '11AM': { nica: ['NICA 11 AM', 'NICA 11AM'], premia: ['PREMIA2 11 AM', 'PREMIA2 11AM'], horas: ['11:00 AM', '11:00AM'] },
        '3PM':  { nica: ['NICA 3 PM', 'NICA 3PM'],   premia: ['PREMIA2 3 PM', 'PREMIA2 3PM'],   horas: ['3:00 PM', '3:00PM'] },
        '6PM':  { nica: ['NICA 6 PM', 'NICA 6PM'],   premia: ['PREMIA2 6 PM', 'PREMIA2 6PM'],   horas: ['6:00 PM', '6:00PM'] },
        '9PM':  { nica: ['NICA 9 PM', 'NICA 9PM'],   premia: ['PREMIA2 9 PM', 'PREMIA2 9PM'],   horas: ['9:00 PM', '9:00PM'] }
    };
    const cfg = mapa[turno];
    if (!cfg) return null;

    const resNY = extraerNicaDeNuevaYa(textoNuevaYa, nombreSorteo, infoFecha);
    const crP1 = extraerDeLoteriasCRPreciso(textoCR, cfg.nica, infoFecha.fechaISO, 2, 1);
    const crP23 = extraerDeLoteriasCRPreciso(textoCR, cfg.premia, infoFecha.fechaISO, 2, 2);
    const yeluP1Arr = buscarEnYelu(textoYeluNi, cfg.horas, infoFecha, 1);

    const p1 = (resNY && resNY.p1) || crP1 || (yeluP1Arr ? yeluP1Arr[0] : null);
    const p2 = (resNY && resNY.p2) || (Array.isArray(crP23) ? crP23[0] : null);
    const p3 = (resNY && resNY.p3) || (Array.isArray(crP23) ? crP23[1] : null);

    if (p1 || (p2 && p3)) {
        return { p1, p2, p3 };
    }
    return null;
}

// ==========================================================
// E. EXTRACTOR HONDURAS (LOTERIASDEHONDURAS.COM + PROXY + NACIONALLOTERIA + KINGARROBA + YELU.HN)
// ==========================================================
function extraerDeLoteriasDeHondurasCom(textoLdh, horas, infoFecha) {
    if (!textoLdh) return { p1: null, p23: null };

    let p1 = null;
    let p23 = null;

    // 1. Buscar Premia 2 <hora>
    for (const etqP of ['PREMIA 2', 'PREMIA2']) {
        for (const h of horas) {
            const titulo = `${etqP} ${h}`;
            let idx = textoLdh.indexOf(titulo);
            while (idx !== -1 && !p23) {
                const contextoAntes = textoLdh.substring(Math.max(0, idx - 150), idx);
                const contextoDespues = textoLdh
                    .substring(idx + titulo.length, idx + titulo.length + 180)
                    .split(DELIMITADORES_LOTERIAS)[0]
                    .split(DELIMITADORES_HORAS_CA)[0];

                if (contieneFechaHoy(contextoAntes + ' ' + contextoDespues, infoFecha)) {
                    const limpio = limpiarFechasYHoras(contextoDespues);
                    const nums = limpio.match(/\b\d{2}\b/g);
                    if (nums && nums.length >= 2) {
                        p23 = [nums[0], nums[1]];
                        break;
                    }
                }
                idx = textoLdh.indexOf(titulo, idx + titulo.length);
            }
            if (p23) break;
        }
        if (p23) break;
    }

    // 2. Buscar La Diaria <hora>
    for (const h of horas) {
        const titulo = `LA DIARIA ${h}`;
        let idx = textoLdh.indexOf(titulo);
        while (idx !== -1 && !p1) {
            const contextoAntes = textoLdh.substring(Math.max(0, idx - 150), idx);
            const contextoDespues = textoLdh
                .substring(idx + titulo.length, idx + titulo.length + 180)
                .split(DELIMITADORES_LOTERIAS)[0]
                .split(DELIMITADORES_HORAS_CA)[0];

            if (contieneFechaHoy(contextoAntes + ' ' + contextoDespues, infoFecha)) {
                const limpio = limpiarFechasYHoras(contextoDespues);
                const m = limpio.match(/\b(\d{2})\b/);
                if (m) {
                    p1 = m[1];
                    break;
                }
            }
            idx = textoLdh.indexOf(titulo, idx + titulo.length);
        }
        if (p1) break;
    }

    return { p1, p23 };
}

function extraerDeNacionalLoteriaHn(textoNacional, horas, infoFecha) {
    if (!textoNacional) return { p1: null, p23: null };

    const seccionHoy = textoNacional.split('DE AYER')[0];
    if (!contieneFechaHoy(seccionHoy, infoFecha)) return { p1: null, p23: null };

    let p1 = null;
    let p23 = null;

    for (const etqP of ['PREMIA2', 'PREMIA 2']) {
        let idxP = seccionHoy.indexOf(etqP);
        while (idxP !== -1 && !p23) {
            let subP = seccionHoy.substring(idxP + etqP.length, idxP + etqP.length + 950);
            subP = subP.split(/\b(?:LA DIARIA|PEGA\s*3|SUPER\s*PREMIO|DE AYER)\b/)[0];

            for (const h of horas) {
                const idxH = subP.indexOf(h);
                if (idxH !== -1) {
                    const raw = subP
                        .substring(idxH + h.length, idxH + h.length + 80)
                        .split(DELIMITADORES_HORAS_CA)[0];
                    const limpio = limpiarFechasYHoras(raw);
                    const nums = limpio.match(/\b\d{2}\b/g);
                    if (nums && nums.length >= 2) { p23 = [nums[0], nums[1]]; break; }
                }
            }
            idxP = seccionHoy.indexOf(etqP, idxP + etqP.length);
        }
        if (p23) break;
    }

    let idxD = seccionHoy.indexOf('LA DIARIA');
    while (idxD !== -1 && !p1) {
        let subD = seccionHoy.substring(idxD + 9, idxD + 950);
        subD = subD.split(/\b(?:PREMIA\s*2|PREMIA2|PEGA\s*3|SUPER\s*PREMIO|DE AYER)\b/)[0];

        for (const h of horas) {
            const idxH = subD.indexOf(h);
            if (idxH !== -1) {
                const raw = subD
                    .substring(idxH + h.length, idxH + h.length + 55)
                    .split(DELIMITADORES_HORAS_CA)[0];
                const limpio = limpiarFechasYHoras(raw);
                const m = limpio.match(/\b(\d{2})\b/);
                if (m) { p1 = m[1]; break; }
            }
        }
        idxD = seccionHoy.indexOf('LA DIARIA', idxD + 9);
    }

    return { p1, p23 };
}

function extraerDeKingHonduras(textoKingHn, horas, infoFecha) {
    if (!textoKingHn || !contieneFechaHoy(textoKingHn, infoFecha)) return { p1: null, p23: null };

    let p1 = null;
    let p23 = null;

    for (const etq of ['PREMIA 2', 'PREMIA2']) {
        let idxP = textoKingHn.indexOf(etq);
        while (idxP !== -1 && !p23) {
            let sub = textoKingHn.substring(idxP + etq.length, idxP + etq.length + 850);
            sub = sub.split(/\b(?:LA DIARIA|PEGA\s*3|SUPER\s*PREMIO)\b/)[0];
            for (const h of horas) {
                const idxH = sub.indexOf(h);
                if (idxH !== -1) {
                    const raw = sub
                        .substring(idxH + h.length, idxH + h.length + 80)
                        .split(DELIMITADORES_HORAS_CA)[0];
                    const nums = limpiarFechasYHoras(raw).match(/\b\d{2}\b/g);
                    if (nums && nums.length >= 2) { p23 = [nums[0], nums[1]]; break; }
                }
            }
            idxP = textoKingHn.indexOf(etq, idxP + etq.length);
        }
        if (p23) break;
    }

    return { p1, p23 };
}

function extraerHondurasCompleto(fuentesHn, nombreSorteo, infoFecha) {
    const turno = getTurnoCentroamerica(nombreSorteo);
    const mapa = {
        '11AM': {
            crP1: ['HONDURAS 11 AM', 'HONDURAS 11AM', 'HONDURAS DIA'],
            crP23: ['PREMIA2 HONDURAS 11 AM', 'PREMIA 2 HONDURAS 11 AM'],
            horas: ['11:00 AM', '11:00AM', '11:00', '11 AM', '11AM']
        },
        '3PM': {
            crP1: ['HONDURAS 3 PM', 'HONDURAS 3PM', 'HONDURAS TARDE'],
            crP23: ['PREMIA2 HONDURAS 3 PM', 'PREMIA 2 HONDURAS 3 PM'],
            horas: ['3:00 PM', '3:00PM', '3:00', '3 PM', '3PM']
        },
        '9PM': {
            crP1: ['HONDURAS 9 PM', 'HONDURAS 9PM', 'HONDURAS NOCHE'],
            crP23: ['PREMIA2 HONDURAS 9 PM', 'PREMIA 2 HONDURAS 9 PM'],
            horas: ['9:00 PM', '9:00PM', '9:00', '9 PM', '9PM']
        }
    };

    const cfg = mapa[turno];
    if (!cfg) return null;

    const ldhRes = extraerDeLoteriasDeHondurasCom(fuentesHn.textoLdh, cfg.horas, infoFecha);
    const nacIdxRes = extraerDeNacionalLoteriaHn(fuentesHn.textoNacIdx, cfg.horas, infoFecha);
    const nacP2Res = extraerDeNacionalLoteriaHn(fuentesHn.textoNacP2, cfg.horas, infoFecha);
    const kingHnRes = extraerDeKingHonduras(fuentesHn.textoKingHn, cfg.horas, infoFecha);
    const crP1Str = extraerDeLoteriasCRPreciso(fuentesHn.textoCR, cfg.crP1, infoFecha.fechaISO, 2, 1);
    const crP23Arr = extraerDeLoteriasCRPreciso(fuentesHn.textoCR, cfg.crP23, infoFecha.fechaISO, 2, 2);

    const p1Arr =
        (ldhRes.p1 ? [ldhRes.p1] : null) ||
        (crP1Str ? [crP1Str] : null) ||
        (nacIdxRes.p1 ? [nacIdxRes.p1] : null) ||
        buscarEnYelu(fuentesHn.textoYeluDiaria, cfg.horas, infoFecha, 1);

    const p23Arr =
        ldhRes.p23 ||
        (Array.isArray(crP23Arr) ? crP23Arr : null) ||
        nacIdxRes.p23 ||
        nacP2Res.p23 ||
        kingHnRes.p23 ||
        buscarEnYelu(fuentesHn.textoYeluPremia2, cfg.horas, infoFecha, 2);

    if (p1Arr || p23Arr) {
        return {
            p1: p1Arr ? p1Arr[0] : null,
            p2: p23Arr ? p23Arr[0] : null,
            p3: p23Arr ? p23Arr[1] : null
        };
    }
    return null;
}

// ==========================================================
// HANDLER PRINCIPAL DE VERCEL (MAESTRO + MULTI-INQUILINO)
// ==========================================================
export default async function handler(req, res) {
    const diagnostico = [];

    try {
        const infoFecha = getInfoFechaPanama();
        const { fechaISO } = infoFecha;

        const [{ data: sorteos }, { data: yaRegistrados }] = await Promise.all([
            supabase.from('sorteos').select('id, nombre, estado, hora_cierre, inquilino_id'),
            supabase.from('resultados').select('sorteo_id, p1, p2, p3, inquilino_id').eq('fecha', fechaISO)
        ]);

        if (!sorteos || sorteos.length === 0) {
            return res.status(200).json({ success: false, message: 'No hay sorteos configurados.' });
        }

        const mapaRegistrados = new Map((yaRegistrados || []).map(r => [String(r.sorteo_id), r]));
        const estaCompleto = (s) => {
            const reg = mapaRegistrados.get(String(s.id));
            return Boolean(reg && reg.p1 && reg.p2 && reg.p3);
        };

        const aInsertar = [];

        const registrarResultado = (sorteo, resultado) => {
            if (!resultado) return false;
            const previo = mapaRegistrados.get(String(sorteo.id));
            const p1Final = resultado.p1 || previo?.p1 || null;
            const p2Final = resultado.p2 || previo?.p2 || null;
            const p3Final = resultado.p3 || previo?.p3 || null;

            if (!p1Final) return false;

            if (previo && previo.p1 === p1Final && previo.p2 === p2Final && previo.p3 === p3Final) {
                return Boolean(p1Final && p2Final && p3Final);
            }

            if (aInsertar.some(i => i.sorteo_id === sorteo.id)) return true;
            aInsertar.push({
                sorteo_id: sorteo.id,
                inquilino_id: sorteo.inquilino_id || null,
                fecha: fechaISO,
                p1: p1Final,
                p2: p2Final,
                p3: p3Final,
                primero: p1Final,
                segundo: p2Final,
                tercero: p3Final,
                updated_at: new Date().toISOString()
            });

            const etiquetaInq = sorteo.inquilino_id ? ` [Inquilino ${String(sorteo.inquilino_id).slice(0, 8)}]` : '';
            diagnostico.push(`Detectado ${sorteo.nombre}${etiquetaInq}: ${p1Final}-${p2Final || '--'}-${p3Final || '--'}`);
            return Boolean(p1Final && p2Final && p3Final);
        };

        // 1. PORTALES ABIERTOS PARA FLORIDA, NEW YORK, LA PRIMERA Y ANGUILLA
        const pendientesPortal = sorteos.filter(s =>
            !estaCompleto(s) &&
            ['PRIMERA', 'ANGUILLA', 'FLORIDA', 'YORK'].some(r => normalizar(s.nombre).includes(r)) &&
            yaPasoHoraRealSorteo(s, infoFecha)
        );

        if (pendientesPortal.length > 0) {
            const fuentesAbiertas = [
                'https://enloteria.com/',
                'https://www.kingarrobanumeros.com/resultados'
            ];

            for (const url of fuentesAbiertas) {
                const faltantes = pendientesPortal.filter(p => !aInsertar.some(i => i.sorteo_id === p.id));
                if (faltantes.length === 0) break;

                const { html, estado } = await descargarPaginaAbierta(url);
                diagnostico.push(`${new URL(url).hostname}: ${estado}`);
                if (!html) continue;

                for (const s of faltantes) {
                    registrarResultado(s, extraer3PremiosAbierto(html, s.nombre, infoFecha));
                }
            }
        }

        // 2. CENTROAMÉRICA (TICA, NICA Y HONDURAS)
        const pendientesCA = sorteos.filter(s =>
            !estaCompleto(s) &&
            ['TICA', 'NICA', 'HONDURAS'].some(r => normalizar(s.nombre).includes(r)) &&
            yaPasoHoraRealSorteo(s, infoFecha)
        );

        if (pendientesCA.length > 0) {
            const { html: htmlCR, estado: estadoCR } = await descargarPaginaAbierta('https://loteriascostarica.com/');
            diagnostico.push(`loteriascostarica.com: ${estadoCR}`);
            const textoCR = htmlCR ? normalizar(limpiarHtmlATexto(htmlCR)) : '';

            // TICA
            const pendientesTica = pendientesCA.filter(x => normalizar(x.nombre).includes('TICA'));
            if (pendientesTica.length > 0) {
                let textoKingTica = '';
                let textoYeluCr = '';
                for (const s of pendientesTica) {
                    const okCR = registrarResultado(s, extraerTicaCompleto(textoCR, '', '', s.nombre, infoFecha));
                    if (!okCR) {
                        if (!textoKingTica && !textoYeluCr) {
                            const [resKT, resYC] = await Promise.all([
                                descargarPaginaAbierta('https://www.kingarrobanumeros.com/tica-hoy'),
                                descargarPaginaAbierta('https://www.yelu.cr/lottery/results/nuevos-tiempos')
                            ]);
                            diagnostico.push(`king_tica: ${resKT.estado}`, `yelu_cr: ${resYC.estado}`);
                            textoKingTica = resKT.html ? normalizar(limpiarHtmlATexto(resKT.html)) : '';
                            textoYeluCr = resYC.html ? normalizar(limpiarHtmlATexto(resYC.html)) : '';
                        }
                        registrarResultado(s, extraerTicaCompleto(textoCR, textoKingTica, textoYeluCr, s.nombre, infoFecha));
                    }
                }
            }

            // NICA
            const pendientesNica = pendientesCA.filter(x => normalizar(x.nombre).includes('NICA'));
            if (pendientesNica.length > 0) {
                const [resNY, resYeluNi] = await Promise.all([
                    descargarPaginaAbierta('https://nuevaya.com.ni/loto-diaria-de-nicaragua/'),
                    descargarPaginaAbierta('https://www.yelu.ni/lottery/results/la-diaria')
                ]);
                diagnostico.push(`nuevaya.com.ni: ${resNY.estado}`, `yelu_ni: ${resYeluNi.estado}`);
                const textoNuevaYa = resNY.html ? normalizar(limpiarHtmlATexto(resNY.html)) : '';
                const textoYeluNi = resYeluNi.html ? normalizar(limpiarHtmlATexto(resYeluNi.html)) : '';

                for (const s of pendientesNica) {
                    registrarResultado(s, extraerNicaCompleto(textoCR, textoNuevaYa, textoYeluNi, s.nombre, infoFecha));
                }
            }

            // HONDURAS (múltiples fuentes en paralelo + proxy r.jina.ai)
            const pendientesHn = pendientesCA.filter(x => normalizar(x.nombre).includes('HONDURAS'));
            if (pendientesHn.length > 0) {
                const [resLdh, resLdhP2, resNacIdx, resNacP2, resKingHn, resYeluP1, resYeluP23, resGuruP2] = await Promise.all([
                    descargarPaginaAbierta('https://loteriasdehonduras.com/', 5500, true),
                    descargarPaginaAbierta('https://loteriasdehonduras.com/premia-2/', 5500, true),
                    descargarPaginaAbierta('https://www.nacionalloteria.com/honduras/index.php'),
                    descargarPaginaAbierta('https://www.nacionalloteria.com/honduras/loto-premia2.php'),
                    descargarPaginaAbierta('https://www.kingarrobanumeros.com/honduras-hoy'),
                    descargarPaginaAbierta('https://www.yelu.hn/lottery/results/la-diaria'),
                    descargarPaginaAbierta('https://www.yelu.hn/lottery/results/premia-dos'),
                    descargarPaginaAbierta('https://loterias.guru/honduras/premia-2')
                ]);

                diagnostico.push(
                    `ldh: ${resLdh.estado}`,
                    `ldh_p2: ${resLdhP2.estado}`,
                    `nac_hn_idx: ${resNacIdx.estado}`,
                    `nac_hn_p2: ${resNacP2.estado}`,
                    `king_hn: ${resKingHn.estado}`,
                    `yelu_diaria: ${resYeluP1.estado}`,
                    `yelu_premia2: ${resYeluP23.estado}`,
                    `guru_p2: ${resGuruP2.estado}`
                );

                const fuentesHn = {
                    textoCR,
                    textoLdh: [
                        resLdh.html ? normalizar(limpiarHtmlATexto(resLdh.html)) : '',
                        resLdhP2.html ? normalizar(limpiarHtmlATexto(resLdhP2.html)) : ''
                    ].join(' '),
                    textoNacIdx: resNacIdx.html ? normalizar(limpiarHtmlATexto(resNacIdx.html)) : '',
                    textoNacP2: resNacP2.html ? normalizar(limpiarHtmlATexto(resNacP2.html)) : '',
                    textoKingHn: resKingHn.html ? normalizar(limpiarHtmlATexto(resKingHn.html)) : '',
                    textoYeluDiaria: resYeluP1.html ? normalizar(limpiarHtmlATexto(resYeluP1.html)) : '',
                    textoYeluPremia2: [
                        resYeluP23.html ? normalizar(limpiarHtmlATexto(resYeluP23.html)) : '',
                        resGuruP2.html ? normalizar(limpiarHtmlATexto(resGuruP2.html)) : ''
                    ].join(' ')
                };

                for (const s of pendientesHn) {
                    registrarResultado(s, extraerHondurasCompleto(fuentesHn, s.nombre, infoFecha));
                }
            }
        }

        if (aInsertar.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'Escaneo completado. Sin resultados nuevos pendientes para hoy.',
                diagnostico
            });
        }

        // 3. Guardar en Supabase (con inquilino_id correspondiente) y escrutar en paralelo
        const { error: errInsert } = await supabase
            .from('resultados')
            .upsert(aInsertar, { onConflict: 'sorteo_id,fecha' });

        if (errInsert) throw errInsert;

        await Promise.all(aInsertar.map(async (item) => {
            await supabase.from('sorteos').update({
                p1: item.p1,
                p2: item.p2,
                p3: item.p3,
                primer_premio: item.p1,
                segundo_premio: item.p2,
                tercer_premio: item.p3
            }).eq('id', item.sorteo_id);

            try {
                await supabase.rpc('evaluar_tickets_sorteo', {
                    p_sorteo_id: item.sorteo_id,
                    p_fecha: fechaISO
                });
            } catch {}
        }));

        return res.status(200).json({
            success: true,
            message: `Actualizados ${aInsertar.length} sorteos automáticamente.`,
            data: aInsertar,
            diagnostico
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message, diagnostico });
    }
}