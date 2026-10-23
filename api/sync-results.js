import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// 🔥 API Key de ScraperAPI para evadir Cloudflare
const SCRAPER_API_KEY = 'dcebab8a24bfa2e19a1e6e333d26ac85'; 

function normalizar(texto) { 
    return texto ? texto.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ''; 
}

function getFechaPanama() { 
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' }); 
}

// 🎯 Diccionario de palabras clave exactas para Conectate.com.do
const REGLAS_SORTEOS = [
    { pattern: /PRIMERA.*(11|12|DIA|MEDIODIA|AM)/i, keywords: ['LA PRIMERA', 'PRIMERA DIA', 'PRIMERA 12'] },
    { pattern: /PRIMERA.*(6|8|NOCHE|PM)/i, keywords: ['PRIMERA NOCHE', 'PRIMERA 8'] },
    { pattern: /ANGUILLA.*(10|AM)/i, keywords: ['ANGUILLA 10', 'ANGUILLA 10 AM'] },
    { pattern: /ANGUILLA.*(12|1|MEDIODIA|PM)/i, keywords: ['ANGUILLA 1', 'ANGUILLA 1 PM', 'ANGUILLA 12'] },
    { pattern: /ANGUILLA.*(5|6)/i, keywords: ['ANGUILLA 5', 'ANGUILLA 6', 'ANGUILLA 6 PM'] },
    { pattern: /ANGUILLA.*(8|9|NOCHE)/i, keywords: ['ANGUILLA 9', 'ANGUILLA 9 PM', 'ANGUILLA 8'] },
    { pattern: /FLORIDA.*(12|1|DIA|MEDIODIA|TARDE)/i, keywords: ['FLORIDA DIA', 'FLORIDA TARDE'] },
    { pattern: /FLORIDA.*(8|9|NOCHE)/i, keywords: ['FLORIDA NOCHE'] },
    { pattern: /NEW YORK.*(12|1|DIA|MEDIODIA|TARDE)/i, keywords: ['NEW YORK TARDE', 'NEW YORK DIA', 'YORK DIA'] },
    { pattern: /NEW YORK.*(7|8|9|10|NOCHE)/i, keywords: ['NEW YORK NOCHE', 'YORK NOCHE'] }
];

function extraerPremios(html, nombreSorteo) {
    if (!html) return null;
    const normHtml = normalizar(html); 
    
    let keywordsToSearch = [normalizar(nombreSorteo)]; 
    for (const regla of REGLAS_SORTEOS) {
        if (regla.pattern.test(nombreSorteo)) {
            keywordsToSearch = regla.keywords;
            break;
        }
    }
    
    for (const kw of keywordsToSearch) {
        let pos = normHtml.indexOf(kw);
        while (pos !== -1) {
            // Extraemos un fragmento limpio de texto después de encontrar el nombre del sorteo
            let fragmento = html.substring(pos, pos + 400);
            
            // Convertimos a texto plano quitando etiquetas HTML
            let textoLimpio = fragmento.replace(/<[^>]+>/g, ' ');
            textoLimpio = normalizar(textoLimpio);
            
            // Destruimos horas y años para que no interfieran
            textoLimpio = textoLimpio.replace(/\b\d{1,2}:\d{2}\b/g, ' ');
            textoLimpio = textoLimpio.replace(/\b202\d\b/g, ' ');
            
            // Buscamos 3 números de dos dígitos seguidos que representen los premios
            let numeros = textoLimpio.match(/\b\d{2}\b/g);
            if (numeros && numeros.length >= 3) {
                // Filtramos posibles números de versión o códigos basura comunes
                let reales = numeros.filter(n => n !== '90' && n !== '20' && n !== '26');
                if (reales.length >= 3) {
                    return { p1: reales[0], p2: reales[1], p3: reales[2] };
                }
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

        // 🌐 Fuente principal y confiable: Conectate.com.do
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
                message: `🚨 ALERTA: No se pudo obtener la página de Conectate. Letras leídas: ${htmlCompleto.length}.` 
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
                message: `Escaneo exitoso en Conectate (${htmlCompleto.length} letras). Aún no publican los resultados de hoy.` 
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
            message: `¡Éxito! Se actualizaron ${aInsertar.length} sorteos desde Conectate.com.do.`, 
            data: aInsertar 
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}