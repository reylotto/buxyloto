import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const SCRAPER_API_KEY = 'dcebab8a24bfa2e19a1e6e333d26ac85'; 

function normalizar(texto) { 
    return texto ? texto.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ''; 
}

function getFechaPanama() { 
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' }); 
}

// 🎯 URLs individuales por cada tipo de lotería para garantizar lectura directa
const PAGINAS_LOTERIAS = [
    { nombreRegla: 'PRIMERA', url: 'https://conectate.com.do/loterias/la-primera' },
    { nombreRegla: 'ANGUILLA', url: 'https://conectate.com.do/loterias/anguilla' },
    { nombreRegla: 'FLORIDA', url: 'https://conectate.com.do/loterias/florida' },
    { nombreRegla: 'NEW YORK', url: 'https://conectate.com.do/loterias/new-york' }
];

function extraerPremiosDeHtml(html, nombreSorteo) {
    if (!html) return null;
    const normSorteo = normalizar(nombreSorteo);
    
    // Buscamos dentro de la página individual el bloque que coincida con el nombre del sorteo (ej: "Noche", "Día", "10 AM")
    let pos = normalizar(html).indexOf(normSorteo);
    if (pos === -1) {
        // Búsqueda flexible por palabras clave si el nombre exacto varía
        if (normSorteo.includes('PRIMERA')) pos = normalizar(html).indexOf('PRIMERA');
        if (normSorteo.includes('ANGUILLA')) pos = normalizar(html).indexOf('ANGUILLA');
        if (normSorteo.includes('FLORIDA')) pos = normalizar(html).indexOf('FLORIDA');
        if (normSorteo.includes('YORK')) pos = normalizar(html).indexOf('YORK');
    }

    if (pos !== -1) {
        let fragmento = html.substring(pos, pos + 800);
        
        // Buscamos los span con la clase text-gray-800 que identificamos en el inspector
        const regexSpan = /<span\s+class="[^"]*text-gray-800[^"]*">\s*(\d{2})\s*<\/span>/gi;
        let numeros = [];
        let match;
        while ((match = regexSpan.exec(fragmento)) !== null) {
            numeros.push(match[1]);
        }
        
        if (numeros.length >= 3) {
            return { p1: numeros[0], p2: numeros[1], p3: numeros[2] };
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
        const aInsertar = [];

        // Consultamos de forma independiente cada página oficial específica
        for (const pagina of PAGINAS_LOTERIAS) {
            try {
                const scraperUrl = `http://api.scraperapi.com?api_key=${SCRAPER_API_KEY}&url=${encodeURIComponent(pagina.url)}`;
                const r = await fetch(scraperUrl);
                if (r.ok) {
                    const html = await r.text();
                    
                    for (const sorteo of sorteos) {
                        const normNombre = normalizar(sorteo.nombre);
                        if (normNombre.includes(pagina.nombreRegla)) {
                            const resultado = extraerPremiosDeHtml(html, sorteo.nombre);
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
                }
            } catch (e) {
                console.warn(`Error consultando ${pagina.url}`);
            }
        }

        if (aInsertar.length === 0) {
            return res.status(200).json({ 
                success: true, 
                message: `Escaneo completado en páginas secundarias. Aún no se detectan resultados para hoy.` 
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
            message: `¡Éxito! Se actualizaron ${aInsertar.length} sorteos mediante subpáginas directas.`, 
            data: aInsertar 
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}