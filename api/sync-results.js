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
// A. EXTRACTOR CONECTATE.COM.DO (PRIMERA, ANGUILLA, FLORIDA, NEW YORK)
// ==========================================================
function obtenerTerminosConectate(nombreSorteo) {
    const n = normalizar(nombreSorteo);

    if (n.includes('PRIMERA')) {
        if (n.includes('11') || n.includes('DIA') || n.includes('12')) return ['LA PRIMERA DIA', 'PRIMERA DIA'];
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
        if (n.includes('10') || n.includes('12') || n.includes('AM')) return ['ANGUILLA 10:00 AM', 'ANGUILLA 10:00', 'ANGUILLA 12:00'];
        if (n.includes('1') || n.includes('TARDE')) return ['ANGUILLA 1:00 PM', 'ANGUILLA 1:00'];
        if (n.includes('5') || n.includes('6')) return ['ANGUILLA 6:00 PM', 'ANGUILLA 6:00', 'ANGUILLA 5:00'];
        if (n.includes('8') || n.includes('9') || n.includes('NOCHE')) return ['ANGUILLA 9:00 PM', 'ANGUILLA 9:00', 'ANGUILLA 8:00'];
    }
    return [n];
}

function extraerDeConectate(html, nombreSorteo, infoFecha) {
    if (!html) return null;
    const texto = normalizar(limpiarHtmlATexto(html));
    const terminos = obtenerTerminosConectate(nombreSorteo);

    for (const term of terminos) {
        let idx = texto.indexOf(term);
        while (idx !== -1) {
            const ventana = texto.substring(idx, idx + 180);
            const fechaGuion = `${infoFecha.dia}-${infoFecha.mes}`;
            const fechaBarra = `${infoFecha.dia}/${infoFecha.mes}`;

            // Verificar que la fecha de hoy esté junto al bloque del sorteo
            if (ventana.includes(fechaGuion) || ventana.includes(fechaBarra)) {
                // Limpiar la fecha y la hora del título para aislar solo los 3 números ganadores
                const sinCabecera = ventana
                    .replace(term, ' ')
                    .replace(fechaGuion, ' ')
                    .replace(fechaBarra, ' ')
                    .replace(/\b\d{1,2}:\d{2}\s*(AM|PM)?\b/g, ' ');

                const nums = sinCabecera.match(/\b\d{2}\b/g);
                if (nums && nums.length >= 3) {
                    return { p1: nums[0], p2: nums[1], p3: nums[2] };
                }
            }
            idx = texto.indexOf(term, idx + term.length);
        }
    }
    return null;
}

// ==========================================================
// B. EXTRACTOR NICA (DIARIA = 1RO, PREMIA2 = 2DO Y 3RO)
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
        // En nuevaya.com.ni aparece: "11:00 AM DIARIA JUGA 4 FECHAS JUGA 3 PREMIA2 53 (JG) (+1 = 8) 4071 23 AGO 214 27 - 26"
        const matchDiaria = bloque.match(/\b(\d{2})\s*\(/);
        const matchPremia2 = bloque.match(/\b(\d{2})\s*-\s*(\d{2})\b/);

        if (matchDiaria && matchPremia2) {
            return {
                p1: matchDiaria[1],
                p2: matchPremia2[1],
                p3: matchPremia2[2]
            };
        }
    }
    return null;
}

