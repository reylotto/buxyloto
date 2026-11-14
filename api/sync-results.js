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
    return { fechaISO, hora24, anio, dia, mes, diaNum: String(parseInt(dia, 10)), mesNombre };
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
        norm.includes(`${diaNum} DE ${mesNorm}`) ||
        norm.includes(`${dia} DE ${mesNorm}`) ||
        norm.includes(`${diaNum} ${mesCorto}`) ||
        norm.includes(`${dia} ${mesCorto}`)
    );
}

async function descargarHtml(url) {
    try {
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml'
            }
        });
        if (!res.ok) return null;
        return await res.text();
    } catch {
        return null;
    }
}

// ==========================================================
// A. EXTRACTOR PARA PRIMERA, ANGUILLA, FLORIDA Y NEW YORK (3 PREMIOS)
// ==========================================================
function obtenerTerminos3Premios(nombreSorteo) {
    const n = normalizar(nombreSorteo);
    if (n.includes('PRIMERA')) {
        if (n.includes('11') || n.includes('DIA') || n.includes('12')) return ['PRIMERA DIA', 'LA PRIMERA DIA'];
        if (n.includes('6') || n.includes('7') || n.includes('8') || n.includes('NOCHE')) return ['PRIMERA NOCHE', 'LA PRIMERA NOCHE'];
    }
    if (n.includes('FLORIDA')) {
        if (n.includes('12') || n.includes('1') || n.includes('DIA') || n.includes('TARDE')) return ['FLORIDA DIA'];
        if (n.includes('6') || n.includes('8') || n.includes('9') || n.includes('NOCHE')) return ['FLORIDA NOCHE'];
    }
    if (n.includes('YORK')) {
        if (n.includes('1') || n.includes('2') || n.includes('DIA') || n.includes('TARDE')) return ['NEW YORK TARDE', 'NEW YORK DIA'];
        if (n.includes('9') || n.includes('10') || n.includes('NOCHE')) return ['NEW YORK NOCHE'];
    }
    if (n.includes('ANGUILLA')) {
        if (n.includes('10') || n.includes('12') || n.includes('AM')) return ['ANGUILLA 10:00', 'ANGUILLA 1:00'];
        if (n.includes('1') || n.includes('TARDE')) return ['ANGUILLA 1:00'];
        if (n.includes('5') || n.includes('6')) return ['ANGUILLA 6:00'];
        if (n.includes('8') || n.includes('9') || n.includes('NOCHE')) return ['ANGUILLA 9:00'];
    }
    return [n];
}

function extraer3Premios(html, nombreSorteo, infoFecha) {
    if (!html) return null;
    const htmlNorm = normalizar(html);
    const terminos = obtenerTerminos3Premios(nombreSorteo);

    let pos = -1;
    for (const term of terminos) {
        pos = htmlNorm.indexOf(term);
        if (pos !== -1) break;
    }
    if (pos === -1) return null;

    const fragmento = html.substring(pos, pos + 1200);
    if (!contieneFechaHoy(fragmento, infoFecha)) return null;

    const regexSpan = /<span\s+class="[^"]*text-gray-800[^"]*">\s*(\d{2})\s*<\/span>/gi;
    const numeros = [];
    let match;
    while ((match = regexSpan.exec(fragmento)) !== null) {
        numeros.push(match[1]);
    }

    if (numeros.length >= 3) {
        return { p1: numeros[0], p2: numeros[1], p3: numeros[2] };
    }
    return null;
}

