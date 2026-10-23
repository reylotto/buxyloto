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

// 🧠 TRADUCTOR HORARIO: Conecta el nombre de tu base de datos con el título exacto en R.D.
function obtenerKeywords(nombreDb) {
    const n = normalizar(nombreDb);
    if (n.includes('PRIMERA')) {
        if (n.includes('6') || n.includes('NOCHE')) return ['LA PRIMERA NOCHE'];
        return ['LA PRIMERA RESULTADOS HOY', 'LA PRIMERA'];
    }
    if (n.includes('ANGUILA') || n.includes('ANGUILLA')) {
        // RD está adelantado 1 hora respecto a Panamá
        if (n.includes('12')) return ['ANGUILLA 1:00', 'ANGUILLA 1PM', 'ANGUILLA 1 PM'];
        if (n.includes('8') || n.includes('NOCHE')) return ['ANGUILLA 9:00', 'ANGUILLA 9PM', 'ANGUILLA 9 PM'];
        if (n.includes('10')) return ['ANGUILLA 10'];
    }
    if (n.includes('FLORIDA')) {
        if (n.includes('8') || n.includes('9') || n.includes('NOCHE')) return ['FLORIDA NOCHE'];
        return ['FLORIDA DIA', 'FLORIDA TARDE'];
    }
    if (n.includes('YORK')) {
        if (n.includes('9') || n.includes('10') || n.includes('NOCHE')) return ['NEW YORK NOCHE'];
        return ['NEW YORK DIA', 'NEW YORK TARDE'];
    }
    return [n];
}

function extraerPremios(html, nombreSorteo) {
    if (!html) return null;
    const normHtml = normalizar(html); 
    const keywords = obtenerKeywords(nombreSorteo);
    
    for (const kw of keywords) {
        let pos = normHtml.indexOf(kw);
        while (pos !== -1) {
            // Tomamos un bloque de texto después del título
            let fragmento = html.substring(pos, pos + 500);
            let textUpper = normalizar(fragmento);
            
            // 🛑 FILTRO INTELIGENTE: Si dice "Avisame", el sorteo AÚN NO HA JUGADO.
            if (textUpper.includes('AVISAME CUANDO') || textUpper.includes('PROXIMO CIERRE')) {
                pos = normHtml.indexOf(kw, pos + 10);
                continue;
            }
            
            // 🧹 DESTRUCTOR DE BASURA: Quitamos todo el código y dejamos solo texto puro
            let texto = fragmento.replace(/<[^>]+>/g, ' ');
            texto = normalizar(texto);
            
            // Eliminamos horas (ej. 12:00 PM, 1:00) y Años (2026)
            texto = texto.replace(/\b\d{1,2}:\d{2}\s*(AM|PM)?\b/g, ' ');
            texto = texto.replace(/\b(AM|PM)\b/g, ' ');
            texto = texto.replace(/\b202\d\b/g, ' ');
            
            // Eliminamos fechas (Lunes, "23 de octubre", "10/23")
            texto = texto.replace(/\b(LUNES|MARTES|MIERCOLES|JUEVES|VIERNES|SABADO|DOMINGO)\b/g, ' ');
            texto = texto.replace(/\b\d{1,2}\s+DE\s+[A-Z]+\b/gi, ' ');
            texto = texto.replace(/\b\d{1,2}[/-]\d{1,2}\b/g, ' '); 
            
            // 🎯 CAPTURA LÁSER: Busca exactamente 3 bolitas juntas separadas por espacios.
            const regex = /(?:^|[^\d])(\d{2})\s+[-]*\s*(\d{2})\s+[-]*\s*(\d{2})(?!\d)/;
            const match = texto.match(regex);
            
            if (match) {
                return { p1: match[1], p2: match[2], p3: match[3] };
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
        
        // Las URLs exactas que me enviaste
        const sitios = [
            'https://enloteria.com/loterias/la-primera',
            'https://enloteria.com/resultados-anguilla',
            'https://enloteria.com/loterias/new-york',
            'https://enloteria.com/loterias/florida'
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
                message: `Escaneo finalizado. Aún no se han publicado los premios correspondientes a hoy.` 
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