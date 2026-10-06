import { createClient } from '@supabase/supabase-js';

// Inicializar cliente Supabase con privilegios
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
    try {
        const hoy = new Date().toISOString().split('T')[0];
        console.log(`[CRON AUTO-ESCRUTINIO] Ejecutando búsqueda para ${hoy}...`);

        // Obtener la lista de sorteos desde Supabase para mapear IDs
        const { data: sorteos, error: errSorteos } = await supabase.from('sorteos').select('id, nombre');
        if (errSorteos) throw errSorteos;

        const resultadosAInsertar = [];

        // 1. EXTRAER ENLOTERIA.COM (Florida, Anguilla, La Primera)
        const htmlEnLoteria = await fetchText('https://enloteria.com/');
        if (htmlEnLoteria) {
            // Ejemplo de extracción general de bloques de juego
            const extracted = extraerPremiosEnLoteria(htmlEnLoteria, sorteos);
            resultadosAInsertar.push(...extracted);
        }

        // 2. EXTRAER ANGUILLA
        const htmlAnguilla = await fetchText('https://enloteria.com/resultados-anguilla');
        if (htmlAnguilla) {
            const extractedAnguilla = extraerPremiosEnLoteria(htmlAnguilla, sorteos);
            resultadosAInsertar.push(...extractedAnguilla);
        }

        // 3. GUARDAR EN SUPABASE (Detona el Trigger de Escrutinio)
        let totalGuardados = 0;
        for (const resData of resultadosAInsertar) {
            if (!resData.sorteo_id || !resData.primero) continue;

            const payload = {
                sorteo_id: resData.sorteo_id,
                fecha: hoy,
                primero: resData.primero,
                segundo: resData.segundo || '',
                tercero: resData.tercero || '',
                p1: resData.primero,
                p2: resData.segundo || '',
                p3: resData.tercero || '',
                updated_at: new Date().toISOString()
            };

            const { error } = await supabase
                .from('resultados')
                .upsert(payload, { onConflict: 'sorteo_id,fecha' });

            if (!error) totalGuardados++;
            else console.error(`Error guardando sorteo ${resData.sorteo_id}:`, error);
        }

        return res.status(200).json({
            status: 'ok',
            fecha: hoy,
            encontrados: resultadosAInsertar.length,
            procesados: totalGuardados
        });

    } catch (err) {
        console.error('[CRON ERROR]:', err);
        return res.status(500).json({ error: err.message });
    }
}

async function fetchText(url) {
    try {
        const response = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
        });
        if (!response.ok) return null;
        return await response.text();
    } catch (e) {
        return null;
    }
}

function extraerPremiosEnLoteria(html, listaSorteos) {
    const hallados = [];
    
    // Recorrer los sorteos conocidos para buscar sus números en el HTML
    for (const sorteo of listaSorteos) {
        const nombreNorm = sorteo.nombre.toLowerCase();
        
        // Expresión regular para encontrar bloques de números ganadores en HTML
        if (html.toLowerCase().includes(nombreNorm)) {
            // Extraer secuencias de 2 dígitos continuos cerca del nombre del sorteo
            const regexBloque = new RegExp(`${nombreNorm}[\\s\\S]{1,300}?(\\d{2})[\\s\\-]{1,5}(\\d{2})[\\s\\-]{1,5}(\\d{2})`, 'i');
            const match = html.match(regexBloque);

            if (match) {
                hallados.push({
                    sorteo_id: sorteo.id,
                    primero: match[1],
                    segundo: match[2],
                    tercero: match[3]
                });
            }
        }
    }
    return hallados;
}