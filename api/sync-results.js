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

// 🎯 Diccionario amplio de palabras clave para Conectate.com.do
const REGLAS_SORTEOS = [
    { pattern: /PRIMERA.*(11|12|DIA|MEDIODIA|AM)/i, keywords: ['PRIMERA', 'LA PRIMERA', 'PRIMERA DIA'] },
    { pattern: /PRIMERA.*(6|8|NOCHE|PM)/i, keywords: ['PRIMERA NOCHE', 'LA PRIMERA NOCHE'] },
    { pattern: /ANGUILLA.*(10|AM)/i, keywords: ['ANGUILLA 10', 'ANGUILA 10'] },
    { pattern: /ANGUILLA.*(12|1|MEDIODIA|PM)/i, keywords: ['ANGUILLA 1', 'ANGUILA 1', 'ANGUILLA 12'] },
    { pattern: /ANGUILLA.*(5|6)/i, keywords: ['ANGUILLA 6', 'ANGUILA 6', 'ANGUILLA 5'] },
    { pattern: /ANGUILLA.*(8|9|NOCHE)/i, keywords: ['ANGUILLA 9', 'ANGUILA 9', 'ANGUILLA 8'] },
    { pattern: /FLORIDA.*(12|1|DIA|MEDIODIA|TARDE)/i, keywords: ['FLORIDA DIA', 'FLORIDA TARDE', 'FLORIDA'] },
    { pattern: /FLORIDA.*(8|9|NOCHE)/i, keywords: ['FLORIDA NOCHE'] },
    { pattern: /NEW YORK.*(12|1|DIA|MEDIODIA|TARDE)/i, keywords: ['NEW YORK', 'YORK DIA', 'NEW YORK TARDE'] },
    { pattern: /NEW YORK.*(7|8|9|10|NOCHE)/i, keywords: ['NEW YORK NOCHE', 'YORK NOCHE'] }
];

function extraerPremios(html, nombreSorteo) {
    if (!html) return null;
    const normHtml = normalizar(html);
    
    let keywordsToSearch = [normalizar(nombreSorteo)]; 
    for (const regla of REGLAS_SORTEOS) {
        if (regla.pattern.test(nombreSorteo)) {
            keywordsToSearch = regla.keywords.map(k => normalizar(k));
            break;
        }
    }
    
    for (const kw of keywordsToSearch) {
        let pos = normHtml.indexOf(kw);
        while (pos !== -1) {
            // Extraemos un bloque de 600 caracteres alrededor de la coincidencia
            let fragmento = html.substring(pos, pos + 600);
            
            // 🎯 EXTRACCIÓN QUIRÚRGICA: Busca los span con la clase de los números ganadores
            const regexSpanExacto = /<span\s+class="[^"]*text-gray-800[^"]*">\s*(\d{2})\s*<\/span>/gi;
            
            let numeros = [];
            let match;
            while ((match = regexSpanExacto.exec(fragmento)) !== null) {
                numeros.push(match[1]);
            }
            
            if (numeros.length >= 3) {
                return { p1: numeros[0], p2: numeros[1], p3: numeros[2] };
            }
            
            pos = normHtml.indexOf(kw, pos + 10);
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