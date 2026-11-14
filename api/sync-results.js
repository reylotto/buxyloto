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
    const [anio, mes, dia] = fechaISO.split('-');
    const idxMes = parseInt(mes, 10) - 1;
    return {
        fechaISO,
        hora24,
        anio,
        dia,
        mes,
        diaNum: String(parseInt(dia, 10)),
        mesNombre: MESES_ES[idxMes],
        mesNombreEn: MESES_EN[idxMes]
    };
}

function contieneFechaHoy(textoPlano, infoFecha) {
    const norm = normalizar(textoPlano);
    const { fechaISO, dia, diaNum, mes, mesNombre, mesNombreEn } = infoFecha;
    const mesNorm = normalizar(mesNombre);
    const mesCorto = mesNorm.substring(0, 3);
    const mesEnNorm = normalizar(mesNombreEn);
    const mesEnCorto = mesEnNorm.substring(0, 3);

    return (
        norm.includes(fechaISO) ||
        norm.includes(`${dia}/${mes}`) ||
        norm.includes(`${dia}-${mes}`) ||
        norm.includes(`${diaNum}/${mes}`) ||
        norm.includes(`${diaNum}-${mes}`) ||
        norm.includes(`${diaNum} DE ${mesNorm}`) ||
        norm.includes(`${dia} DE ${mesNorm}`) ||
        norm.includes(`${diaNum} ${mesCorto}`) ||
        norm.includes(`${dia} ${mesCorto}`) ||
        norm.includes(`${mesNorm} ${diaNum}`) ||
        norm.includes(`${mesNorm} ${dia}`) ||
        norm.includes(`${mesCorto} ${diaNum}`) ||
        norm.includes(`${mesCorto} ${dia}`) ||
        norm.includes(`${diaNum} ${mesEnCorto}`) ||
        norm.includes(`${dia} ${mesEnCorto}`) ||
        norm.includes(`${mesEnNorm} ${diaNum}`) ||
        norm.includes(`${mesEnCorto} ${diaNum}`)
    );
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
        .replace(/\b\d{1,2}\s*(?:A\.?M\.?|P\.?M\.?)\b/g, ' ');
}