// ==========================================================
// B. EXTRACTOR PARA TICA, NICA Y HONDURAS (1 PREMIO DE 2 DÍGITOS)
// ==========================================================
function obtenerEtiquetasCentroamerica(nombreSorteo) {
    const n = normalizar(nombreSorteo);

    // TICA (CR = Panamá - 1h): 2PM -> 12:55/1:00 | 5:30PM -> 4:30 | 8:30PM -> 7:30
    if (n.includes('TICA')) {
        if (n.includes('2PM') || n.includes('2:00') || n.includes('DIA') || n.includes('1PM')) {
            return ['12:55PM', '12:55 PM', '1:00 PM', '1:00PM', 'MEDIO DIA'];
        }
        if (n.includes('5:30') || n.includes('5PM') || n.includes('TARDE') || n.includes('3:00') || n.includes('PM')) {
            if (!n.includes('8:30') && !n.includes('NOCHE')) {
                return ['4:30PM', '4:30 PM', 'TARDE'];
            }
        }
        if (n.includes('8:30') || n.includes('8PM') || n.includes('NOCHE') || n.includes('7:30')) {
            return ['7:30PM', '7:30 PM', 'NOCHE'];
        }
    }

    // NICA (NI = Panamá - 1h): 12PM -> 11:00AM | 4PM -> 3:00PM | 7PM -> 6:00PM | 10PM -> 9:00PM
    if (n.includes('NICA')) {
        if (n.includes('12') || n.includes('11') || n.includes('AM') || n.includes('DIA')) {
            return ['11:00AM', '11:00 AM'];
        }
        if (n.includes('4') || n.includes('3') || n.includes('TARDE')) {
            return ['3:00PM', '3:00 PM'];
        }
        if (n.includes('7') || n.includes('6')) {
            return ['6:00PM', '6:00 PM'];
        }
        if (n.includes('10') || n.includes('9') || n.includes('NOCHE')) {
            return ['9:00PM', '9:00 PM'];
        }
    }

    // HONDURAS (HN = Panamá - 1h): 12PM -> 11:00AM | 4PM -> 3:00PM | 10PM -> 9:00PM
    if (n.includes('HONDURAS')) {
        if (n.includes('12') || n.includes('11') || n.includes('AM') || n.includes('DIA')) {
            return ['11:00AM', '11:00 AM', 'DIARIA 11AM'];
        }
        if (n.includes('4') || n.includes('3') || n.includes('TARDE')) {
            return ['3:00PM', '3:00 PM', 'DIARIA 3PM'];
        }
        if (n.includes('10') || n.includes('9') || n.includes('NOCHE')) {
            return ['9:00PM', '9:00 PM', 'DIARIA 9PM'];
        }
    }

    return [];
}

function extraerCentroamerica(html, nombreSorteo, infoFecha, palabraClavePais = '') {
    if (!html) return null;
    const texto = normalizar(limpiarHtmlATexto(html));

    // Candado de fecha en la página
    if (!contieneFechaHoy(texto, infoFecha)) return null;

    const etiquetas = obtenerEtiquetasCentroamerica(nombreSorteo);
    if (etiquetas.length === 0) return null;

    // Si es una página general (como /resultados), acotar primero al bloque del país
    let textoBusqueda = texto;
    if (palabraClavePais) {
        const idxPais = texto.indexOf(palabraClavePais);
        if (idxPais !== -1) {
            textoBusqueda = texto.substring(Math.max(0, idxPais - 60), idxPais + 400);
        }
    }

    for (const etq of etiquetas) {
        const idx = textoBusqueda.indexOf(etq);
        if (idx !== -1) {
            // Buscar el número ganador de 2 dígitos justo después (o inmediatamente antes) de la hora del sorteo
            const ventanaDespues = textoBusqueda.substring(idx + etq.length, idx + etq.length + 90);
            const matchDespues = ventanaDespues.match(/(?:^|[^0-9:])(\d{2})(?:[^0-9:]|$)/);
            if (matchDespues) {
                return { p1: matchDespues[1], p2: null, p3: null };
            }

            const ventanaAntes = textoBusqueda.substring(Math.max(0, idx - 50), idx);
            const matchesAntes = [...ventanaAntes.matchAll(/(?:^|[^0-9:])(\d{2})(?:[^0-9:]|$)/g)];
            if (matchesAntes.length > 0) {
                const ultimo = matchesAntes[matchesAntes.length - 1];
                return { p1: ultimo[1], p2: null, p3: null };
            }
        }
    }

    return null;
}

