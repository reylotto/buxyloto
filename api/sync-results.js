import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 🔥 API Key de ScraperAPI (Evade bloqueos de Cloudflare)
const SCRAPER_API_KEY = 'dcebab8a24bfa2e19a1e6e333d26ac85'; 

function normalizar(texto) { 
    return texto ? texto.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ''; 
}

function getFechaPanama() { 
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' }); 
}

// Diccionario exacto para EnLoteria.com
const REGLAS_SORTEOS = [
    { pattern: /PRIMERA.*(11|12|DIA|MEDIODIA|AM)/i, keywords: ['LA PRIMERA RESULTADOS HOY', 'LA PRIMERA', 'PRIMERA DIA'] },
    { pattern: /PRIMERA.*(6|8|NOCHE|PM)/i, keywords: ['LA PRIMERA NOCHE', 'PRIMERA NOCHE'] },
    { pattern: /ANGUILLA.*(10|AM)/i, keywords: ['ANGUILLA 10:00', 'ANGUILLA 10AM', 'ANGUILLA 10'] },
    { pattern: /ANGUILLA.*(12|1|MEDIODIA|PM)/i, keywords: ['ANGUILLA 1:00', 'ANGUILLA 1PM', 'ANGUILLA 12'] },
    { pattern: /ANGUILLA.*(5|6)/i, keywords: ['ANGUILLA 6:00', 'ANGUILLA 6PM', 'ANGUILLA 6'] },
    { pattern: /ANGUILLA.*(8|9|NOCHE)/i, keywords: ['ANGUILLA 9:00', 'ANGUILLA 9PM', 'ANGUILLA 9'] },
    { pattern: /FLORIDA.*(12|1|DIA|MEDIODIA|TARDE)/i, keywords: ['FLORIDA DIA', 'FLORIDA TARDE'] },
    { pattern: /FLORIDA.*(8|9|NOCHE)/i, keywords: ['FLORIDA NOCHE'] },
    { pattern: /NEW YORK.*(12|1|DIA|MEDIODIA|TARDE)/i, keywords: ['NEW YORK DIA', 'NEW YORK TARDE'] },
    { pattern: /NEW YORK.*(7|8|9|10|NOCHE)/i, keywords: ['NEW YORK NOCHE'] }
];

function extraerPremios(html, nombreSorteo) {
    if (!html) return null;
    const htmlUpper = normalizar(html); 
    
    let keywordsToSearch = [normalizar(nombreSorteo)]; 
    for (const regla of REGLAS_SORTEOS) {
        if (regla.pattern.test(nombreSorteo)) {
            keywordsToSearch = regla.keywords;
            break;
        }
    }
    
    for (const kw of keywordsToSearch) {
        let pos = htmlUpper.indexOf(kw);
        while (pos !== -1) {
            // 🚀 REGLA ESTRICTA 1: Solo leemos los siguientes 250 caracteres. 
            // Si el premio no está ahí cerquita, es porque el sorteo no ha jugado.
            let fragmento = html.substring(pos, pos + 250);
            
            // 🚀 REGLA ESTRICTA 2: Solo captura números atrapados EXACTAMENTE solos en una etiqueta HTML.
            // Ignora horas (10:00), ignora fechas (10 de octubre), ignora años (2026).
            const regexEtiquetas = />\s*(\d{2})\s*</g;
            let matches = [];
            let m;
            while ((m = regexEtiquetas.exec(fragmento)) !== null) {
                matches.push(m[1]);
            }
            
            if (matches.length >= 3) {
                // Encontramos los 3 números reales ganadores
                return { p1: matches[0], p2: matches[1], p3: matches[2] };
            }

            pos = htmlUpper.indexOf(kw, pos + 10);
        }
    }
    return null; // Si no encontró los números bajo la regla estricta, devuelve nulo (pendiente)
}

export default async function handler(req, res) {
    try {
        const { data: sorteos } = await supabase.from('sorteos').select('id, nombre, estatus');
        if (!sorteos || sorteos.length === 0) {
            return res.status(400).json({ success: false, message: 'No hay sorteos configurados.' });
        }

        const fecha = getFechaPanama();
        
        // Vamos directo a las páginas oficiales de los sorteos
        const sitios = [
            'https://enloteria.com/loterias/la-primera',
            'https://enloteria.com/resultados-anguilla',
            'https://enloteria.com/loterias/new-york',
            'https://enloteria.com/loterias/florida'
        ];

        const aInsertar = [];
        let htmlExtraido = 0;

        // Procesamos página por página para evitar cruce de datos
        for (const sitio of sitios) {
            try {
                const url = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(sitio)}`;
                const r = await fetch(url);
                if (r.ok) {
                    const html = await r.text();
                    htmlExtraido += html.length;

                    for (const sorteo of sorteos) {
                        const resultado = extraerPremios(html, sorteo.nombre);
                        if (resultado) {
                            // Verificamos que no se haya insertado ya en el bucle
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
                }
            } catch (e) {
                console.warn(`Falló la conexión con: ${sitio}`);
            }
        }

        if (aInsertar.length === 0) {
            return res.status(200).json({ 
                success: true, 
                message: `Escaneo finalizado. Aún no se han publicado los premios de los sorteos correspondientes a hoy.` 
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
            message: `¡Éxito! Se actualizaron ${aInsertar.length} sorteos con números oficiales correctos.`, 
            data: aInsertar 
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}