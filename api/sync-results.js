import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function normalizarNombre(nombre) {
    if (!nombre) return '';
    return nombre.toUpperCase().replace(/[:.]/g, '').replace(/\s+/g, ' ').trim();
}

const REGLAS_SORTEOS = [
    { pattern: /PRIMERA.*11|PRIMERA.*MEDIODIA/i, horaPanama: '11:00', keywords: ['primera 12', 'primera mediodia', 'la primera'] },
    { pattern: /PRIMERA.*6|PRIMERA.*NOCHE|PRIMERA.*8/i, horaPanama: '18:00', keywords: ['primera noche', 'primera 8', 'la primera'] },
    { pattern: /ANGUILLA.*12|ANGUILLA.*1/i, horaPanama: '12:00', keywords: ['anguilla 1', 'anguilla 12'] },
    { pattern: /ANGUILLA.*5|ANGUILLA.*6/i, horaPanama: '17:00', keywords: ['anguilla 6', 'anguilla 5'] },
    { pattern: /ANGUILLA.*8|ANGUILLA.*9/i, horaPanama: '20:00', keywords: ['anguilla 9', 'anguilla 8'] },
    { pattern: /FLORIDA.*D[IÍ]A|FLORIDA.*12|FLORIDA.*MEDIODIA/i, horaPanama: '12:30', keywords: ['florida dia', 'florida mediodia', 'florida midday'] },
    { pattern: /FLORIDA.*NOCHE|FLORIDA.*8|FLORIDA.*9/i, horaPanama: '20:45', keywords: ['florida noche', 'florida evening'] },
    { pattern: /NEW YORK.*D[IÍ]A|NEW YORK.*1|NEW YORK.*MEDIODIA/i, horaPanama: '13:30', keywords: ['new york dia', 'new york mediodia', 'new york midday'] },
    { pattern: /NEW YORK.*NOCHE|NEW YORK.*9|NEW YORK.*10/i, horaPanama: '21:30', keywords: ['new york noche', 'new york evening'] }
];

function getFechaPanama() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
}

function yaJugoEnPanama(horaSorteoStr) {
    if (!horaSorteoStr) return true;
    const ahoraStr = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Panama', hour12: false });
    const [hAhora, mAhora] = ahoraStr.split(':').map(Number);
    const [hSorteo, mSorteo] = horaSorteoStr.split(':').map(Number);
    return (hAhora * 60 + mAhora) >= (hSorteo * 60 + mSorteo);
}

function obtenerConfigSorteo(nombreSorteo) {
    const norm = normalizarNombre(nombreSorteo);
    return REGLAS_SORTEOS.find(r => r.pattern.test(norm)) || { horaPanama: '00:00', keywords: [norm.toLowerCase()] };
}

// 🔥 Escáner Profundo Multi-Bloque
function buscarResultadoEnHtml(html, keywords) {
    if (!html) return null;
    const htmlLower = html.toLowerCase();

    for (const kw of keywords) {
        let pos = htmlLower.indexOf(kw.toLowerCase());
        
        // Bucle para buscar en TODAS las menciones de la palabra (evita quedarse atrapado en el menú)
        while (pos !== -1) {
            let fragmento = htmlLower.substring(pos, pos + 800);

            // Limpieza agresiva de HTML, fechas y horas
            fragmento = fragmento.replace(/<[^>]+>/g, ' '); 
            fragmento = fragmento.replace(/\b\d{1,2}:\d{2}\s*(am|pm)?\b/gi, ' '); 
            fragmento = fragmento.replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/gi, ' ');
            fragmento = fragmento.replace(/\b202\d\b/g, ' ');

            const numeros = fragmento.match(/\b\d{2}\b/g);

            if (numeros && numeros.length >= 3) {
                // Filtro Anti-90
                const bolasReales = numeros.filter(n => n !== '90'); 
                
                if (bolasReales.length >= 3) {
                    return {
                        p1: bolasReales[0],
                        p2: bolasReales[1],
                        p3: bolasReales[2]
                    };
                }
            }
            // Sigue buscando la siguiente coincidencia en la página
            pos = htmlLower.indexOf(kw.toLowerCase(), pos + 10);
        }
    }
    return null;
}

export default async function handler(req, res) {
    try {
        const fechaProcesar = getFechaPanama();

        const { data: sorteos, error: errSorteos } = await supabase
            .from('sorteos')
            .select('id, nombre, estatus, estado');

        if (errSorteos || !sorteos || sorteos.length === 0) {
            return res.status(400).json({ success: false, message: 'No hay sorteos configurados.' });
        }

        // 🔥 MULTI-FUENTE DE RESPALDO (Bypass de seguridad)
        const fuentes = [
            'https://loteriadominicanas.com/',
            'https://conectate.com.do/loterias/',
            'https://enloteria.com/'
        ];

        let htmlCompleto = '';
        for (const fuente of fuentes) {
            try {
                // Se usa el flag /raw para obtener el HTML puro sin conversiones JSON
                const r = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(fuente)}`);
                if (r.ok) {
                    htmlCompleto += await r.text() + ' \n\n ';
                }
            } catch (e) {
                console.warn("Fallo temporal en fuente:", fuente);
            }
        }

        const resultadosAInsertar = [];
        const sorteosAActualizar = [];

        for (const sorteo of sorteos) {
            const config = obtenerConfigSorteo(sorteo.nombre);

            if (config && !yaJugoEnPanama(config.horaPanama)) {
                continue; 
            }

            const resultadoEncontrado = buscarResultadoEnHtml(htmlCompleto, config.keywords);

            if (resultadoEncontrado && resultadoEncontrado.p1) {
                resultadosAInsertar.push({
                    sorteo_id: sorteo.id,
                    fecha: fechaProcesar,
                    primero: resultadoEncontrado.p1,
                    segundo: resultadoEncontrado.p2,
                    tercero: resultadoEncontrado.p3,
                    p1: resultadoEncontrado.p1,
                    p2: resultadoEncontrado.p2,
                    p3: resultadoEncontrado.p3,
                    updated_at: new Date().toISOString()
                });

                sorteosAActualizar.push({
                    id: sorteo.id,
                    p1: resultadoEncontrado.p1,
                    p2: resultadoEncontrado.p2,
                    p3: resultadoEncontrado.p3
                });
            }
        }

        if (resultadosAInsertar.length === 0) {
            return res.status(200).json({
                success: true,
                message: `Escaneo completado. No se detectaron nuevos premios publicados en las fuentes oficiales para ${fechaProcesar}.`
            });
        }

        const { error: upsertError } = await supabase
            .from('resultados')
            .upsert(resultadosAInsertar, { onConflict: 'sorteo_id,fecha' });

        if (upsertError) throw upsertError;

        for (const item of sorteosAActualizar) {
            await supabase
                .from('sorteos')
                .update({
                    p1: item.p1,
                    p2: item.p2,
                    p3: item.p3,
                    primer_premio: item.p1,
                    segundo_premio: item.p2,
                    tercer_premio: item.p3
                })
                .eq('id', item.id);

            try {
                await supabase.rpc('evaluar_tickets_sorteo', {
                    p_id_sorteo: item.id,
                    p_num1: item.p1,
                    p_num2: item.p2,
                    p_num3: item.p3
                });
            } catch (rpcErr) {}
        }

        return res.status(200).json({
            success: true,
            message: `¡Éxito! Se actualizaron ${resultadosAInsertar.length} sorteos automáticamente.`,
            data: resultadosAInsertar
        });

    } catch (error) {
        console.error('Error crítico en sync-results:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
}