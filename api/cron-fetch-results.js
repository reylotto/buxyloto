const { createClient } = require('@supabase/supabase-js');

module.exports = async function handler(req, res) {
    try {
        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return res.status(500).json({ 
                status: 'error',
                message: 'Variables de entorno SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY no encontradas en Vercel.' 
            });
        }

        const supabase = createClient(supabaseUrl, supabaseKey);
        const hoy = new Date().toISOString().split('T')[0];

        // Obtener lista de sorteos desde la base de datos
        const { data: sorteos, error: errSorteos } = await supabase.from('sorteos').select('id, nombre');
        if (errSorteos) throw errSorteos;

        const resultadosAInsertar = [];

        // 1. Extraer de enloteria.com
        const htmlEnLoteria = await fetchText('https://enloteria.com/');
        if (htmlEnLoteria && sorteos) {
            const extracted = extraerPremiosEnLoteria(htmlEnLoteria, sorteos);
            resultadosAInsertar.push(...extracted);
        }

        // 2. Extraer Anguilla
        const htmlAnguilla = await fetchText('https://enloteria.com/resultados-anguilla');
        if (htmlAnguilla && sorteos) {
            const extractedAnguilla = extraerPremiosEnLoteria(htmlAnguilla, sorteos);
            resultadosAInsertar.push(...extractedAnguilla);
        }

        // 3. Guardar en Supabase (Dispara el Trigger automático)
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
        }

        return res.status(200).json({
            status: 'ok',
            fecha: hoy,
            encontrados: resultadosAInsertar.length,
            procesados: totalGuardados
        });

    } catch (err) {
        console.error('[CRON ERROR]:', err);
        return res.status(500).json({ status: 'error', message: err.message || 'Error interno en la ejecución' });
    }
};

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
    for (const sorteo of listaSorteos) {
        const nombreNorm = sorteo.nombre.toLowerCase();
        if (html.toLowerCase().includes(nombreNorm)) {
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