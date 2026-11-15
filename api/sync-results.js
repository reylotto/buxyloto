import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiApiKey = process.env.GEMINI_API_KEY;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function normalizar(texto) {
    return texto ? texto.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : '';
}

function limpiarHtmlATexto(html) {
    return html
        .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
        .replace(/<header[\s\S]*?<\/header>/gi, ' ')
        .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/(?:alt|title|data-number|data-num|data-ball|data-value)=["']([^"']+)["']/gi, ' $1 ')
        .replace(/<img[^>]+src=["'][^"']*?\/(\d{2})\.(?:png|jpg|jpeg|svg|webp)[^"']*["'][^>]*>/gi, ' $1 ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/gi, ' ')
        .replace(/[\u2013\u2014]/g, '-')
        .replace(/\s+/g, ' ')
        .trim();
}

function getInfoFechaPanama() {
    const ahora = new Date();
    const fechaISO = ahora.toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    const hora24 = ahora.toLocaleTimeString('en-GB', { timeZone: 'America/Panama', hour12: false });
    const horaNY24 = ahora.toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour12: false });
    const horaRD24 = ahora.toLocaleTimeString('en-GB', { timeZone: 'America/Santo_Domingo', hour12: false });
    const [anio, mes, dia] = fechaISO.split('-');
    return { fechaISO, hora24, horaNY24, horaRD24, anio, mes, dia, diaNum: String(parseInt(dia, 10)) };
}

function yaPasoHoraRealSorteo(sorteo, infoFecha) {
    const n = normalizar(sorteo.nombre);

    if (n.includes('FLORIDA')) {
        if (n.includes('12') || n.includes('1') || n.includes('DIA') || n.includes('TARDE') || n.includes('AM')) {
            return infoFecha.horaNY24 >= '13:30:00';
        }
        if (n.includes('6') || n.includes('8') || n.includes('9') || n.includes('10') || n.includes('NOCHE') || n.includes('PM')) {
            return infoFecha.horaNY24 >= '21:45:00';
        }
    }
    if (n.includes('YORK')) {
        if (n.includes('1') || n.includes('2') || n.includes('DIA') || n.includes('TARDE') || n.includes('AM')) {
            return infoFecha.horaNY24 >= '14:30:00';
        }
        if (n.includes('9') || n.includes('10') || n.includes('11') || n.includes('NOCHE') || n.includes('PM')) {
            return infoFecha.horaNY24 >= '22:30:00';
        }
    }
    if (n.includes('ANGUILLA')) {
        if (n.includes('9AM') || n.includes('10')) return infoFecha.horaRD24 >= '10:05:00';
        if (n.includes('12') || n.includes('1PM') || n.includes('TARDE')) return infoFecha.horaRD24 >= '13:05:00';
        if (n.includes('5') || n.includes('6')) return infoFecha.horaRD24 >= '18:05:00';
        if (n.includes('8') || n.includes('9PM') || n.includes('NOCHE')) return infoFecha.horaRD24 >= '21:05:00';
    }

    return !sorteo.hora_cierre || infoFecha.hora24 >= sorteo.hora_cierre;
}

async function descargarFuente(nombre, url, timeoutMs = 6500) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
                'Accept': 'text/html,text/plain,application/xhtml+xml,*/*;q=0.8',
                'Accept-Language': 'es-ES,es;q=0.9'
            }
        });
        if (!res.ok) return { nombre, texto: '', estado: `HTTP_${res.status}` };
        const raw = await res.text();
        if (!raw || raw.includes('Just a moment...')) {
            return { nombre, texto: '', estado: 'BLOQUEO_CF' };
        }
        if (url.includes('r.jina.ai')) {
            const limpioMd = raw
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
                .replace(/\n{3,}/g, '\n\n')
                .trim();
            return { nombre, texto: limpioMd, estado: 'PROXY_200' };
        }
        return { nombre, texto: limpiarHtmlATexto(raw), estado: 'HTTP_200' };
    } catch (e) {
        return { nombre, texto: '', estado: e.name === 'AbortError' ? 'TIMEOUT' : 'ERROR_RED' };
    } finally {
        clearTimeout(timer);
    }
}

