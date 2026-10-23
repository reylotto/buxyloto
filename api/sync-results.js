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

// Reglas estrictas y ampliadas para EnLoteria.com
const REGLAS_SORTEOS = [
    { pattern: /PRIMERA.*(11|12|DIA|MEDIODIA|AM)/i, keywords: ['PRIMERA RESULTADOS HOY', 'LA PRIMERA', 'PRIMERA DIA', 'PRIMERA 12'] },
    { pattern: /PRIMERA.*(6|8|NOCHE|PM)/i, keywords: ['LA PRIMERA NOCHE', 'PRIMERA NOCHE', 'PRIMERA 8'] },
    { pattern: /ANGUILLA.*(10|AM)/i, keywords: ['ANGUILLA 10', 'ANGUILLA MA'] },
    { pattern: /ANGUILLA.*(12|1|MEDIODIA|PM)/i, keywords: ['ANGUILLA 1', 'ANGUILLA 12', 'ANGUILLA MEDIODIA', 'ANGUILLA TARDE'] },
    { pattern: /ANGUILLA.*(5|6)/i, keywords: ['ANGUILLA 6', 'ANGUILLA 5'] },
    { pattern: /ANGUILLA.*(8|9|NOCHE)/i, keywords: ['ANGUILLA 9', 'ANGUILLA 8', 'ANGUILLA NOCHE'] },
    { pattern: /FLORIDA.*(12|1|DIA|MEDIODIA|TARDE)/i, keywords: ['FLORIDA DIA', 'FLORIDA TARDE', 'FLORIDA MEDIODIA', 'FLORIDA'] },
    { pattern: /FLORIDA.*(8|9|NOCHE)/i, keywords: ['FLORIDA NOCHE'] },
    { pattern: /NEW YORK.*(12|1|DIA|MEDIODIA|TARDE)/i, keywords: ['NEW YORK TARDE', 'NEW YORK DIA', 'NEW YORK MEDIODIA', 'YORK TARDE', 'NEW YORK'] },
    { pattern: /NEW YORK.*(7|8|9|10|NOCHE)/i, keywords: ['NEW YORK NOCHE', 'YORK NOCHE'] }
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
            let fragmento = html.substring(pos, pos + 800);
            
            // ESTRATEGIA 1: Buscar números entre etiquetas HTML de EnLoteria
            const regexEtiquetas = />\s*(\d{2})\s*</g;
            let matches = [];
            let m;
            while ((m = regexEtiquetas.exec(fragmento)) !== null) {
                matches.push(m[1]);
            }
            let reales = matches.filter(n => n !== '90'); // Evita posibles códigos basura
            if (reales.length >= 3) {
                return { p1: reales[0], p2: reales[1], p3: reales[2] };
            }

            // ESTRATEGIA 2: Limpiar el HTML e ignorar fechas exactas para no atrapar el día del mes
            let textoLimpio = fragmento.replace(/<[^>]+>/g, ' ');
            textoLimpio = textoLimpio.replace(/\b\d{1,2}:\d{2}\s*(AM|PM|am|pm)?\b/gi, ' '); // Destruye horas
            textoLimpio = textoLimpio.replace(/\b202\d\b/g, ' '); // Destruye año 202x
            // 🚀 ELIMINADOR DE FECHAS: Destruye "23 de octubre", "24 de octubre", etc.
            textoLimpio = textoLimpio.replace(/\b(1[0-9]|2[0-9]|3[0-1]|[1-9])\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/gi, ' ');
            
            let regexGrupo = /(?:^|[^\d])(\d{2})\s*[-/|*]?\s*(\d{2})\s*[-/|*]?\s*(\d{2})(?!\d)/;
            let matchGrupo = textoLimpio.match(regexGrupo);
            
            if (matchGrupo) {
                return { p1: matchGrupo[1], p2: matchGrupo[2], p3: matchGrupo[3] };
            }
            
            // ESTRATEGIA 3: Atrapar los 3 primeros números sueltos válidos
            let sueltos = textoLimpio.match(/\b\d{2}\b/g);
            if (sueltos && sueltos.length >= 3) {
                let sueltosReales = sueltos.filter(n => n !== '90');
                if (sueltosReales.length >= 3) {
                    return { p1: sueltosReales[0], p2: sueltosReales[1], p3: sueltosReales[2] };
                }
            }

            pos = htmlUpper.indexOf(kw, pos + 10);
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
        
        // 🚀 BUCLE MAESTRO: Visitará las 4 páginas oficiales que me enviaste
        const sitios = [
            'https://enloteria.com/loterias/la-primera',
            'https://enloteria.com/resultados-anguilla',
            'https://enloteria.com/loterias/new-york',
            'https://enloteria.com/loterias/florida'
        ];

        let htmlCompleto = '';

        // Recolectar el código HTML de todas las páginas juntas
        for (const sitio of sitios) {
            try {
                const url = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(sitio)}`;
                const r = await fetch(url);
                if (r.ok) {
                    htmlCompleto += " " + await r.text();
                }
            } catch (e) {
                console.warn(`Falló la conexión con ScraperAPI para: ${sitio}`);
            }
        }

        if (htmlCompleto.length < 500) {
            return res.status(200).json({ 
                success: true, 
                message: `🚨 ALERTA: No se pudo obtener el contenido. Letras leídas: ${htmlCompleto.length}.` 
            });
        }

        const aInsertar = [];
        for (const sorteo of sorteos) {
            const resultado = extraerPremios(htmlCompleto, sorteo.nombre);
            if (resultado) {
                aInsertar.push({
                    sorteo_id: sorteo.id, fecha: fecha, 
                    p1: resultado.p1, p2: resultado.p2, p3: resultado.p3,
                    primero: resultado.p1, segundo: resultado.p2, tercero: resultado.p3,
                    updated_at: new Date().toISOString()
                });
            }
        }

        if (aInsertar.length === 0) {
            return res.status(200).json({ 
                success: true, 
                message: `Escaneo exitoso (${htmlCompleto.length} letras procesadas). Aún no se detectan los premios oficiales de hoy.` 
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
            message: `¡Éxito! Se actualizaron ${aInsertar.length} sorteos extrayendo números de EnLoteria.`, 
            data: aInsertar 
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}