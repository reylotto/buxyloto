import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function normalizar(texto) {
    return texto ? texto.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
}

function getInfoFechaPanama() {
    const ahora = new Date();
    const fechaISO = ahora.toLocaleDateString('en-CA', { timeZone: 'America/Panama' }); // YYYY-MM-DD
    const hora24 = ahora.toLocaleTimeString('en-GB', { timeZone: 'America/Panama', hour12: false }); // HH:MM:SS
    const [, mes, dia] = fechaISO.split('-');
    return { fechaISO, hora24, dia, mes };
}

// Mapea el nombre de tu sorteo en BuxyLoto con el bloque exacto en la web oficial
function obtenerTerminosBusqueda(nombreSorteo) {
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

const PAGINAS_LOTERIAS = [
    { nombreRegla: 'PRIMERA', url: 'https://conectate.com.do/loterias/la-primera' },
    { nombreRegla: 'ANGUILLA', url: 'https://conectate.com.do/loterias/anguilla' },
    { nombreRegla: 'FLORIDA', url: 'https://conectate.com.do/loterias/florida' },
    { nombreRegla: 'YORK', url: 'https://conectate.com.do/loterias/new-york' }
];

function extraerPremiosSeguros(html, nombreSorteo, dia, mes) {
    if (!html) return null;
    const htmlNorm = normalizar(html);
    const terminos = obtenerTerminosBusqueda(nombreSorteo);

    let pos = -1;
    for (const term of terminos) {
        pos = htmlNorm.indexOf(term);
        if (pos !== -1) break;
    }
    if (pos === -1) return null;

    // Tomar el bloque específico de ese turno
    const fragmento = html.substring(pos, pos + 1200);

    // CANDADO DE FECHA: Verificar que el bloque publicado corresponda a hoy (ej. 14-11 o 14/11)
    const fechaGuion = `${dia}-${mes}`;
    const fechaBarra = `${dia}/${mes}`;
    if (!fragmento.includes(fechaGuion) && !fragmento.includes(fechaBarra)) {
        return null; // Aún muestra el resultado de ayer, no tocar
    }

    // Extraer los 3 números ganadores de 2 dígitos
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

export default async function handler(req, res) {
    try {
        const { fechaISO, hora24, dia, mes } = getInfoFechaPanama();

        // 1. Obtener sorteos activos y resultados ya registrados hoy
        const [{ data: sorteos }, { data: yaRegistrados }] = await Promise.all([
            supabase.from('sorteos').select('id, nombre, estatus, hora_cierre'),
            supabase.from('resultados').select('sorteo_id').eq('fecha', fechaISO)
        ]);

        if (!sorteos || sorteos.length === 0) {
            return res.status(200).json({ success: false, message: 'No hay sorteos configurados.' });
        }

        const idsYaEscrutados = new Set((yaRegistrados || []).map(r => String(r.sorteo_id)));
        const aInsertar = [];

        // 2. Consultar cada página directamente (100% gratuito, sin gastar APIs de pago)
        for (const pagina of PAGINAS_LOTERIAS) {
            // Filtrar solo sorteos de esta lotería que aún no tienen resultado hoy y cuya hora de cierre ya pasó
            const pendientes = sorteos.filter(s => {
                if (idsYaEscrutados.has(String(s.id))) return false;
                if (!normalizar(s.nombre).includes(pagina.nombreRegla)) return false;
                if (s.hora_cierre && hora24 < s.hora_cierre) return false;
                return true;
            });

            if (pendientes.length === 0) continue;

            try {
                const r = await fetch(pagina.url, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                        'Accept': 'text/html,application/xhtml+xml'
                    }
                });

                if (r.ok) {
                    const html = await r.text();
                    for (const sorteo of pendientes) {
                        const resultado = extraerPremiosSeguros(html, sorteo.nombre, dia, mes);
                        if (resultado && !aInsertar.some(i => i.sorteo_id === sorteo.id)) {
                            aInsertar.push({
                                sorteo_id: sorteo.id,
                                fecha: fechaISO,
                                p1: resultado.p1,
                                p2: resultado.p2,
                                p3: resultado.p3,
                                primero: resultado.p1,
                                segundo: resultado.p2,
                                tercero: resultado.p3,
                                updated_at: new Date().toISOString()
                            });
                        }
                    }
                }
            } catch (e) {
                console.warn(`Error consultando ${pagina.url}:`, e.message);
            }
        }

        if (aInsertar.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'Sin resultados nuevos pendientes para hoy.'
            });
        }

        // 3. Guardar resultados (dispara automáticamente el trigger de escrutinio en Supabase)
        const { error: errInsert } = await supabase
            .from('resultados')
            .upsert(aInsertar, { onConflict: 'sorteo_id,fecha' });

        if (errInsert) throw errInsert;

        // 4. Sincronizar vista rápida en sorteos y asegurar evaluación
        for (const item of aInsertar) {
            await supabase.from('sorteos').update({
                p1: item.p1, p2: item.p2, p3: item.p3,
                primer_premio: item.p1, segundo_premio: item.p2, tercer_premio: item.p3
            }).eq('id', item.sorteo_id);

            try {
                await supabase.rpc('evaluar_tickets_sorteo', {
                    p_sorteo_id: item.sorteo_id,
                    p_fecha: fechaISO
                });
            } catch (e) {}
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