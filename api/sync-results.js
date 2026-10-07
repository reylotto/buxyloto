import { createClient } from '@supabase/supabase-js';

// Inicializar cliente administrativo de Supabase
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

/**
 * TABLA DE EQUIVALENCIAS HORARIAS:
 * Clave: Nombre exacto del sorteo registrado en tu base de datos (Panamá).
 * Valor: Términos de búsqueda en la página origen (República Dominicana / EE.UU.).
 */
const MAPEO_SORTEOS = {
    // --- LA PRIMERA (Panamá: 11:00 AM y 6:00 PM) ---
    'LA PRIMERA 11AM': ['la primera 12pm', 'la primera mediodia', 'primera 12pm'],
    'LA PRIMERA 11:00 AM': ['la primera 12pm', 'la primera mediodia', 'primera 12pm'],
    'LA PRIMERA 6PM': ['la primera 8pm', 'la primera noche', 'primera 8pm', 'la primera 7pm'],
    'LA PRIMERA 6:00 PM': ['la primera 8pm', 'la primera noche', 'primera 8pm', 'la primera 7pm'],

    // --- ANGUILLA (Panamá: 12:00 PM, 5:00 PM y 8:00 PM) ---
    'ANGUILLA 12PM': ['anguilla 1pm', 'anguilla 1:00 pm', 'anguilla 1 pm'],
    'ANGUILLA 12:00 PM': ['anguilla 1pm', 'anguilla 1:00 pm', 'anguilla 1 pm'],
    'ANGUILLA 5PM': ['anguilla 6pm', 'anguilla 6:00 pm', 'anguilla 6 pm'],
    'ANGUILLA 5:00 PM': ['anguilla 6pm', 'anguilla 6:00 pm', 'anguilla 6 pm'],
    'ANGUILLA 8PM': ['anguilla 9pm', 'anguilla 9:00 pm', 'anguilla 9 pm'],
    'ANGUILLA 8:00 PM': ['anguilla 9pm', 'anguilla 9:00 pm', 'anguilla 9 pm'],

    // --- FLORIDA (Panamá: 12:30 PM y 8:45 PM) ---
    'FLORIDA 12:30PM': ['florida mediodia', 'florida midday', 'florida 1:30', 'florida dia'],
    'FLORIDA DIA': ['florida mediodia', 'florida midday', 'florida 1:30', 'florida dia'],
    'FLORIDA 8:45PM': ['florida noche', 'florida evening', 'florida 9:45'],
    'FLORIDA NOCHE': ['florida noche', 'florida evening', 'florida 9:45'],

    // --- NEW YORK (Panamá: 1:30 PM y 9:30 PM) ---
    'NEW YORK 1:30PM': ['new york mediodia', 'new york midday', 'new york 2:30', 'new york dia'],
    'NEW YORK DIA': ['new york mediodia', 'new york midday', 'new york 2:30', 'new york dia'],
    'NEW YORK 9:30PM': ['new york noche', 'new york evening', 'new york 10:30'],
    'NEW YORK NOCHE': ['new york noche', 'new york evening', 'new york 10:30']
};

/**
 * Obtiene la fecha actual en la zona horaria de Panamá (YYYY-MM-DD)
 */
function getFechaPanama() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
}

export default async function handler(req, res) {
    try {
        const fechaHoy = getFechaPanama();

        // 1. Obtener la lista de sorteos registrados en Supabase
        const { data: sorteos, error: errSorteos } = await supabase
            .from('sorteos')
            .select('id, nombre');

        if (errSorteos || !sorteos || sorteos.length === 0) {
            return res.status(400).json({ success: false, message: 'No hay sorteos configurados en la base de datos.' });
        }

        // 2. Páginas de origen para extracción de datos
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

        // 3. Emparejar cada sorteo de la base de datos con los datos de la web
        for (const sorteo of sorteos) {
            const nombreBD = sorteo.nombre.trim().toUpperCase();
            
            // Buscar equivalencias configuradas o usar el mismo nombre en minúsculas
            const keywords = MAPEO_SORTEOS[nombreBD] || [nombreBD.toLowerCase()];

            const resultadoEncontrado = buscarResultadoEnHtml(htmlCompleto, keywords);

            if (resultadoEncontrado) {
                resultadosAInsertar.push({
                    sorteo_id: sorteo.id,
                    fecha: fechaHoy,
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
                message: `No se encontraron nuevos resultados para la fecha ${fechaHoy}.`
            });
        }

        // 4. Insertar o actualizar resultados en Supabase
        const { error: upsertError } = await supabase
            .from('resultados')
            .upsert(resultadosAInsertar, { onConflict: 'sorteo_id,fecha' });

        if (upsertError) throw upsertError;

        return res.status(200).json({
            success: true,
            message: `Sincronizados ${resultadosAInsertar.length} sorteo(s) para la fecha ${fechaHoy}.`,
            data: resultadosAInsertar
        });

    } catch (error) {
        console.error('Error en sync-results:', error);
        return res.status(500).json({ success: false, message: error.message });
    }
}

/**
 * Busca las secuencias de números ganadores según los nombres de la página web
 */
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