async function descargarPaginaAbierta(url, timeoutMs = 5500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'es-ES,es;q=0.9'
            }
        });
        if (!res.ok) {
            return { html: null, estado: `HTTP_${res.status}` };
        }
        const html = await res.text();
        if (!html || html.includes('Just a moment...') || html.includes('cf-browser-verification')) {
            return { html: null, estado: 'BLOQUEO_CF' };
        }
        return { html, estado: 'HTTP_200' };
    } catch (e) {
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
        if (n.includes('11') || n.includes('DIA') || n.includes('12')) {
            return ['LA PRIMERA DIA', 'PRIMERA DIA', 'LA PRIMERA 12:00', 'LA PRIMERA'];
        }
        if (n.includes('6') || n.includes('7') || n.includes('8') || n.includes('NOCHE')) {
            return ['PRIMERA NOCHE', 'LA PRIMERA NOCHE', 'LA PRIMERA 8:00'];
        }
    }
    if (n.includes('FLORIDA')) {
        if (n.includes('12') || n.includes('1') || n.includes('DIA') || n.includes('TARDE')) {
            return ['FLORIDA DIA', 'FLORIDA TARDE', 'FLORIDA AM'];
        }
        if (n.includes('6') || n.includes('8') || n.includes('9') || n.includes('NOCHE')) {
            return ['FLORIDA NOCHE', 'FLORIDA PM'];
        }
    }
    if (n.includes('YORK')) {
        if (n.includes('1') || n.includes('2') || n.includes('DIA') || n.includes('TARDE')) {
            return ['NEW YORK TARDE', 'NEW YORK DIA', 'NEW YORK AM'];
        }
        if (n.includes('9') || n.includes('10') || n.includes('NOCHE')) {
            return ['NEW YORK NOCHE', 'NEW YORK PM'];
        }
    }
    if (n.includes('ANGUILLA')) {
        if (n.includes('9AM') || n.includes('10')) {
            return ['ANGUILLA 10:00', 'ANGUILLA 10AM', 'ANGUILLA MANANA'];
        }
        if (n.includes('12') || n.includes('1PM') || n.includes('TARDE')) {
            return ['ANGUILLA 1:00', 'ANGUILLA 1PM', 'ANGUILLA 12:00', 'ANGUILLA 12PM', 'ANGUILLA TARDE'];
        }
        if (n.includes('5') || n.includes('6')) {
            return ['ANGUILLA 6:00', 'ANGUILLA 6PM', 'ANGUILLA 5:00', 'ANGUILLA 5PM'];
        }
        if (n.includes('8') || n.includes('9PM') || n.includes('NOCHE')) {
            return ['ANGUILLA 9:00', 'ANGUILLA 9PM', 'ANGUILLA 8:00', 'ANGUILLA 8PM', 'ANGUILLA NOCHE'];
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
            const cabeceraPropia = texto.substring(idx + etq.length, idx + etq.length + 55);
            if (buscaDiaPrimera && etq === 'LA PRIMERA' && cabeceraPropia.startsWith(' NOCHE')) {
                idx = texto.indexOf(etq, idx + etq.length);
                continue;
            }

            if (contieneFechaHoy(cabeceraPropia, infoFecha)) {
                const despuesLimpio = limpiarFechasYHoras(
                    texto.substring(idx + etq.length, idx + etq.length + 130)
                );
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
// B. EXTRACTOR UNIFICADO LOTERIASCOSTARICA.COM (TICA, NICA, HONDURAS)
// ==========================================================
function extraerDeLoteriasCR(textoNorm, etiquetas, fechaISO, cantidad = 1) {
    if (!textoNorm) return null;

    for (const etq of etiquetas) {
        let idx = textoNorm.indexOf(etq);
        while (idx !== -1) {
            const ventana = textoNorm.substring(idx + etq.length, idx + etq.length + 120);
            if (ventana.includes(fechaISO)) {
                const limpio = limpiarFechasYHoras(ventana);
                const nums = limpio.match(/\b\d{2}\b/g);
                if (nums && nums.length >= cantidad) {
                    return nums.slice(0, cantidad);
                }
            }
            idx = textoNorm.indexOf(etq, idx + etq.length);
        }
    }
    return null;
}

function getTurnoCentroamerica(nombreSorteo) {
    const n = normalizar(nombreSorteo);
    if (n.includes('12') || n.includes('11') || n.includes('AM') || n.includes('DIA')) return '11AM';
    if (n.includes('4') || n.includes('3') || n.includes('TARDE')) return '3PM';
    if (n.includes('7') || n.includes('6')) return '6PM';
    if (n.includes('10') || n.includes('9') || n.includes('NOCHE')) return '9PM';
    return '';
}

function extraerTicaDePortalCR(textoNorm, nombreSorteo, fechaISO) {
    const n = normalizar(nombreSorteo);
    let etiquetas = [];

    if (n.includes('2PM') || n.includes('2:00') || n.includes('DIA') || n.includes('1PM')) {
        etiquetas = ['TICA DIA REVENTADOS', 'TICA DIA', 'TICA 12:55', 'TICA 1:00'];
    } else if (n.includes('5:30') || n.includes('5PM') || n.includes('TARDE') || n.includes('3:00')) {
        etiquetas = ['TICA TARDE REVENTADOS', 'TICA TARDE', 'TICA 4:30'];
    } else if (n.includes('8:30') || n.includes('8PM') || n.includes('NOCHE') || n.includes('7:30')) {
        etiquetas = ['TICA NOCHE REVENTADOS', 'TICA NOCHE', 'TICA 7:30'];
    }

    const nums = extraerDeLoteriasCR(textoNorm, etiquetas, fechaISO, 1);
    return nums ? { p1: nums[0], p2: null, p3: null } : null;
}

function extraerNicaDePortalCR(textoNorm, nombreSorteo, fechaISO) {
    const turno = getTurnoCentroamerica(nombreSorteo);
    const mapa = {
        '11AM': { nica: ['NICA 11 AM', 'NICA 11AM'], premia: ['PREMIA2 11 AM', 'PREMIA2 11AM'] },
        '3PM':  { nica: ['NICA 3 PM', 'NICA 3PM'],   premia: ['PREMIA2 3 PM', 'PREMIA2 3PM'] },
        '6PM':  { nica: ['NICA 6 PM', 'NICA 6PM'],   premia: ['PREMIA2 6 PM', 'PREMIA2 6PM'] },
        '9PM':  { nica: ['NICA 9 PM', 'NICA 9PM'],   premia: ['PREMIA2 9 PM', 'PREMIA2 9PM'] }
    };
    const cfg = mapa[turno];
    if (!cfg) return null;

    const p1Arr = extraerDeLoteriasCR(textoNorm, cfg.nica, fechaISO, 1);
    const p23Arr = extraerDeLoteriasCR(textoNorm, cfg.premia, fechaISO, 2);

    if (p1Arr && p23Arr) {
        return { p1: p1Arr[0], p2: p23Arr[0], p3: p23Arr[1] };
    }
    return null;
}

function extraerNicaRespaldoNuevaYa(html, nombreSorteo, infoFecha) {
    if (!html) return null;
    const texto = normalizar(limpiarHtmlATexto(html));
    if (!contieneFechaHoy(texto, infoFecha)) return null;

    const turno = getTurnoCentroamerica(nombreSorteo);
    const mapaHoras = {
        '11AM': ['11:00 AM', '11:00AM'],
        '3PM':  ['3:00 PM', '3:00PM'],
        '6PM':  ['6:00 PM', '6:00PM'],
        '9PM':  ['9:00 PM', '9:00PM']
    };
    const horas = mapaHoras[turno] || [];

    for (const h of horas) {
        let idx = texto.indexOf(h);
        while (idx !== -1) {
            const bloque = texto.substring(idx, idx + 650);
            const matchDiaria = bloque.match(/\b(\d{2})\s*\(/);
            const matchPremia2 = bloque.match(/\b(\d{2})\s*-\s*(\d{2})\b/);
            if (matchDiaria && matchPremia2) {
                return { p1: matchDiaria[1], p2: matchPremia2[1], p3: matchPremia2[2] };
            }
            idx = texto.indexOf(h, idx + h.length);
        }
    }
    return null;
}

// ==========================================================
// C. EXTRACTOR HONDURAS (LA DIARIA = 1RO, PREMIA2 = 2DO Y 3RO)
// ==========================================================
function buscarEnYeluHonduras(textoYelu, etiquetasHora, infoFecha, cantidad = 1) {
    if (!textoYelu) return null;
    for (const etq of etiquetasHora) {
        let idx = textoYelu.indexOf(etq);
        while (idx !== -1) {
            // Ampliado a 360 chars hacia arriba para alcanzar el encabezado de fecha de la tarjeta
            const entorno = textoYelu.substring(Math.max(0, idx - 360), idx + 180);
            if (contieneFechaHoy(entorno, infoFecha)) {
                const rawDespues = textoYelu.substring(idx + etq.length, idx + etq.length + 85);

                // Si buscamos 2 números (Premia2), detectar par con guion antes de limpiar
                if (cantidad === 2) {
                    const mGuion = rawDespues.match(/\b(\d{2})\s*-\s*(\d{2})\b/);
                    if (mGuion) return [mGuion[1], mGuion[2]];
                }

                const despues = limpiarFechasYHoras(rawDespues);
                const numsDespues = despues.match(/\b\d{2}\b/g);
                if (numsDespues && numsDespues.length >= cantidad) {
                    return numsDespues.slice(0, cantidad);
                }

                // Respaldo: números ubicados justo ANTES de la etiqueta de hora
                const rawAntes = textoYelu.substring(Math.max(0, idx - 55), idx);
                const antes = limpiarFechasYHoras(rawAntes);
                const numsAntes = antes.match(/\b\d{2}\b/g);
                if (numsAntes && numsAntes.length >= cantidad) {
                    return numsAntes.slice(-cantidad);
                }
            }
            idx = textoYelu.indexOf(etq, idx + etq.length);
        }
    }
    return null;
}

function extraerHondurasCompleto(fuentesHn, nombreSorteo, infoFecha) {
    const turno = getTurnoCentroamerica(nombreSorteo);
    const mapa = {
        '11AM': {
            crP1: ['HONDURAS 11 AM', 'HONDURAS 11AM', 'DIARIA 11 AM', 'DIARIA 11AM', 'LA DIARIA 11 AM', 'LA DIARIA 11AM'],
            crP23: ['PREMIA2 HONDURAS 11 AM', 'HONDURAS PREMIA2 11 AM', 'PREMIA 2 HONDURAS 11 AM'],
            yeluHoras: ['11:00 AM', '11:00AM', '11 AM', '11AM']
        },
        '3PM': {
            crP1: ['HONDURAS 3 PM', 'HONDURAS 3PM', 'DIARIA 3 PM', 'DIARIA 3PM', 'LA DIARIA 3 PM', 'LA DIARIA 3PM'],
            crP23: ['PREMIA2 HONDURAS 3 PM', 'HONDURAS PREMIA2 3 PM', 'PREMIA 2 HONDURAS 3 PM'],
            yeluHoras: ['3:00 PM', '3:00PM', '3 PM', '3PM']
        },
        '9PM': {
            crP1: ['HONDURAS 9 PM', 'HONDURAS 9PM', 'DIARIA 9 PM', 'DIARIA 9PM', 'LA DIARIA 9 PM', 'LA DIARIA 9PM'],
            crP23: ['PREMIA2 HONDURAS 9 PM', 'HONDURAS PREMIA2 9 PM', 'PREMIA 2 HONDURAS 9 PM'],
            yeluHoras: ['9:00 PM', '9:00PM', '9 PM', '9PM']
        }
    };

    const cfg = mapa[turno];
    if (!cfg) return null;

    // 1. Obtener 1er premio (La Diaria)
    const p1Arr =
        extraerDeLoteriasCR(fuentesHn.textoCR, cfg.crP1, infoFecha.fechaISO, 1) ||
        buscarEnYeluHonduras(fuentesHn.textoYeluDiaria, cfg.yeluHoras, infoFecha, 1);

    // 2. Obtener 2do y 3er premio (Premia2)
    const p23Arr =
        extraerDeLoteriasCR(fuentesHn.textoCR, cfg.crP23, infoFecha.fechaISO, 2) ||
        buscarEnYeluHonduras(fuentesHn.textoYeluPremia2, cfg.yeluHoras, infoFecha, 2);

    if (p1Arr && p23Arr) {
        return { p1: p1Arr[0], p2: p23Arr[0], p3: p23Arr[1] };
    }
    return null;
}

// ==========================================================
// HANDLER PRINCIPAL DE VERCEL
// ==========================================================
export default async function handler(req, res) {
    const diagnostico = [];

    try {
        const infoFecha = getInfoFechaPanama();
        const { fechaISO, hora24 } = infoFecha;

        const [{ data: sorteos }, { data: yaRegistrados }] = await Promise.all([
            supabase.from('sorteos').select('id, nombre, estatus, hora_cierre'),
            supabase.from('resultados').select('sorteo_id').eq('fecha', fechaISO)
        ]);

        if (!sorteos || sorteos.length === 0) {
            return res.status(200).json({ success: false, message: 'No hay sorteos configurados.' });
        }

        const idsYaEscrutados = new Set((yaRegistrados || []).map(r => String(r.sorteo_id)));
        const aInsertar = [];

        const registrarResultado = (sorteo, resultado) => {
            if (!resultado || !resultado.p1) return false;
            if (aInsertar.some(i => i.sorteo_id === sorteo.id)) return true;
            aInsertar.push({
                sorteo_id: sorteo.id,
                fecha: fechaISO,
                p1: resultado.p1,
                p2: resultado.p2 || null,
                p3: resultado.p3 || null,
                primero: resultado.p1,
                segundo: resultado.p2 || null,
                tercero: resultado.p3 || null,
                updated_at: new Date().toISOString()
            });
            diagnostico.push(`Detectado ${sorteo.nombre}: ${resultado.p1}-${resultado.p2 || '--'}-${resultado.p3 || '--'}`);
            return true;
        };

        // 1. PORTALES ABIERTOS PARA FLORIDA, NEW YORK, LA PRIMERA Y ANGUILLA
        const pendientesPortal = sorteos.filter(s =>
            !idsYaEscrutados.has(String(s.id)) &&
            ['PRIMERA', 'ANGUILLA', 'FLORIDA', 'YORK'].some(r => normalizar(s.nombre).includes(r)) &&
            (!s.hora_cierre || hora24 >= s.hora_cierre)
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
            !idsYaEscrutados.has(String(s.id)) &&
            ['TICA', 'NICA', 'HONDURAS'].some(r => normalizar(s.nombre).includes(r)) &&
            (!s.hora_cierre || hora24 >= s.hora_cierre)
        );

        if (pendientesCA.length > 0) {
            const { html: htmlCR, estado: estadoCR } = await descargarPaginaAbierta('https://loteriascostarica.com/');
            diagnostico.push(`loteriascostarica.com: ${estadoCR}`);
            const textoCR = htmlCR ? normalizar(limpiarHtmlATexto(htmlCR)) : '';

            // TICA
            for (const s of pendientesCA.filter(x => normalizar(x.nombre).includes('TICA'))) {
                registrarResultado(s, extraerTicaDePortalCR(textoCR, s.nombre, fechaISO));
            }

            // NICA
            const pendientesNica = pendientesCA.filter(x => normalizar(x.nombre).includes('NICA'));
            if (pendientesNica.length > 0) {
                for (const s of pendientesNica) {
                    registrarResultado(s, extraerNicaDePortalCR(textoCR, s.nombre, fechaISO));
                }
                const faltanNica = pendientesNica.filter(p => !aInsertar.some(i => i.sorteo_id === p.id));
                if (faltanNica.length > 0) {
                    const { html: htmlNY, estado: estadoNY } = await descargarPaginaAbierta('https://nuevaya.com.ni/loto-diaria-de-nicaragua/');
                    diagnostico.push(`nuevaya.com.ni: ${estadoNY}`);
                    for (const s of faltanNica) {
                        registrarResultado(s, extraerNicaRespaldoNuevaYa(htmlNY, s.nombre, infoFecha));
                    }
                }
            }

            // HONDURAS (Yelu La Diaria + Yelu Premia2 + Portal CR)
            const pendientesHn = pendientesCA.filter(x => normalizar(x.nombre).includes('HONDURAS'));
            if (pendientesHn.length > 0) {
                const [resYeluP1, resYeluP23] = await Promise.all([
                    descargarPaginaAbierta('https://www.yelu.hn/lottery/results/la-diaria'),
                    descargarPaginaAbierta('https://www.yelu.hn/lottery/results/premia-dos')
                ]);

                diagnostico.push(`yelu_diaria: ${resYeluP1.estado}`, `yelu_premia2: ${resYeluP23.estado}`);

                const fuentesHn = {
                    textoCR,
                    textoYeluDiaria: resYeluP1.html ? normalizar(limpiarHtmlATexto(resYeluP1.html)) : '',
                    textoYeluPremia2: resYeluP23.html ? normalizar(limpiarHtmlATexto(resYeluP23.html)) : ''
                };

                for (const s of pendientesHn) {
                    const ok = registrarResultado(s, extraerHondurasCompleto(fuentesHn, s.nombre, infoFecha));
                    if (!ok) {
                        const idxYD = fuentesHn.textoYeluDiaria.indexOf('11:');
                        if (idxYD !== -1) diagnostico.push(`Muestra_Yelu_D: ${fuentesHn.textoYeluDiaria.substring(Math.max(0, idxYD - 70), idxYD + 90)}`);
                        const idxYP = fuentesHn.textoYeluPremia2.indexOf('11:');
                        if (idxYP !== -1) diagnostico.push(`Muestra_Yelu_P2: ${fuentesHn.textoYeluPremia2.substring(Math.max(0, idxYP - 70), idxYP + 90)}`);
                        const idxCR = fuentesHn.textoCR.indexOf('DIARIA');
                        if (idxCR !== -1) diagnostico.push(`Muestra_CR_D: ${fuentesHn.textoCR.substring(idxCR, idxCR + 90)}`);
                    }
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

        // 3. Guardar en Supabase y disparar escrutinio automático
        const { error: errInsert } = await supabase
            .from('resultados')
            .upsert(aInsertar, { onConflict: 'sorteo_id,fecha' });

        if (errInsert) throw errInsert;

        for (const item of aInsertar) {
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
        }

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