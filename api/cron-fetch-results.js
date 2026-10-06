module.exports = async function handler(req, res) {
    try {
        let supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        let supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

        supabaseUrl = supabaseUrl.trim().replace(/\/+$/, '');
        supabaseKey = supabaseKey.trim();

        if (!supabaseUrl || !supabaseKey) {
            return res.status(200).json({ 
                status: 'error',
                message: 'Faltan las variables de entorno SUPABASE_URL o SUPABASE_KEY/SUPABASE_SERVICE_ROLE_KEY en Vercel.' 
            });
        }

        if (!supabaseUrl.startsWith('http://') && !supabaseUrl.startsWith('https://')) {
            supabaseUrl = `https://${supabaseUrl}`;
        }

        const hoy = new Date().toISOString().split('T')[0];

        // 1. Obtener la lista de sorteos desde Supabase
        const respSorteos = await fetch(`${supabaseUrl}/rest/v1/sorteos?select=id,nombre`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });

        if (!respSorteos.ok) {
            const errText = await respSorteos.text();
            return res.status(200).json({
                status: 'error_supabase_sorteos',
                statusCode: respSorteos.status,
                message: `Error al consultar la tabla 'sorteos' en Supabase: ${errText}`
            });
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

        // 4. Guardar resultados en Supabase
        let totalGuardados = 0;
        const erroresUpsert = [];

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
                const errTxt = await respUpsert.text();
                erroresUpsert.push({ sorteo_id: resData.sorteo_id, error: errTxt });
            }
        }

        return res.status(200).json({
            status: 'ok',
            fecha: hoy,
            totalSorteosEnBaseDatos: Array.isArray(sorteos) ? sorteos.length : 0,
            encontrados: resultadosAInsertar.length,
            procesados: totalGuardados,
            erroresGuardado: erroresUpsert.length > 0 ? erroresUpsert : undefined
        });

    } catch (err) {
        return res.status(200).json({ 
            status: 'error_excepcion', 
            message: err.message || String(err)
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