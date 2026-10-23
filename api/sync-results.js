import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function normalizarNombre(nombre) {
    if (!nombre) return '';
    return nombre
        .toUpperCase()
        .replace(/[:.]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

const REGLAS_SORTEOS = [
    {
        pattern: /PRIMERA.*11|PRIMERA.*MEDIODIA/i,
        horaPanama: '11:00',
        keywords: ['la primera', 'primera 12pm', 'la primera 11am']
    },
    {
        pattern: /PRIMERA.*6|PRIMERA.*NOCHE|PRIMERA.*8/i,
        horaPanama: '18:00',
        keywords: ['la primera', 'primera noche', 'primera 8pm', 'primera 6pm']
    },
    {
        pattern: /ANGUILLA.*12|ANGUILLA.*1/i,
        horaPanama: '12:00',
        keywords: ['anguilla', '1pm', '12pm']
    },
    {
        pattern: /ANGUILLA.*5|ANGUILLA.*6/i,
        horaPanama: '17:00',
        keywords: ['anguilla', '6pm', '5pm']
    },
    {
        pattern: /ANGUILLA.*8|ANGUILLA.*9/i,
        horaPanama: '20:00',
        keywords: ['anguilla', '9pm', '8pm']
    },
    {
        pattern: /FLORIDA.*D[IÍ]A|FLORIDA.*12|FLORIDA.*MEDIODIA/i,
        horaPanama: '12:30',
        keywords: ['florida', 'mediodia', 'midday', 'dia']
    },
    {
        pattern: /FLORIDA.*NOCHE|FLORIDA.*8|FLORIDA.*9/i,
        horaPanama: '20:45',
        keywords: ['florida', 'noche', 'evening']
    },
    {
        pattern: /NEW YORK.*D[IÍ]A|NEW YORK.*1|NEW YORK.*MEDIODIA/i,
        horaPanama: '13:30',
        keywords: ['new york', 'mediodia', 'midday', 'dia']
    },
    {
        pattern: /NEW YORK.*NOCHE|NEW YORK.*9|NEW YORK.*10/i,
        horaPanama: '21:30',
        keywords: ['new york', 'noche', 'evening']
    }
];

function getFechaPanama() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
}

function obtenerConfigSorteo(nombreSorteo) {
    const norm = normalizarNombre(nombreSorteo);
    for (const regla of REGLAS_SORTEOS) {
        if (regla.pattern.test(norm)) {
            return regla;
        }
    }
    return {
        horaPanama: '00:00',
        keywords: [norm.toLowerCase(), nombreSorteo.toLowerCase()]
    };
}

function buscarResultadoEnHtml(html, keywords) {
    if (!html) return null;

    let htmlLimpio = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ');

    const htmlLower = htmlLimpio.toLowerCase();

    for (const kw of keywords) {
        const pos = htmlLower.indexOf(kw.toLowerCase());
        if (pos !== -1) {
            let fragmento = htmlLimpio.substring(pos, pos + 500);

            // Depuración de formato
            fragmento = fragmento.replace(/\b\d{1,2}:\d{2}\s*(am|pm)?\b/gi, ' ');
            fragmento = fragmento.replace(/\b\d{1,2}\s*(am|pm)\b/gi, ' ');
            fragmento = fragmento.replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/gi, ' ');
            fragmento = fragmento.replace(/\b\d{4}-\d{2}-\d{2}\b/gi, ' ');
            fragmento = fragmento.replace(/<[^>]+>/g, ' ');

            const numerosBrutos = fragmento.match(/\b\d{2}\b/g);

            if (numerosBrutos && numerosBrutos.length >= 1) {
                // Filtro anti-90 para ignorar valores de diseño
                const bolasReales = numerosBrutos.filter(num => num !== '90' || numerosBrutos.length >= 3);
                
                if (bolasReales.length >= 1) {
                    return {
                        p1: bolasReales[0] || '',
                        p2: bolasReales[1] || '',
                        p3: bolasReales[2] || ''
                    };
                }
            }
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

        // URLs oficiales proporcionadas por el usuario consultadas mediante proxy de respaldo
        const urlsObjetivo = [
            'https://enloteria.com/loterias/la-primera',
            'https://enloteria.com/resultados-anguilla',
            'https://enloteria.com/loterias/new-york',
            'https://enloteria.com/loterias/florida'
        ];

        const htmlResponses = await Promise.all(
            urlsObjetivo.map(async (url) => {
                try {
                    const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
                    const r = await fetch(proxyUrl);
                    if (r.ok) {
                        const json = await r.json();
                        return json.contents || '';
                    }
                } catch (e) {}
                return '';
            })
        );

        const htmlCompleto = htmlResponses.join(' ');
        const resultadosAInsertar = [];
        const sorteosAActualizar = [];

        for (const sorteo of sorteos) {
            const config = obtenerConfigSorteo(sorteo.nombre);
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
            } catch (rpcErr) {
                console.warn(`Aviso al evaluar tickets del sorteo #${item.id}:`, rpcErr.message || rpcErr);
            }
        }

        return res.status(200).json({
            success: true,
            message: `¡Sincronización exitosa! Se actualizaron ${resultadosAInsertar.length} sorteos oficiales.`,
            data: resultadosAInsertar
        });

    } catch (error) {
        console.error('Error crítico en sync-results:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
}