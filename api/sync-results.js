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
        keywords: ['la primera 12pm', 'la primera mediodia', 'primera 12pm', 'la primera 11am']
    },
    {
        pattern: /PRIMERA.*6|PRIMERA.*NOCHE|PRIMERA.*8/i,
        horaPanama: '18:00',
        keywords: ['la primera 8pm', 'la primera noche', 'primera 8pm', 'la primera 7pm', 'la primera 6pm']
    },
    {
        pattern: /ANGUILLA.*12|ANGUILLA.*1/i,
        horaPanama: '12:00',
        keywords: ['anguilla 1pm', 'anguilla 1:00 pm', 'anguilla 1 pm', 'anguilla 12pm']
    },
    {
        pattern: /ANGUILLA.*5|ANGUILLA.*6/i,
        horaPanama: '17:00',
        keywords: ['anguilla 6pm', 'anguilla 6:00 pm', 'anguilla 6 pm', 'anguilla 5pm']
    },
    {
        pattern: /ANGUILLA.*8|ANGUILLA.*9/i,
        horaPanama: '20:00',
        keywords: ['anguilla 9pm', 'anguilla 9:00 pm', 'anguilla 9 pm', 'anguilla 8pm']
    },
    {
        pattern: /FLORIDA.*D[IÍ]A|FLORIDA.*12|FLORIDA.*MEDIODIA/i,
        horaPanama: '12:30',
        keywords: ['florida mediodia', 'florida midday', 'florida 1:30', 'florida dia']
    },
    {
        pattern: /FLORIDA.*NOCHE|FLORIDA.*8|FLORIDA.*9/i,
        horaPanama: '20:45',
        keywords: ['florida noche', 'florida evening', 'florida 9:45', 'florida 8:45']
    },
    {
        pattern: /NEW YORK.*D[IÍ]A|NEW YORK.*1|NEW YORK.*MEDIODIA/i,
        horaPanama: '13:30',
        keywords: ['new york mediodia', 'new york midday', 'new york 2:30', 'new york dia']
    },
    {
        pattern: /NEW YORK.*NOCHE|NEW YORK.*9|NEW YORK.*10/i,
        horaPanama: '21:30',
        keywords: ['new york noche', 'new york evening', 'new york 10:30', 'new york 9:30']
    }
];

function getFechaPanama() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
}

function yaJugoEnPanama(horaSorteoStr) {
    if (!horaSorteoStr) return true;
    const ahoraStr = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Panama', hour12: false });
    const [hAhora, mAhora] = ahoraStr.split(':').map(Number);
    const [hSorteo, mSorteo] = horaSorteoStr.split(':').map(Number);

    const minutosActuales = hAhora * 60 + mAhora;
    const minutosSorteo = hSorteo * 60 + mSorteo;

    return minutosActuales >= minutosSorteo;
}

// 🔥 AQUÍ ESTÁ LA FUNCIÓN QUE FALTABA 🔥
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
            let fragmento = htmlLimpio.substring(pos, pos + 400);

            // Limpieza de formato para extraer bolas limpias
            fragmento = fragmento.replace(/\b\d{1,2}:\d{2}\s*(am|pm)?\b/gi, ' ');
            fragmento = fragmento.replace(/\b\d{1,2}\s*(am|pm)\b/gi, ' ');
            fragmento = fragmento.replace(/\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/gi, ' ');
            fragmento = fragmento.replace(/\b\d{4}-\d{2}-\d{2}\b/gi, ' ');
            fragmento = fragmento.replace(/<[^>]+>/g, ' ');

            const numerosBrutos = fragmento.match(/\b\d{2}\b/g);

            if (numerosBrutos && numerosBrutos.length >= 1) {
                // Filtro estricto anti-90
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

        // UNIFICACIÓN DE FUENTE: Leemos agencia-reylotto a través del proxy para saltar bloqueos de Vercel
        const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent('https://agencia-reylotto.com/resultados.php')}`;
        
        let htmlCompleto = '';
        try {
            const fetchRes = await fetch(proxyUrl);
            const data = await fetchRes.json();
            htmlCompleto = data.contents || '';
        } catch (fetchErr) {
            console.error("Error al extraer HTML externo:", fetchErr);
        }

        const resultadosAInsertar = [];
        const sorteosAActualizar = [];

        for (const sorteo of sorteos) {
            const config = obtenerConfigSorteo(sorteo.nombre);

            if (config && !yaJugoEnPanama(config.horaPanama)) {
                continue; // Ignora los sorteos cuya hora aún no ha pasado en Panamá
            }

            const resultadoEncontrado = buscarResultadoEnHtml(htmlCompleto, config.keywords);

            if (resultadoEncontrado && resultadoEncontrado.p1) {
                resultadosAInsertar.push({
                    sorteo_id: sorteo.id,
                    fecha: fechaProcesar,
                    primero: resultadoEncontrado.p1,
                    segundo: resultadoEncontrado.p2,
                    tercer: resultadoEncontrado.p3,
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
                message: `No se encontraron resultados pendientes por sincronizar para la fecha ${fechaProcesar}.`
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
            message: `Sincronizados e ingresados ${resultadosAInsertar.length} sorteos para la fecha ${fechaProcesar}.`,
            data: resultadosAInsertar
        });

    } catch (error) {
        console.error('Error en sync-results:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
}