import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const MESES_ES = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
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
    const mesNombre = MESES_ES[parseInt(mes, 10) - 1];
    return {
        fechaISO,
        hora24,
        anio,
        dia,
        mes,
        diaNum: String(parseInt(dia, 10)),
        mesNombre
    };
}

function contieneFechaHoy(textoPlano, infoFecha) {
    const norm = normalizar(textoPlano);
    const { fechaISO, dia, diaNum, mes, mesNombre } = infoFecha;
    const mesNorm = normalizar(mesNombre);
    const mesCorto = mesNorm.substring(0, 3);

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
        norm.includes(`${mesCorto} ${dia}`)
    );
}

function limpiarFechasYHoras(textoNorm) {
    return textoNorm
        .replace(/\b\d{1,2}[-\/]\d{1,2}(?:[-\/]\d{2,4})?\b/g, ' ')
        .replace(/\b\d{1,2}\s*(?:DE\s+)?(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)[A-Z]*\b/g, ' ')
        .replace(/\b(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)[A-Z]*\s+\d{1,2}(?:,?\s*\d{4})?\b/g, ' ')
        .replace(/\b(?:LUNES|MARTES|MIERCOLES|JUEVES|VIERNES|SABADO|DOMINGO)\s+\d{1,2}\b/g, ' ')
        .replace(/\b\d{1,2}:\d{2}\s*(?:A\.?M\.?|P\.?M\.?|M\.?D\.?)?\b/g, ' ');
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
        // Anguilla (AST UTC-4) va +1 hora respecto a Panamá (UTC-5)
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

            // Evitar que "LA PRIMERA" capture por error "LA PRIMERA NOCHE"
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
// B. EXTRACTOR TICA (COSTA RICA - 1 PREMIO DE 2 DÍGITOS)
// ==========================================================
function obtenerHoraTica(nombreSorteo) {
    const n = normalizar(nombreSorteo);
    if (n.includes('2PM') || n.includes('2:00') || n.includes('DIA') || n.includes('1PM')) {
        return ['12:55', '1:00', 'MEDIODIA', 'MEDIO DIA', 'TICA DIA'];
    }
    if (n.includes('5:30') || n.includes('5PM') || n.includes('TARDE') || n.includes('3:00')) {
        return ['4:30', 'TICA TARDE', 'TARDE'];
    }
    if (n.includes('8:30') || n.includes('8PM') || n.includes('NOCHE') || n.includes('7:30')) {
        return ['7:30', 'TICA NOCHE', 'NOCHE'];
    }
    return [];
}

function extraerTica(html, nombreSorteo, infoFecha) {
    if (!html) return null;
    const texto = normalizar(limpiarHtmlATexto(html));
    if (!contieneFechaHoy(texto, infoFecha)) return null;

    const etiquetas = obtenerHoraTica(nombreSorteo);
    for (const etq of etiquetas) {
        let idx = texto.indexOf(etq);
        while (idx !== -1) {
            const despues = limpiarFechasYHoras(texto.substring(idx + etq.length, idx + etq.length + 80));
            const matchDespues = despues.match(/\b(\d{2})\b/);
            if (matchDespues) {
                return { p1: matchDespues[1], p2: null, p3: null };
            }

            const antes = limpiarFechasYHoras(texto.substring(Math.max(0, idx - 50), idx));
            const matchesAntes = [...antes.matchAll(/\b(\d{2})\b/g)];
            if (matchesAntes.length > 0) {
                return { p1: matchesAntes[matchesAntes.length - 1][1], p2: null, p3: null };
            }
            idx = texto.indexOf(etq, idx + etq.length);
        }
    }
    return null;
}

// ==========================================================
// C. EXTRACTOR NICA (DIARIA = 1RO, PREMIA2 = 2DO Y 3RO)
// ==========================================================
function obtenerHoraNica(nombreSorteo) {
    const n = normalizar(nombreSorteo);
    if (n.includes('12') || n.includes('11') || n.includes('AM') || n.includes('DIA')) return ['11:00 AM', '11:00AM', '11:00'];
    if (n.includes('4') || n.includes('3') || n.includes('TARDE')) return ['3:00 PM', '3:00PM', '3:00'];
    if (n.includes('7') || n.includes('6')) return ['6:00 PM', '6:00PM', '6:00'];
    if (n.includes('10') || n.includes('9') || n.includes('NOCHE')) return ['9:00 PM', '9:00PM', '9:00'];
    return [];
}

function extraerNicaCompleto(html, nombreSorteo, infoFecha) {
    if (!html) return null;
    const texto = normalizar(limpiarHtmlATexto(html));
    if (!contieneFechaHoy(texto, infoFecha)) return null;

    const horas = obtenerHoraNica(nombreSorteo);
    for (const h of horas) {
        let idx = texto.indexOf(h);
        while (idx !== -1) {
            // Ampliado a 600 caracteres para cubrir toda la fila de la tabla (Diaria -> Premia2)
            const bloque = texto.substring(idx, idx + 600);
            const matchDiaria = bloque.match(/\b(\d{2})\s*\(/);
            const matchPremia2 = bloque.match(/\b(\d{2})\s*-\s*(\d{2})\b/);

            if (matchDiaria && matchPremia2) {
                return { p1: matchDiaria[1], p2: matchPremia2[1], p3: matchPremia2[2] };
            }

            // Formato alternativo en agregadores (ej: "11:00 AM 53 ... PREMIA2 27 - 26")
            if (matchPremia2) {
                const limpio = limpiarFechasYHoras(bloque.substring(h.length, bloque.indexOf(matchPremia2[0])));
                const primerNum = limpio.match(/\b(\d{2})\b/);
                if (primerNum) {
                    return { p1: primerNum[1], p2: matchPremia2[1], p3: matchPremia2[2] };
                }
            }
            idx = texto.indexOf(h, idx + h.length);
        }
    }
    return null;
}

// ==========================================================
// D. EXTRACTOR HONDURAS (LA DIARIA = 1RO, PREMIA2 = 2DO Y 3RO)
// ==========================================================
function obtenerHoraHonduras(nombreSorteo) {
    const n = normalizar(nombreSorteo);
    if (n.includes('12') || n.includes('11') || n.includes('AM') || n.includes('DIA')) return ['11:00 AM', '11:00AM', '11:00'];
    if (n.includes('4') || n.includes('3') || n.includes('TARDE')) return ['3:00 PM', '3:00PM', '3:00'];
    if (n.includes('10') || n.includes('9') || n.includes('NOCHE')) return ['9:00 PM', '9:00PM', '9:00'];
    return [];
}

function extraerHondurasCompleto(html, nombreSorteo, infoFecha) {
    if (!html) return null;
    const texto = normalizar(limpiarHtmlATexto(html));
    if (!contieneFechaHoy(texto, infoFecha)) return null;

    const horas = obtenerHoraHonduras(nombreSorteo);
    for (const h of horas) {
        let idx = texto.indexOf(h);
        while (idx !== -1) {
            const bloque = texto.substring(idx, idx + 450);
            const matchPremia2 = bloque.match(/\b(\d{2})\s*-\s*(\d{2})\b/);
            if (matchPremia2) {
                const antesPremia = limpiarFechasYHoras(bloque.substring(h.length, bloque.indexOf(matchPremia2[0])));
                const numDiaria = antesPremia.match(/\b(\d{2})\b/);
                if (numDiaria) {
                    return { p1: numDiaria[1], p2: matchPremia2[1], p3: matchPremia2[2] };
                }
            }
            idx = texto.indexOf(h, idx + h.length);
        }
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

                // Muestra diagnóstica si alguno sigue sin coincidir en enloteria.com
                if (url.includes('enloteria.com')) {
                    const txt = normalizar(limpiarHtmlATexto(html));
                    for (const f of faltantes) {
                        if (!aInsertar.some(i => i.sorteo_id === f.id)) {
                            const clave = normalizar(f.nombre).split(' ')[0];
                            const p = txt.indexOf(clave);
                            if (p !== -1) diagnostico.push(`Muestra_${clave}: ${txt.substring(p, p + 95)}`);
                        }
                    }
                }
            }
        }

        // 2. TICA (Costa Rica)
        const pendientesTica = sorteos.filter(s =>
            !idsYaEscrutados.has(String(s.id)) &&
            normalizar(s.nombre).includes('TICA') &&
            (!s.hora_cierre || hora24 >= s.hora_cierre)
        );
        if (pendientesTica.length > 0) {
            const { html, estado } = await descargarPaginaAbierta('https://www.kingarrobanumeros.com/tica-hoy');
            diagnostico.push(`TICA: ${estado}`);
            if (html) {
                for (const s of pendientesTica) {
                    const ok = registrarResultado(s, extraerTica(html, s.nombre, infoFecha));
                    if (!ok) {
                        const txt = normalizar(limpiarHtmlATexto(html));
                        const p = txt.indexOf('TICA');
                        if (p !== -1) diagnostico.push(`Muestra_TICA: ${txt.substring(p, p + 120)}`);
                    }
                }
            }
        }

        // 3. NICA (Nicaragua)
        const pendientesNica = sorteos.filter(s =>
            !idsYaEscrutados.has(String(s.id)) &&
            normalizar(s.nombre).includes('NICA') &&
            (!s.hora_cierre || hora24 >= s.hora_cierre)
        );
        if (pendientesNica.length > 0) {
            const urlsNica = [
                'https://nuevaya.com.ni/loto-diaria-de-nicaragua/',
                'https://www.kingarrobanumeros.com/nica-hoy'
            ];
            for (const url of urlsNica) {
                const faltantes = pendientesNica.filter(p => !aInsertar.some(i => i.sorteo_id === p.id));
                if (faltantes.length === 0) break;

                const { html, estado } = await descargarPaginaAbierta(url);
                diagnostico.push(`NICA (${new URL(url).hostname}): ${estado}`);
                if (!html) continue;

                for (const s of faltantes) {
                    const ok = registrarResultado(s, extraerNicaCompleto(html, s.nombre, infoFecha));
                    if (!ok && url.includes('nuevaya')) {
                        const txt = normalizar(limpiarHtmlATexto(html));
                        const p = txt.indexOf('11:00');
                        if (p !== -1) diagnostico.push(`Muestra_NICA: ${txt.substring(p, p + 140)}`);
                    }
                }
            }
        }

        // 4. HONDURAS
        const pendientesHonduras = sorteos.filter(s =>
            !idsYaEscrutados.has(String(s.id)) &&
            normalizar(s.nombre).includes('HONDURAS') &&
            (!s.hora_cierre || hora24 >= s.hora_cierre)
        );
        if (pendientesHonduras.length > 0) {
            const urlsHn = [
                'https://www.kingarrobanumeros.com/honduras-hoy',
                'https://www.kingarrobanumeros.com/resultados'
            ];
            for (const url of urlsHn) {
                const faltantes = pendientesHonduras.filter(p => !aInsertar.some(i => i.sorteo_id === p.id));
                if (faltantes.length === 0) break;

                const { html, estado } = await descargarPaginaAbierta(url);
                diagnostico.push(`HONDURAS (${new URL(url).pathname}): ${estado}`);
                if (!html) continue;

                for (const s of faltantes) {
                    const ok = registrarResultado(s, extraerHondurasCompleto(html, s.nombre, infoFecha));
                    if (!ok) {
                        const txt = normalizar(limpiarHtmlATexto(html));
                        const p = txt.indexOf('HONDURAS');
                        if (p !== -1) diagnostico.push(`Muestra_HN: ${txt.substring(p, p + 140)}`);
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

        // 5. Guardar en Supabase y disparar escrutinio automático
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