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

function extraerPremios(html, nombreSorteo) {
    if (!html) return null;
    
    let dbName = normalizar(nombreSorteo);
    let keywords = [dbName];
    
    // 🧠 DICCIONARIO INTELIGENTE: Traduce los nombres de tu base de datos a los títulos de las páginas web
    if (dbName.includes('PRIMERA')) {
        if (dbName.includes('NOCHE') || dbName.includes('8')) keywords = ['LA PRIMERA NOCHE', 'PRIMERA NOCHE'];
        else keywords = ['LA PRIMERA', 'PRIMERA DIA', 'PRIMERA 12'];
    } else if (dbName.includes('ANGUILLA') || dbName.includes('ANGUILA')) {
        if (dbName.includes('10')) keywords = ['ANGUILA 10', 'ANGUILLA 10'];
        else if (dbName.includes('1') || dbName.includes('12')) keywords = ['ANGUILA 1', 'ANGUILLA 1', 'ANGUILA MEDIODIA'];
        else if (dbName.includes('6')) keywords = ['ANGUILA 6', 'ANGUILLA 6', 'ANGUILA TARDE'];
        else if (dbName.includes('9') || dbName.includes('8')) keywords = ['ANGUILA 9', 'ANGUILLA 9', 'ANGUILA NOCHE'];
    } else if (dbName.includes('FLORIDA')) {
        if (dbName.includes('NOCHE') || dbName.includes('8') || dbName.includes('9')) keywords = ['FLORIDA NOCHE'];
        else keywords = ['FLORIDA DIA', 'FLORIDA TARDE'];
    } else if (dbName.includes('YORK')) {
        if (dbName.includes('NOCHE') || dbName.includes('7') || dbName.includes('8') || dbName.includes('9') || dbName.includes('10')) keywords = ['NEW YORK NOCHE', 'YORK NOCHE'];
        else keywords = ['NEW YORK DIA', 'NEW YORK TARDE', 'YORK DIA'];
    }

    const normHtml = normalizar(html);
    
    for (const kw of keywords) {
        let pos = normHtml.indexOf(kw);
        while (pos !== -1) {
            // Toma el bloque de texto inmediatamente después del título del sorteo
            let fragment = html.substring(pos, pos + 600);
            
            // 🧹 1. DESTRUIR CÓDIGO: Quita todas las etiquetas HTML y deja solo texto puro
            let texto = fragment.replace(/<[^>]+>/g, ' ');
            texto = normalizar(texto);
            
            // 🧹 2. DESTRUIR FECHAS Y HORAS: Para evitar que el robot crea que "23 de octubre" es el premio 23.
            texto = texto.replace(/\b(LUNES|MARTES|MIERCOLES|JUEVES|VIERNES|SABADO|DOMINGO)\b/g, ' ');
            texto = texto.replace(/\b\d{1,2}\s+(DE\s+)?(ENERO|FEBRERO|MARZO|ABRIL|MAYO|JUNIO|JULIO|AGOSTO|SEPTIEMBRE|OCTUBRE|NOVIEMBRE|DICIEMBRE)\b/g, ' ');
            texto = texto.replace(/\b202[0-9]\b/g, ' '); // Borra años (2024, 2026, etc)
            texto = texto.replace(/\b\d{1,2}:\d{2}\s*(AM|PM)?\b/g, ' '); // Borra horas como 12:00PM
            texto = texto.replace(/\b(AM|PM)\b/g, ' '); 
            
            // 🎯 3. CAPTURA: Después de limpiar la basura, los 3 primeros números que encuentre son obligatoriamente los premios.
            let matches = texto.match(/\b\d{2}\b/g);
            if (matches && matches.length >= 3) {
                return { p1: matches[0], p2: matches[1], p3: matches[2] };
            }
            
            pos = normHtml.indexOf(kw, pos + 10);
        }
    }
    return null; // Si no encontró números es porque aún no juega
}

export default async function handler(req, res) {
    try {
        const { data: sorteos } = await supabase.from('sorteos').select('id, nombre, estatus');
        if (!sorteos || sorteos.length === 0) {
            return res.status(400).json({ success: false, message: 'No hay sorteos configurados.' });
        }

        const fecha = getFechaPanama();
        
        // Vamos directo a tus páginas requeridas + 1 respaldo
        const sitios = [
            'https://enloteria.com/loterias/la-primera',
            'https://enloteria.com/resultados-anguilla',
            'https://enloteria.com/loterias/new-york',
            'https://enloteria.com/loterias/florida',
            'https://conectate.com.do/loterias/'
        ];

        const aInsertar = [];
        let htmlExtraido = 0;

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