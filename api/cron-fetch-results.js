module.exports = async function handler(req, res) {
    try {
        const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

        if (!supabaseUrl || !supabaseKey) {
            return res.status(200).json({ 
                status: 'error',
                message: 'Faltan las variables SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en Vercel.' 
            });
        }

        const hoy = new Date().toISOString().split('T')[0];

        // 1. Obtener la lista de sorteos directamente vía REST API de Supabase
        const respSorteos = await fetch(`${supabaseUrl}/rest/v1/sorteos?select=id,nombre`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!respSorteos.ok) {
            const errText = await respSorteos.text();
            throw new Error(`Error al consultar sorteos de Supabase: ${errText}`);
        }

        const sorteos = await respSorteos.json();
        const resultadosAInsertar = [];

        // 2. Extraer de enloteria.com
        const htmlEnLoteria = await fetchText('https://enloteria.com/');
        if (htmlEnLoteria && Array.isArray(sorteos)) {
            const extracted = extraerPremiosEnLoteria(htmlEnLoteria, sorteos);
            resultadosAInsertar.push(...extracted);
        }

        // 3. Extraer de Anguilla
        const htmlAnguilla = await fetchText('https://enloteria.com/resultados-anguilla');
        if (htmlAnguilla && Array.isArray(sorteos)) {
            const extractedAnguilla = extraerPremiosEnLoteria(htmlAnguilla, sorteos);
            resultadosAInsertar.push(...extractedAnguilla);
        }

        // 4. Guardar resultados en Supabase vía REST API (Dispara el Trigger de Escrutinio)
        let totalGuardados = 0;
        for (const resData of resultadosAInsertar) {
            if (!resData.sorteo_id || !resData.primero) continue;

            const payload = [{
                sorteo_id: resData.sorteo_id,
                fecha: hoy,
                primero: resData.primero,
                segundo: resData.segundo || '',
                tercero: resData.tercero || '',
                p1: resData.primero,
                p2: resData.segundo || '',
                p3: resData.tercero || '',
                updated_at: new Date().toISOString()
            }];

            const respUpsert = await fetch(`${supabaseUrl}/rest/v1/resultados`, {
                method: 'POST',
                headers: {
                    'apikey': supabaseKey,
                    'Authorization': `Bearer ${supabaseKey}`,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify(payload)
            });

            if (respUpsert.ok) {
                totalGuardados++;
            } else {
                console.error(`Error al guardar sorteo ID ${resData.sorteo_id}:`, await respUpsert.text());
            }
        }

        return res.status(200).json({
            status: 'ok',
            fecha: hoy,
            encontrados: resultadosAInsertar.length,
            procesados: totalGuardados
        });

    } catch (err) {
        console.error('[CRON ERROR]:', err);
        return res.status(500).json({ 
            status: 'error', 
            message: err.message || 'Error interno durante la ejecución' 
        });
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
        if (!sorteo.nombre) continue;
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