// ==========================================================
// HANDLER PRINCIPAL DE VERCEL
// ==========================================================
export default async function handler(req, res) {
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

        const registrarResultado = (sorteoId, resultado) => {
            if (!resultado || !resultado.p1) return;
            if (aInsertar.some(i => i.sorteo_id === sorteoId)) return;
            aInsertar.push({
                sorteo_id: sorteoId,
                fecha: fechaISO,
                p1: resultado.p1,
                p2: resultado.p2 || null,
                p3: resultado.p3 || null,
                primero: resultado.p1,
                segundo: resultado.p2 || null,
                tercero: resultado.p3 || null,
                updated_at: new Date().toISOString()
            });
        };

        // 1. Loterías de 3 premios (La Primera, Anguilla, Florida, New York)
        const FUENTES_3_PREMIOS = [
            { regla: 'PRIMERA', url: 'https://conectate.com.do/loterias/la-primera' },
            { regla: 'ANGUILLA', url: 'https://conectate.com.do/loterias/anguilla' },
            { regla: 'FLORIDA', url: 'https://conectate.com.do/loterias/florida' },
            { regla: 'YORK', url: 'https://conectate.com.do/loterias/new-york' }
        ];

        for (const fuente of FUENTES_3_PREMIOS) {
            const pendientes = sorteos.filter(s =>
                !idsYaEscrutados.has(String(s.id)) &&
                normalizar(s.nombre).includes(fuente.regla) &&
                (!s.hora_cierre || hora24 >= s.hora_cierre)
            );
            if (pendientes.length === 0) continue;

            const html = await descargarHtml(fuente.url);
            if (!html) continue;

            for (const s of pendientes) {
                const res3 = extraer3Premios(html, s.nombre, infoFecha);
                registrarResultado(s.id, res3);
            }
        }

        // 2. TICA (Costa Rica) - Primaria + Respaldo
        const pendientesTica = sorteos.filter(s =>
            !idsYaEscrutados.has(String(s.id)) &&
            normalizar(s.nombre).includes('TICA') &&
            (!s.hora_cierre || hora24 >= s.hora_cierre)
        );
        if (pendientesTica.length > 0) {
            const htmlTica1 = await descargarHtml('https://www.kingarrobanumeros.com/tica-hoy');
            const htmlTica2 = await descargarHtml('https://www.nacionalloteria.com/costarica/nuevos-tiempos.php');

            for (const s of pendientesTica) {
                const resTica = extraerCentroamerica(htmlTica1, s.nombre, infoFecha) ||
                                extraerCentroamerica(htmlTica2, s.nombre, infoFecha);
                registrarResultado(s.id, resTica);
            }
        }

        // 3. NICA (Nicaragua) - Primaria + Respaldo
        const pendientesNica = sorteos.filter(s =>
            !idsYaEscrutados.has(String(s.id)) &&
            normalizar(s.nombre).includes('NICA') &&
            (!s.hora_cierre || hora24 >= s.hora_cierre)
        );
        if (pendientesNica.length > 0) {
            const htmlNica1 = await descargarHtml('https://nuevaya.com.ni/loto-diaria-de-nicaragua/');
            const htmlNica2 = await descargarHtml('https://www.kingarrobanumeros.com/nica-hoy');

            for (const s of pendientesNica) {
                const resNica = extraerCentroamerica(htmlNica1, s.nombre, infoFecha) ||
                                extraerCentroamerica(htmlNica2, s.nombre, infoFecha);
                registrarResultado(s.id, resNica);
            }
        }

        // 4. HONDURAS (Loto La Diaria) - Primaria + Respaldo
        const pendientesHonduras = sorteos.filter(s =>
            !idsYaEscrutados.has(String(s.id)) &&
            normalizar(s.nombre).includes('HONDURAS') &&
            (!s.hora_cierre || hora24 >= s.hora_cierre)
        );
        if (pendientesHonduras.length > 0) {
            const htmlHn1 = await descargarHtml('https://www.nacionalloteria.com/honduras/loto-la-diaria.php');
            const htmlHn2 = await descargarHtml('https://www.kingarrobanumeros.com/resultados');

            for (const s of pendientesHonduras) {
                const resHn = extraerCentroamerica(htmlHn1, s.nombre, infoFecha) ||
                              extraerCentroamerica(htmlHn2, s.nombre, infoFecha, 'DIARIA HONDURAS');
                registrarResultado(s.id, resHn);
            }
        }

        if (aInsertar.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'Escaneo completado. Sin resultados nuevos pendientes para hoy.'
            });
        }

        // 5. Guardar en Supabase (dispara automáticamente trigger_evaluar_resultado)
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
            data: aInsertar
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}