// ==========================================================
// C. EXTRACTOR HONDURAS (LA DIARIA = 1RO, PREMIA2 = 2DO Y 3RO)
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

    const hoyTag = `DE HOY`;
    const idxDiariaHoy = texto.indexOf(`LA DIARIA ${hoyTag}`);
    const idxPremia2Hoy = texto.indexOf(`PREMIA2 ${hoyTag}`);

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

        // En nacionalloteria.com/honduras/resultados-loteria.php:
        // La Diaria: "11:00 AM DIA 93 + ..." | Premia2: "11:00 AM DIA 51 - 37"
        const subDiaria = bloqueDiaria.substring(idxH1 + h.length, idxH1 + h.length + 50);
        const subPremia2 = bloquePremia2.substring(idxH2 + h.length, idxH2 + h.length + 50);

        const matchP1 = subDiaria.match(/\b(\d{2})\b/);
        const matchP2P3 = subPremia2.match(/\b(\d{2})\s*-\s*(\d{2})\b/);

        if (matchP1 && matchP2P3) {
            return {
                p1: matchP1[1],
                p2: matchP2P3[1],
                p3: matchP2P3[2]
            };
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
            if (!resultado || !resultado.p1 || !resultado.p2 || !resultado.p3) return;
            if (aInsertar.some(i => i.sorteo_id === sorteoId)) return;
            aInsertar.push({
                sorteo_id: sorteoId,
                fecha: fechaISO,
                p1: resultado.p1,
                p2: resultado.p2,
                p3: resultado.p3,
                primero: resultado.p1,
                segundo: resultado.p2,
                tercero: resultado.p3,
                updated_at: new Date().toISOString()
            });
        };

        // 1. PRIMERA, ANGUILLA, FLORIDA Y NEW YORK (Conectate.com.do)
        const FUENTES_CONECTATE = [
            { reglas: ['FLORIDA', 'YORK'], urls: ['https://www.conectate.com.do/loterias/americanas/', 'https://www.conectate.com.do/'] },
            { reglas: ['PRIMERA'], urls: ['https://www.conectate.com.do/loterias/la-primera/', 'https://www.conectate.com.do/'] },
            { reglas: ['ANGUILLA'], urls: ['https://www.conectate.com.do/loterias/anguilla/', 'https://www.conectate.com.do/'] }
        ];

        for (const grupo of FUENTES_CONECTATE) {
            const pendientes = sorteos.filter(s =>
                !idsYaEscrutados.has(String(s.id)) &&
                grupo.reglas.some(r => normalizar(s.nombre).includes(r)) &&
                (!s.hora_cierre || hora24 >= s.hora_cierre)
            );
            if (pendientes.length === 0) continue;

            for (const url of grupo.urls) {
                const html = await descargarHtml(url);
                if (!html) continue;

                for (const s of pendientes) {
                    const res3 = extraerDeConectate(html, s.nombre, infoFecha);
                    registrarResultado(s.id, res3);
                }
                if (pendientes.every(p => aInsertar.some(i => i.sorteo_id === p.id))) break;
            }
        }

        // 2. NICA (Diaria = 1ro, Premia2 = 2do y 3ro)
        const pendientesNica = sorteos.filter(s =>
            !idsYaEscrutados.has(String(s.id)) &&
            normalizar(s.nombre).includes('NICA') &&
            (!s.hora_cierre || hora24 >= s.hora_cierre)
        );
        if (pendientesNica.length > 0) {
            const htmlNica = await descargarHtml('https://nuevaya.com.ni/loto-diaria-de-nicaragua/');
            for (const s of pendientesNica) {
                registrarResultado(s.id, extraerNicaCompleto(htmlNica, s.nombre, infoFecha));
            }
        }

        // 3. HONDURAS (La Diaria = 1ro, Premia2 = 2do y 3ro)
        const pendientesHonduras = sorteos.filter(s =>
            !idsYaEscrutados.has(String(s.id)) &&
            normalizar(s.nombre).includes('HONDURAS') &&
            (!s.hora_cierre || hora24 >= s.hora_cierre)
        );
        if (pendientesHonduras.length > 0) {
            const htmlHn = await descargarHtml('https://www.nacionalloteria.com/honduras/resultados-loteria.php');
            for (const s of pendientesHonduras) {
                registrarResultado(s.id, extraerHondurasCompleto(htmlHn, s.nombre, infoFecha));
            }
        }

        if (aInsertar.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'Escaneo completado. Sin resultados nuevos pendientes para hoy.'
            });
        }

        // 4. Guardar en Supabase y ejecutar escrutinio
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