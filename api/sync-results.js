import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * CONFIGURACIÓN DE SORTEOS:
 * - horaPanama: Hora exacta de juego en Panamá (Formato 24h). No se busca antes de esta hora.
 * - keywords: Términos de búsqueda en la web de origen.
 */
const CONFIG_SORTEOS = {
    // --- LA PRIMERA ---
    'LA PRIMERA 11AM': { horaPanama: '11:00', keywords: ['la primera 12pm', 'la primera mediodia', 'primera 12pm'] },
    'LA PRIMERA 11:00 AM': { horaPanama: '11:00', keywords: ['la primera 12pm', 'la primera mediodia', 'primera 12pm'] },
    'LA PRIMERA 6PM': { horaPanama: '18:00', keywords: ['la primera 8pm', 'la primera noche', 'primera 8pm', 'la primera 7pm'] },
    'LA PRIMERA 6:00 PM': { horaPanama: '18:00', keywords: ['la primera 8pm', 'la primera noche', 'primera 8pm', 'la primera 7pm'] },

    // --- ANGUILLA ---
    'ANGUILLA 12PM': { horaPanama: '12:00', keywords: ['anguilla 1pm', 'anguilla 1:00 pm', 'anguilla 1 pm'] },
    'ANGUILLA 12:00 PM': { horaPanama: '12:00', keywords: ['anguilla 1pm', 'anguilla 1:00 pm', 'anguilla 1 pm'] },
    'ANGUILLA 5PM': { horaPanama: '17:00', keywords: ['anguilla 6pm', 'anguilla 6:00 pm', 'anguilla 6 pm'] },
    'ANGUILLA 5:00 PM': { horaPanama: '17:00', keywords: ['anguilla 6pm', 'anguilla 6:00 pm', 'anguilla 6 pm'] },
    'ANGUILLA 8PM': { horaPanama: '20:00', keywords: ['anguilla 9pm', 'anguilla 9:00 pm', 'anguilla 9 pm'] },
    'ANGUILLA 8:00 PM': { horaPanama: '20:00', keywords: ['anguilla 9pm', 'anguilla 9:00 pm', 'anguilla 9 pm'] },

    // --- FLORIDA ---
    'FLORIDA DIA': { horaPanama: '12:30', keywords: ['florida mediodia', 'florida midday', 'florida 1:30', 'florida dia'] },
    'FLORIDA 12:30PM': { horaPanama: '12:30', keywords: ['florida mediodia', 'florida midday', 'florida 1:30', 'florida dia'] },
    'FLORIDA NOCHE': { horaPanama: '20:45', keywords: ['florida noche', 'florida evening', 'florida 9:45'] },
    'FLORIDA 8:45PM': { horaPanama: '20:45', keywords: ['florida noche', 'florida evening', 'florida 9:45'] },

    // --- NEW YORK ---
    'NEW YORK DIA': { horaPanama: '13:30', keywords: ['new york mediodia', 'new york midday', 'new york 2:30', 'new york dia'] },
    'NEW YORK 1:30PM': { horaPanama: '13:30', keywords: ['new york mediodia', 'new york midday', 'new york 2:30', 'new york dia'] },
    'NEW YORK NOCHE': { horaPanama: '21:30', keywords: ['new york noche', 'new york evening', 'new york 10:30'] },
    'NEW YORK 9:30PM': { horaPanama: '21:30', keywords: ['new york noche', 'new york evening', 'new york 10:30'] }
};

function getFechaPanama() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
}

function yaJugoEnPanama(horaSorteoStr) {
    const ahoraStr = new Date().toLocaleTimeString('en-US', { timeZone: 'America/Panama', hour12: false });
    const [hAhora, mAhora] = ahoraStr.split(':').map(Number);
    const [hSorteo, mSorteo] = horaSorteoStr.split(':').map(Number);

    const minutosActuales = hAhora * 60 + mAhora;
    const minutosSorteo = hSorteo * 60 + mSorteo;

    return minutosActuales >= minutosSorteo;
}

export default async function handler(req, res) {
    try {
        // La sincronización automática WEB solo debe actuar sobre la fecha actual de Panamá
        const fechaProcesar = getFechaPanama();

        const { data: sorteos, error: errSorteos } = await supabase
            .from('sorteos')
            .select('id, nombre');

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

        for (const sorteo of sorteos) {
            const nombreBD = sorteo.nombre.trim().toUpperCase();
            const config = CONFIG_SORTEOS[nombreBD];

            // Si el sorteo aún no ha jugado hoy en Panamá, se ignora
            if (config && !yaJugoEnPanama(config.horaPanama)) {
                continue;
            }

            const keywords = config ? config.keywords : [nombreBD.toLowerCase()];
            const resultadoEncontrado = buscarResultadoEnHtml(htmlCompleto, keywords);

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
            }
        }

        if (resultadosAInsertar.length === 0) {
            return res.status(200).json({
                success: true,
                message: `No hay sorteos pendientes para sincronizar en la fecha ${fechaProcesar}.`
            });
        }

        const { error: upsertError } = await supabase
            .from('resultados')
            .upsert(resultadosAInsertar, { onConflict: 'sorteo_id,fecha' });

        if (upsertError) throw upsertError;

        return res.status(200).json({
            success: true,
            message: `Sincronizados ${resultadosAInsertar.length} sorteo(s) para la fecha ${fechaProcesar}.`,
            data: resultadosAInsertar
        });

    } catch (error) {
        console.error('Error en sync-results:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

function buscarResultadoEnHtml(html, keywords) {
    if (!html) return null;
    const htmlLower = html.toLowerCase();

    for (const kw of keywords) {
        const pos = htmlLower.indexOf(kw.toLowerCase());
        if (pos !== -1) {
            const fragmento = html.substring(pos, pos + 350);
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