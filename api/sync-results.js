import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Normaliza nombres de sorteos para comparación flexible (elimina puntuación y espacios extras)
 */
function normalizarNombre(nombre) {
    if (!nombre) return '';
    return nombre
        .toUpperCase()
        .replace(/[:.]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Mapeo flexible de reglas y patrones para vincular sorteos de la BD con el sitio web.
 */
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
    
    // Limpieza de código JS, CSS y etiquetas HTML para evitar falsos positivos con atributos
    const htmlLimpio = html
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ');

    const htmlLower = htmlLimpio.toLowerCase();

    for (const kw of keywords) {
        const pos = htmlLower.indexOf(kw.toLowerCase());
        if (pos !== -1) {
            const fragmento = htmlLimpio.substring(pos, pos + 300);
            const numeros = fragmento.match(/\b\d{2}\b/g);

            if (numeros && numeros.length >= 1) {
                return {
                    p1: numeros[0],
                    p2: numeros[1] || '',
                    p3: numeros[2] || ''
                };
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

        const urls = [
            'https://enloteria.com/',
            'https://enloteria.com/resultados-anguilla',
            'https://enloteria.com/la-primera',
            'https://enloteria.com/florida',
            'https://enloteria.com/new-york'
        ];

        const htmlResponses = await Promise.all(
            urls.map(url => 
                fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
                    .then(r => r.ok ? r.text() : '')
                    .catch(() => '')
            )
        );

        const htmlCompleto = htmlResponses.join(' ');
        const resultadosAInsertar = [];
        const sorteosAActualizar = [];

        for (const sorteo of sorteos) {
            const config = obtenerConfigSorteo(sorteo.nombre);

            if (config && !yaJugoEnPanama(config.horaPanama)) {
                continue;
            }

            const resultadoEncontrado = buscarResultadoEnHtml(htmlCompleto, config.keywords);

            if (resultadoEncontrado) {
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
                message: `No se encontraron resultados pendientes por sincronizar para la fecha ${fechaProcesar}.`
            });
        }

        // 1. Guardar o actualizar en la tabla 'resultados'
        const { error: upsertError } = await supabase
            .from('resultados')
            .upsert(resultadosAInsertar, { onConflict: 'sorteo_id,fecha' });

        if (upsertError) throw upsertError;

        // 2. Cerrar el sorteo en la tabla 'sorteos' y ejecutar la evaluación de tickets
        for (const item of sorteosAActualizar) {
            await supabase
                .from('sorteos')
                .update({
                    p1: item.p1,
                    p2: item.p2,
                    p3: item.p3,
                    primer_premio: item.p1,
                    segundo_premio: item.p2,
                    tercer_premio: item.p3,
                    estatus: 'cerrado',
                    estado: 'cerrado'
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