async function extraerConGemini(sorteosPendientes, bloquesTexto, infoFecha) {
    if (!geminiApiKey) {
        throw new Error('Falta configurar la variable GEMINI_API_KEY en Vercel.');
    }

    const listaSorteos = sorteosPendientes.map(s => ({
        id: String(s.id),
        nombre: s.nombre
    }));

    const prompt = `Eres un extractor experto de resultados oficiales de loterías para el sistema BuxyLoto.
Fecha de hoy (hora Panamá): ${infoFecha.fechaISO} (en los portales web la fecha de hoy puede aparecer escrita como "${infoFecha.fechaISO}", "${infoFecha.dia}-${infoFecha.mes}", "${infoFecha.dia}/${infoFecha.mes}", "${infoFecha.diaNum} Nov", "Nov ${infoFecha.diaNum}" o "${infoFecha.diaNum} de noviembre").
Hora actual Panamá: ${infoFecha.hora24}, Hora RD/Anguilla: ${infoFecha.horaRD24}, Hora NY/Florida: ${infoFecha.horaNY24}.

REGLAS ESTRICTAS DE EXTRACCIÓN (SOLO PARA LA FECHA DE HOY):
1. Si un sorteo aún no ha jugado hoy o solo aparece con fecha de ayer, devuelve null en sus premios. NUNCA uses resultados de ayer ni mezcles países o turnos horarios.
2. SEPARACIÓN ESTRICTA DE FUENTES POR PAÍS (PROHIBIDO CRUZAR PAÍSES):
   - Para HONDURAS:
     * p1 (La Diaria de Honduras): léelo de LOTERIAS_HONDURAS_DIRECTO, LOTERIAS_HONDURAS_MD, KINGARROBA_HN o LOTERIAS_CR (únicamente bajo la etiqueta explícita "HONDURAS 11 AM" / "HONDURAS 3 PM" / "HONDURAS 9 PM").
     * p2 y p3 (Premia 2 de Honduras): léelos EXCLUSIVAMENTE de LOTERIAS_HONDURAS_DIRECTO, LOTERIAS_HONDURAS_P2_DIRECTO, LOTERIAS_HONDURAS_MD, KINGARROBA_HN, NACIONALLOTERIA_HN_P2 o YELU_HN_P2. Busca la fecha de hoy ("${infoFecha.dia}-${infoFecha.mes}" o "${infoFecha.diaNum} Nov") junto a "Premia 2 11:00 AM" (toma los 2 números para HONDURAS 12PM), "Premia 2 3:00 PM" (toma los 2 números para HONDURAS 4PM) y "Premia 2 9:00 PM" (toma los 2 números para HONDURAS 10PM). JAMÁS uses LOTERIAS_CR para p2/p3 de Honduras (en LOTERIAS_CR, "PREMIA2" es de Nicaragua).
     * Horarios Honduras (1 hora atrás respecto a Panamá): "HONDURAS 12PM" = sorteo 11:00 AM Honduras; "HONDURAS 4PM" = 3:00 PM Honduras; "HONDURAS 10PM" = 9:00 PM Honduras.
   - Para NICA (Nicaragua): Lee NUEVAYA_NICA y LOTERIAS_CR (etiquetas NICA / PREMIA2).
     * "NICA 12PM" = 11:00 AM Nicaragua (p1 = La Diaria 11:00 AM; p2 y p3 = los 2 números de Premia 2 11:00 AM).
     * "NICA 4PM" = 3:00 PM Nicaragua; "NICA 7PM" = 6:00 PM Nicaragua; "NICA 10PM" = 9:00 PM Nicaragua.
   - Para TICA (Costa Rica): Lee LOTERIAS_CR.
     * p1 = Tica Reventados / Nuevos Tiempos del turno; si hay 3 Monazos (3 dígitos XYZ), p2 = XY y p3 = YZ.
   - Para ANGUILLA (1 hora adelante respecto a Panamá): Lee ENLOTERIA y KINGARROBA.
     * "ANGUILLA 9AM" = Anguilla 10:00 AM (3 premios: p1, p2, p3).
     * "ANGUILLA 12PM" = Anguilla 1:00 PM (3 premios: p1, p2, p3). NUNCA uses el de las 10:00 AM ni 12:00 PM.
     * "ANGUILLA 5PM" = Anguilla 6:00 PM; "ANGUILLA 8PM" = Anguilla 9:00 PM.
   - Para LA PRIMERA / FLORIDA / NEW YORK: Lee ENLOTERIA y KINGARROBA (3 premios: 1ro, 2do, 3ro del turno).

SORTEOS A BUSCAR:
${JSON.stringify(listaSorteos)}

TEXTO EXTRAÍDO DE LOS PORTALES WEB HOY:
${bloquesTexto}`;

    const bodyPayload = JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: {
                type: 'OBJECT',
                properties: {
                    resultados: {
                        type: 'ARRAY',
                        items: {
                            type: 'OBJECT',
                            properties: {
                                id: { type: 'STRING' },
                                p1: { type: 'STRING', nullable: true },
                                p2: { type: 'STRING', nullable: true },
                                p3: { type: 'STRING', nullable: true }
                            },
                            required: ['id', 'p1', 'p2', 'p3']
                        }
                    }
                },
                required: ['resultados']
            }
        }
    });

    const modelos = ['gemini-3-flash-preview', 'gemini-2.5-flash', 'gemini-2.0-flash'];
    let ultimoError = '';

    for (const modelo of modelos) {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${geminiApiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: bodyPayload
            }
        );

        if (response.ok) {
            const data = await response.json();
            const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{"resultados":[]}';
            const parsed = JSON.parse(rawJson);
            return parsed.resultados || [];
        }
        ultimoError = `${modelo} (${response.status}): ${(await response.text()).slice(0, 140)}`;
    }

    throw new Error(`Error Gemini API: ${ultimoError}`);
}

