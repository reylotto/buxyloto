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
        norm.includes(`${dia} ${mesCorto}`)
    );
}

async function descargarPaginaAbierta(url, timeoutMs = 5000) {
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
// A. EXTRACTOR PORTALES ABIERTOS (FLORIDA, NEW YORK, PRIMERA, ANGUILLA)
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
        if (n.includes('10') || n.includes('12') || n.includes('AM')) {
            return ['ANGUILLA 10:00', 'ANGUILLA MANANA', 'ANGUILLA 12:00'];
        }
        if (n.includes('1') || n.includes('TARDE')) {
            return ['ANGUILLA 1:00', 'ANGUILLA TARDE', 'ANGUILLA MEDIODIA'];
        }
        if (n.includes('5') || n.includes('6')) {
            return ['ANGUILLA 6:00', 'ANGUILLA 5:00'];
        }
        if (n.includes('8') || n.includes('9') || n.includes('NOCHE')) {
            return ['ANGUILLA 9:00', 'ANGUILLA NOCHE', 'ANGUILLA 8:00'];
        }
    }
    return [n];
}

function extraer3PremiosAbierto(html, nombreSorteo, infoFecha) {
    if (!html) return null;
    const texto = normalizar(limpiarHtmlATexto(html));
    const etiquetas = obtenerEtiquetas3Premios(nombreSorteo);

    for (const etq of etiquetas) {
        let idx = texto.indexOf(etq);
        while (idx !== -1) {
            // Revisar ventana alrededor del sorteo para validar que la fecha sea de hoy
            const ventanaFecha = texto.substring(Math.max(0, idx - 70), idx + 220);
            if (contieneFechaHoy(ventanaFecha, infoFecha)) {
                const despues = texto
                    .substring(idx + etq.length, idx + etq.length + 160)
                    .replace(/\b\d{1,2}[-\/]\d{1,2}(?:[-\/]\d{2,4})?\b/g, ' ')
                    .replace(/\b\d{1,2}:\d{2}\s*(?:AM|PM)?\b/g, ' ');

                const nums = despues.match(/\b\d{2}\b/g);
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
        return ['12:55PM', '12:55 PM', '1:00 PM', '1:00PM', 'MEDIO DIA'];
    }
    if (n.includes('5:30') || n.includes('5PM') || n.includes('TARDE') || n.includes('3:00')) {
        return ['4:30PM', '4:30 PM', 'TARDE'];
    }
    if (n.includes('8:30') || n.includes('8PM') || n.includes('NOCHE') || n.includes('7:30')) {
        return ['7:30PM', '7:30 PM', 'NOCHE'];
    }
    return [];
}

function extraerTica(html, nombreSorteo, infoFecha) {
    if (!html) return null;
    const texto = normalizar(limpiarHtmlATexto(html));
    if (!contieneFechaHoy(texto, infoFecha)) return null;

    const etiquetas = obtenerHoraTica(nombreSorteo);
    for (const etq of etiquetas) {
        const idx = texto.indexOf(etq);
        if (idx === -1) continue;

        const ventana = texto
            .substring(idx + etq.length, idx + etq.length + 80)
            .replace(/\b\d{1,2}[-\/]\d{1,2}(?:[-\/]\d{2,4})?\b/g, ' ')
            .replace(/\b\d{1,2}:\d{2}\s*(?:AM|PM)?\b/g, ' ');

        const match = ventana.match(/\b(\d{2})\b/);
        if (match) {
            return { p1: match[1], p2: null, p3: null };
        }
    }
    return null;
}

// ==========================================================
// C. EXTRACTOR NICA (DIARIA = 1RO, PREMIA2 = 2DO Y 3RO)
// ==========================================================
function obtenerHoraNica(nombreSorteo) {
    const n = normalizar(nombreSorteo);
    if (n.includes('12') || n.includes('11') || n.includes('AM') || n.includes('DIA')) return ['11:00 AM', '11:00AM'];
    if (n.includes('4') || n.includes('3') || n.includes('TARDE')) return ['3:00 PM', '3:00PM'];
    if (n.includes('7') || n.includes('6')) return ['6:00 PM', '6:00PM'];
    if (n.includes('10') || n.includes('9') || n.includes('NOCHE')) return ['9:00 PM', '9:00PM'];
    return [];
}

function extraerNicaCompleto(html, nombreSorteo, infoFecha) {
    if (!html) return null;
    const texto = normalizar(limpiarHtmlATexto(html));
    if (!contieneFechaHoy(texto, infoFecha)) return null;

    const horas = obtenerHoraNica(nombreSorteo);
    for (const h of horas) {
        const idx = texto.indexOf(h);
        if (idx === -1) continue;

        const bloque = texto.substring(idx, idx + 350);
        const matchDiaria = bloque.match(/\b(\d{2})\s*\(/);
        const matchPremia2 = bloque.match(/\b(\d{2})\s*-\s*(\d{2})\b/);

        if (matchDiaria && matchPremia2) {
            return { p1: matchDiaria[1], p2: matchPremia2[1], p3: matchPremia2[2] };
        }
    }
    return null;
}

// ==========================================================
// D. EXTRACTOR HONDURAS (LA DIARIA = 1RO, PREMIA2 = 2DO Y 3RO)
// ==========================================================
function obtenerHoraHonduras(nombreSorteo) {
    const n = normalizar(nombreSorteo);
    if (n.includes('12') || n.includes('11') || n.includes('AM') || n.includes('DIA')) return ['11:00 AM', '11:00AM'];
    if (n.includes('4') || n.includes('3') || n.includes('TARDE')) return ['3:00 PM', '3:00PM'];
    if (n.includes('10') || n.includes('9') || n.includes('NOCHE')) return ['9:00 PM', '9:00PM'];
    return [];
}

function extraerHondurasCompleto(html, nombreSorteo, infoFecha) {
    if (!html) return null;
    const texto = normalizar(limpiarHtmlATexto(html));
    const horas = obtenerHoraHonduras(nombreSorteo);
    if (horas.length === 0) return null;

    const idxDiariaHoy = texto.indexOf('LA DIARIA DE HOY');
    const idxPremia2Hoy = texto.indexOf('PREMIA2 DE HOY');
    if (idxDiariaHoy === -1 || idxPremia2Hoy === -1) return null;

    const bloqueDiaria = texto.substring(idxDiariaHoy, idxDiariaHoy + 450);
    const bloquePremia2 = texto.substring(idxPremia2Hoy, idxPremia2Hoy + 450);

    if (!contieneFechaHoy(bloqueDiaria, infoFecha) || !contieneFechaHoy(bloquePremia2, infoFecha)) {
        return null;
    }

    for (const h of horas) {
        const idxH1 = bloqueDiaria.indexOf(h);
        const idxH2 = bloquePremia2.indexOf(h);
        if (idxH1 === -1 || idxH2 === -1) continue;

        const subDiaria = bloqueDiaria.substring(idxH1 + h.length, idxH1 + h.length + 50);
        const subPremia2 = bloquePremia2.substring(idxH2 + h.length, idxH2 + h.length + 50);

        const matchP1 = subDiaria.match(/\b(\d{2})\b/);
        const matchP2P3 = subPremia2.match(/\b(\d{2})\s*-\s*(\d{2})\b/);

        if (matchP1 && matchP2P3) {
            return { p1: matchP1[1], p2: matchP2P3[1], p3: matchP2P3[2] };
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
            if (!resultado || !resultado.p1) return;
            if (aInsertar.some(i => i.sorteo_id === sorteo.id)) return;
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
        };

        // 1. PORTALES ABIERTOS PARA FLORIDA, NEW YORK, LA PRIMERA Y ANGUILLA
        const pendientesPortal = sorteos.filter(s =>
            !idsYaEscrutados.has(String(s.id)) &&
            ['PRIMERA', 'ANGUILLA', 'FLORIDA', 'YORK'].some(r => normalizar(s.nombre).includes(r)) &&
            (!s.hora_cierre || hora24 >= s.hora_cierre)
        );

        if (pendientesPortal.length > 0) {
            const fuentesAbiertas = [
                'https://www.nacionalloteria.com/republica-dominicana/loterias.php',
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
                    registrarResultado(s, extraerTica(html, s.nombre, infoFecha));
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
            const { html, estado } = await descargarPaginaAbierta('https://nuevaya.com.ni/loto-diaria-de-nicaragua/');
            diagnostico.push(`NICA: ${estado}`);
            if (html) {
                for (const s of pendientesNica) {
                    registrarResultado(s, extraerNicaCompleto(html, s.nombre, infoFecha));
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
            const { html, estado } = await descargarPaginaAbierta('https://www.nacionalloteria.com/honduras/resultados-loteria.php');
            diagnostico.push(`HONDURAS: ${estado}`);
            if (html) {
                for (const s of pendientesHonduras) {
                    registrarResultado(s, extraerHondurasCompleto(html, s.nombre, infoFecha));
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