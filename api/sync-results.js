import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function normalizar(texto) { 
    return texto ? texto.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : ''; 
}

function getFechaPanama() { 
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' }); 
}

function extraerPremios(html, nombreSorteo) {
    if (!html) return null;
    
    const normHtml = normalizar(html).replace(/<[^>]+>/g, ' '); 
    
    let palabras = nombreSorteo.split(' ').filter(p => p.length > 3);
    if (palabras.length === 0) palabras = [nombreSorteo];
    const palabraClave = normalizar(palabras[0]);
    
    let pos = normHtml.indexOf(palabraClave);
    
    while (pos !== -1) {
        let fragmento = normHtml.substring(pos, pos + 400);
        
        fragmento = fragmento.replace(/\b\d{1,2}:\d{2}\b/g, ' ');
        fragmento = fragmento.replace(/\b202\d\b/g, ' ');

        const numeros = fragmento.match(/\b\d{2}\b/g);
        if (numeros && numeros.length >= 3) {
            const reales = numeros.filter(n => n !== '90');
            if (reales.length >= 3) {
                return { p1: reales[0], p2: reales[1], p3: reales[2] };
            }
        }
        pos = normHtml.indexOf(palabraClave, pos + 10);
    }
    return null;
}

export default async function handler(req, res) {
    try {
        const { data: sorteos, error: errSorteos } = await supabase.from('sorteos').select('id, nombre, estatus');
        if (errSorteos || !sorteos || sorteos.length === 0) {
            return res.status(400).json({ success: false, message: 'No hay sorteos configurados.' });
        }

        const fecha = getFechaPanama();
        let htmlCompleto = '';

        // NUEVAS FUENTES Y PROXIES (corsproxy.io y allorigins)
        const sitios = [
            'https://loteriadominicana.com.do/',
            'https://conectate.com.do/loterias/'
        ];

        for (const sitio of sitios) {
            try {
                // Intento 1: corsproxy.io
                let r = await fetch(`https://corsproxy.io/?${encodeURIComponent(sitio)}`);
                if (r.ok) {
                    htmlCompleto += await r.text() + ' \n ';
                    continue;
                }
                
                // Intento 2: api.allorigins.win
                r = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(sitio)}`);
                if (r.ok) {
                    const data = await r.json();
                    if (data && data.contents) {
                        htmlCompleto += data.contents + ' \n ';
                    }
                }
            } catch (e) {
                console.warn("Fallo proxy para:", sitio);
            }
        }

        if (htmlCompleto.length < 500) {
            return res.status(200).json({ 
                success: true, 
                message: `🚨 ALERTA: Seguimos sin poder leer las páginas. (Letras leídas: ${htmlCompleto.length}). El bloqueo persiste.` 
            });
        }

        const aInsertar = [];
        for (const sorteo of sorteos) {
            const resultado = extraerPremios(htmlCompleto, sorteo.nombre);
            if (resultado) {
                aInsertar.push({
                    sorteo_id: sorteo.id, 
                    fecha: fecha, 
                    p1: resultado.p1, p2: resultado.p2, p3: resultado.p3,
                    primero: resultado.p1, segundo: resultado.p2, tercero: resultado.p3,
                    updated_at: new Date().toISOString()
                });
            }
        }

        if (aInsertar.length === 0) {
            return res.status(200).json({ 
                success: true, 
                message: `Escaneo completado. Leímos ${htmlCompleto.length} letras de las páginas, pero no hallamos números para los sorteos configurados hoy.` 
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
            message: `¡Éxito! Se actualizaron ${aInsertar.length} sorteos automáticamente.`, 
            data: aInsertar 
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
}