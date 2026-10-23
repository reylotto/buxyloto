import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 🔥 API Key de ScraperAPI
const SCRAPER_API_KEY = 'dcebab8a24bfa2e19a1e6e333d26ac85'; 

function normalizar(texto) { 
    return texto ? texto.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ''; 
}

function getFechaPanama() { 
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' }); 
}

// 🎯 Diccionario de títulos exactos tal como aparecen en Conectate.com.do
const REGLAS_SORTEOS = [
    { pattern: /PRIMERA.*(11|12|DIA|MEDIODIA|AM)/i, keywords: ['La Primera Día', 'Primera Día', 'La Primera'] },
    { pattern: /PRIMERA.*(6|8|NOCHE|PM)/i, keywords: ['Primera Noche', 'La Primera Noche'] },
    { pattern: /ANGUILLA.*(10|AM)/i, keywords: ['Anguilla 10 AM', 'Anguilla 10'] },
    { pattern: /ANGUILLA.*(12|1|MEDIODIA|PM)/i, keywords: ['Anguilla 1 PM', 'Anguilla 1'] },
    { pattern: /ANGUILLA.*(5|6)/i, keywords: ['Anguilla 6 PM', 'Anguilla 6'] },
    { pattern: /ANGUILLA.*(8|9|NOCHE)/i, keywords: ['Anguilla 9 PM', 'Anguilla 9'] },
    { pattern: /FLORIDA.*(12|1|DIA|MEDIODIA|TARDE)/i, keywords: ['Florida Día', 'Florida Tarde', 'Florida'] },
    { pattern: /FLORIDA.*(8|9|NOCHE)/i, keywords: ['Florida Noche'] },
    { pattern: /NEW YORK.*(12|1|DIA|MEDIODIA|TARDE)/i, keywords: ['New York Día', 'New York Tarde', 'New York'] },
    { pattern: /NEW YORK.*(7|8|9|10|NOCHE)/i, keywords: ['New York Noche'] }
];

function extraerPremios(html, nombreSorteo) {
    if (!html) return null;
    
    let keywordsToSearch = [nombreSorteo]; 
    for (const regla of REGLAS_SORTEOS) {
        if (regla.pattern.test(nombreSorteo)) {
            keywordsToSearch = regla.keywords;
            break;
        }
    }
    
    for (const kw of keywordsToSearch) {
        // Buscamos la sección exacta del sorteo usando el título visual en la página
        let pos = html.indexOf(kw);
        while (pos !== -1) {
            // Extraemos un bloque de 500 caracteres justo después del título del sorteo
            let fragmento = html.substring(pos, pos + 500);
            
            // 🎯 EXTRACCIÓN QUIRÚRGICA BASADA EN TU INSPECTOR:
            // Busca exactamente etiquetas <span class="text-gray-800">XX</span>
            const regexSpanExacto = /<span\s+class="[^"]*text-gray-800[^"]*">\s*(\d{2})\s*<\/span>/gi;
            
            let numeros = [];
            let match;
            while ((match = regexSpanExacto.exec(fragmento)) !== null) {
                numeros.push(match[1]);
            }
            
            if (numeros.length >= 3) {
                return { p1: numeros[0], p2: numeros[1], p3: numeros[2] };
            }
            
            pos = html.indexOf(kw, pos + 10);
        }
    }
    return null;
}

export default async function handler(req, res) {
    try {
        const { data: sorteos } = await supabase.from('sorteos').select('id, nombre, estatus');
        if (!sorteos || sorteos.length === 0) {
            return res.status(400).json({ success: false, message: 'No hay sorteos configurados.' });
        }

        const fecha = getFechaPanama();
        let htmlCompleto = '';

        const sitio = 'https://conectate.com.do/loterias/';

        try {
            const url = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(sitio)}`;
            const r = await fetch(url);
            if (r.ok) {
                htmlCompleto = await r.text();
            }
        } catch (e) {
            console.warn("Falló la conexión con ScraperAPI");
        }

        if (htmlCompleto.length < 500) {
            return res.status(200).json({ 
                success: true, 
                message: `🚨 ALERTA: No se pudo obtener la página. Letras leídas: ${htmlCompleto.length}.` 
            });
        }

        const aInsertar = [];
        for (const sorteo of sorteos) {
            const resultado = extraerPremios(htmlCompleto, sorteo.nombre);
            if (resultado) {
                const yaExiste = aInsertar.find(i => i.sorteo_id === sorteo.id);
                if (!yaExiste) {
                    aInsertar.push({
                        sorteo_id: sorteo.id, fecha: fecha, 
                        p1: resultado.p1, p2: resultado.p2, p3: resultado.p3,
                        primero: resultado.p1, segundo: resultado.p2, tercero: resultado.p3,
                        updated_at: new Date().toISOString()
                    });
                }
            }
        }

        if (aInsertar.length === 0) {
            return res.status(200).json({ 
                success: true, 
                message: `Escaneo exitoso (${htmlCompleto.length} letras). Aún no publican los resultados oficiales de hoy.` 
            });
        }

        const { error: errUpsert } = await supabase.from('resultados').upsert(aInsertar, { onConflict: 'sorteo_id,fecha' });
        if (errUpsert) throw errUpsert;
        
        for (const item of aInsertar) {
            await supabase.from('sorteos').update({ 
                p1: item.p1, p2: item.p2, p3: item.p3, 
                primer_premio: item.p1, segundo_premio: item.p2, tercer_premio: item.p3 
            }).eq('id', item.sorteo_id);
            
            try { 
                await supabase.rpc('evaluar_tickets_sorteo', { p_id_sorteo: item.sorteo_id, p_num1: item.p1, p_num2: item.p2, p_num3: item.p3 }); 
            } catch(e) {}
        }

        return res.status(200).json({ 
            success: true, 
            message: `¡Éxito! Se actualizaron ${aInsertar.length} sorteos extrayendo las bolitas exactas.`, 
            data: aInsertar 
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}