export default async function handler(req, res) {
    const diagnostico = [];

    try {
        const infoFecha = getInfoFechaPanama();
        const { fechaISO } = infoFecha;

        const [{ data: sorteos }, { data: yaRegistrados }] = await Promise.all([
            supabase.from('sorteos').select('id, nombre, estado, hora_cierre, inquilino_id'),
            supabase.from('resultados').select('sorteo_id, p1, p2, p3, inquilino_id').eq('fecha', fechaISO)
        ]);

        if (!sorteos || sorteos.length === 0) {
            return res.status(200).json({ success: false, message: 'No hay sorteos configurados.' });
        }

        const mapaRegistrados = new Map((yaRegistrados || []).map(r => [String(r.sorteo_id), r]));
        const estaCompleto = (s) => {
            const reg = mapaRegistrados.get(String(s.id));
            return Boolean(reg && reg.p1 && reg.p2 && reg.p3);
        };

        const esSorteoManualPanama = (sorteo) => {
            const n = normalizar(sorteo.nombre);
            return /\bLNB\b|NACIONAL|DOMINICAL|MIERCOL|GORDITO|ZODIACO|PANAMA/.test(n);
        };

        const pendientes = sorteos.filter(
            s => !esSorteoManualPanama(s) && !estaCompleto(s) && yaPasoHoraRealSorteo(s, infoFecha)
        );

        if (pendientes.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'Todos los sorteos vencidos de hoy ya están completos.',
                diagnostico
            });
        }

        const nombresPend = pendientes.map(s => normalizar(s.nombre)).join(' ');
        const tareasDescarga = [];

        if (/PRIMERA|ANGUILLA|FLORIDA|YORK/.test(nombresPend)) {
            tareasDescarga.push(
                descargarFuente('ENLOTERIA', 'https://enloteria.com/'),
                descargarFuente('KINGARROBA', 'https://www.kingarrobanumeros.com/resultados')
            );
        }
        if (/TICA|NICA|HONDURAS/.test(nombresPend)) {
            tareasDescarga.push(descargarFuente('LOTERIAS_CR', 'https://loteriascostarica.com/'));
        }
        if (/NICA/.test(nombresPend)) {
            tareasDescarga.push(descargarFuente('NUEVAYA_NICA', 'https://nuevaya.com.ni/loto-diaria-de-nicaragua/'));
        }
        if (/HONDURAS/.test(nombresPend)) {
            tareasDescarga.push(
                descargarFuente('LOTERIAS_HONDURAS_DIRECTO', 'https://loteriasdehonduras.com/'),
                descargarFuente('LOTERIAS_HONDURAS_P2_DIRECTO', 'https://loteriasdehonduras.com/premia-2/'),
                descargarFuente('LOTERIAS_HONDURAS_MD', 'https://r.jina.ai/https://loteriasdehonduras.com/', 9000),
                descargarFuente('KINGARROBA_HN', 'https://www.kingarrobanumeros.com/honduras-hoy'),
                descargarFuente('NACIONALLOTERIA_HN_P2', 'https://www.nacionalloteria.com/honduras/loto-premia2.php'),
                descargarFuente('YELU_HN_P2', 'https://www.yelu.hn/lottery/results/premia-dos')
            );
        }

        const fuentes = await Promise.all(tareasDescarga);
        for (const f of fuentes) {
            diagnostico.push(`${f.nombre}: ${f.estado}`);
        }

        const bloquesTexto = fuentes
            .filter(f => f.texto)
            .map(f => `=== FUENTE: ${f.nombre} ===\n${f.texto.slice(0, 22000)}`)
            .join('\n\n');

        if (!bloquesTexto) {
            return res.status(200).json({
                success: true,
                message: 'Ningún portal web respondió contenido legible en este intento.',
                diagnostico
            });
        }

        const extraidosIA = await extraerConGemini(pendientes, bloquesTexto, infoFecha);
        const mapaIA = new Map(extraidosIA.map(item => [String(item.id), item]));

        const limpiar2Digitos = (val) => {
            if (!val) return null;
            const m = String(val).trim().match(/^\d{2}$/);
            return m ? m[0] : null;
        };

        const aInsertar = [];
        for (const sorteo of pendientes) {
            const hallado = mapaIA.get(String(sorteo.id));
            if (!hallado) continue;

            const previo = mapaRegistrados.get(String(sorteo.id));
            const p1Final = limpiar2Digitos(hallado.p1) || previo?.p1 || null;
            const p2Final = limpiar2Digitos(hallado.p2) || previo?.p2 || null;
            const p3Final = limpiar2Digitos(hallado.p3) || previo?.p3 || null;

            if (!p1Final) continue;
            if (previo && previo.p1 === p1Final && previo.p2 === p2Final && previo.p3 === p3Final) continue;

            aInsertar.push({
                sorteo_id: sorteo.id,
                inquilino_id: sorteo.inquilino_id || null,
                fecha: fechaISO,
                p1: p1Final,
                p2: p2Final,
                p3: p3Final,
                primero: p1Final,
                segundo: p2Final,
                tercero: p3Final,
                updated_at: new Date().toISOString()
            });
            diagnostico.push(`IA detectó ${sorteo.nombre}: ${p1Final}-${p2Final || '--'}-${p3Final || '--'}`);
        }

        if (aInsertar.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'Escaneo con IA completado. Sin premios nuevos disponibles todavía.',
                diagnostico
            });
        }

        const { error: errInsert } = await supabase
            .from('resultados')
            .upsert(aInsertar, { onConflict: 'sorteo_id,fecha' });

        if (errInsert) throw errInsert;

        await Promise.all(aInsertar.map(async (item) => {
            await supabase.from('sorteos').update({
                p1: item.p1,
                p2: item.p2,
                p3: item.p3,
                primer_premio: item.p1,
                segundo_premio: item.p2,
                tercer_premio: item.p3
            }).eq('id', item.sorteo_id);

            try {
                await supabase.rpc('evaluar_tickets_sorteo', {
                    p_sorteo_id: item.sorteo_id,
                    p_fecha: fechaISO
                });
            } catch {}
        }));

        return res.status(200).json({
            success: true,
            message: `Actualizados ${aInsertar.length} sorteos automáticamente con IA.`,
            data: aInsertar,
            diagnostico
        });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message, diagnostico });
    }
}