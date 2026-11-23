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
    const fechaRDISO = ahora.toLocaleDateString('en-CA', { timeZone: 'America/Santo_Domingo' });
    const hora24 = ahora.toLocaleTimeString('en-GB', { timeZone: 'America/Panama', hour12: false });
    const horaNY24 = ahora.toLocaleTimeString('en-GB', { timeZone: 'America/New_York', hour12: false });
    const horaRD24 = ahora.toLocaleTimeString('en-GB', { timeZone: 'America/Santo_Domingo', hour12: false });
    const [anio, mes, dia] = fechaISO.split('-');
    const [, mesRD, diaRD] = fechaRDISO.split('-');
    return {
        fechaISO,
        fechaRDISO,
        hora24,
        horaNY24,
        horaRD24,
        anio,
        mes,
        dia,
        diaNum: String(parseInt(dia, 10)),
        mesRD,
        diaRD,
        diaRDNum: String(parseInt(diaRD, 10))
    };
}

function detectarTurnoAnguilla(sorteo) {
    const n = normalizar(sorteo.nombre);
    const hc = String(sorteo.hora_cierre || '');
    if (n.includes('9AM') || n.includes('9:00') || n.includes('10') || hc.startsWith('09:') || hc.startsWith('10:')) return '10AM';
    if (n.includes('12') || n.includes('1PM') || n.includes('1:00') || n.includes('DIA') || hc.startsWith('12:') || hc.startsWith('13:')) return '1PM';
    if (n.includes('5') || n.includes('6') || n.includes('TARDE') || hc.startsWith('17:') || hc.startsWith('18:')) return '6PM';
    if (n.includes('8') || n.includes('9PM') || n.includes('9:00') || n.includes('NOCHE') || hc.startsWith('20:') || hc.startsWith('21:')) return '9PM';
    return null;
}

function detectarTurnoTica(sorteo) {
    const n = normalizar(sorteo.nombre);
    const hc = String(sorteo.hora_cierre || '');
    if (n.includes('12') || n.includes('1') || n.includes('2') || n.includes('DIA') || n.includes('MEDIODIA') || hc.startsWith('12:') || hc.startsWith('13:') || hc.startsWith('14:')) return 'MEDIODIA';
    if (n.includes('4') || n.includes('5') || n.includes('TARDE') || hc.startsWith('16:') || hc.startsWith('17:')) return 'TARDE';
    if (n.includes('7') || n.includes('8') || n.includes('NOCHE') || hc.startsWith('19:') || hc.startsWith('20:')) return 'NOCHE';
    return null;
}

function yaPasoHoraRealSorteo(sorteo, infoFecha) {
    const n = normalizar(sorteo.nombre);

    if (n.includes('FLORIDA')) {
        if (n.includes('12') || n.includes('1') || n.includes('DIA') || n.includes('TARDE') || n.includes('AM')) {
            return infoFecha.horaNY24 >= '13:35:00';
        }
        if (n.includes('6') || n.includes('8') || n.includes('9') || n.includes('10') || n.includes('NOCHE') || n.includes('PM')) {
            return infoFecha.horaNY24 >= '21:50:00';
        }
    }
    if (n.includes('YORK')) {
        if (n.includes('1') || n.includes('2') || n.includes('DIA') || n.includes('TARDE') || n.includes('AM')) {
            return infoFecha.horaNY24 >= '14:35:00';
        }
        if (n.includes('9') || n.includes('10') || n.includes('11') || n.includes('NOCHE') || n.includes('PM')) {
            return infoFecha.horaNY24 >= '22:35:00';
        }
    }
    if (n.includes('ANGUILLA') || n.includes('ANGUILA')) {
        const turno = detectarTurnoAnguilla(sorteo);
        // Si en RD ya pasó medianoche (fechaRDISO > fechaISO), todos los sorteos del día anterior en Panamá ya cerraron
        if (infoFecha.fechaRDISO > infoFecha.fechaISO) return true;
        if (turno === '10AM') return infoFecha.horaRD24 >= '10:08:00';
        if (turno === '1PM') return infoFecha.horaRD24 >= '13:08:00';
        if (turno === '6PM') return infoFecha.horaRD24 >= '18:08:00';
        if (turno === '9PM') return infoFecha.horaRD24 >= '21:08:00';
    }
    if (n.includes('TICA')) {
        const turno = detectarTurnoTica(sorteo);
        if (turno === 'MEDIODIA') return infoFecha.hora24 >= '14:05:00';
        if (turno === 'TARDE') return infoFecha.hora24 >= '17:35:00';
        if (turno === 'NOCHE') return infoFecha.hora24 >= '20:35:00';
    }
    if (n.includes('NICA') || n.includes('HONDURAS')) {
        if (n.includes('12')) return infoFecha.hora24 >= '12:10:00';
        if (n.includes('4')) return infoFecha.hora24 >= '16:10:00';
        if (n.includes('7')) return infoFecha.hora24 >= '19:10:00';
        if (n.includes('10')) return infoFecha.hora24 >= '22:10:00';
    }

    return !sorteo.hora_cierre || infoFecha.hora24 >= sorteo.hora_cierre;
}

// 🔥 EXTRACTOR DETERMINÍSTICO PARA ANGUILLA (10AM, 1PM, 6PM, 9PM)
function extraerAnguillaDirecto(textoFuentes, infoFecha) {
    const resultadosAnguilla = {};
    if (!textoFuentes) return resultadosAnguilla;

    const textoUp = normalizar(textoFuentes);
    const patronesFecha = [
        `${infoFecha.dia}-${infoFecha.mes}`,
        `${infoFecha.dia}/${infoFecha.mes}`,
        `${infoFecha.diaNum}-${infoFecha.mes}`,
        `${infoFecha.diaNum}/${infoFecha.mes}`,
        `${infoFecha.diaRD}-${infoFecha.mesRD}`,
        `${infoFecha.diaRD}/${infoFecha.mesRD}`,
        infoFecha.fechaISO,
        infoFecha.fechaRDISO
    ];
    if (!patronesFecha.some(f => textoUp.includes(f))) return resultadosAnguilla;

    const patronesTurno = [
        { clave: '10AM', regex: /ANGUILL?A\s*(?:LOTTERY\s*)?(?:10:00\s*AM|10\s*AM|MANANA)[^0-9]{0,55}?(\d{2})[^0-9]{1,20}(\d{2})[^0-9]{1,20}(\d{2})/g },
        { clave: '1PM',  regex: /ANGUILL?A\s*(?:LOTTERY\s*)?(?:1:00\s*PM|13:00|1\s*PM|MEDIODIA)[^0-9]{0,55}?(\d{2})[^0-9]{1,20}(\d{2})[^0-9]{1,20}(\d{2})/g },
        { clave: '6PM',  regex: /ANGUILL?A\s*(?:LOTTERY\s*)?(?:6:00\s*PM|18:00|6\s*PM|TARDE)[^0-9]{0,55}?(\d{2})[^0-9]{1,20}(\d{2})[^0-9]{1,20}(\d{2})/g },
        { clave: '9PM',  regex: /ANGUILL?A\s*(?:LOTTERY\s*)?(?:9:00\s*PM|21:00|9\s*PM|NOCHE)[^0-9]{0,55}?(\d{2})[^0-9]{1,20}(\d{2})[^0-9]{1,20}(\d{2})/g }
    ];

    for (const pt of patronesTurno) {
        const match = pt.regex.exec(textoUp);
        if (match) {
            resultadosAnguilla[pt.clave] = { p1: match[1], p2: match[2], p3: match[3] };
        }
    }

    return resultadosAnguilla;
}

// 🔥 EXTRACTOR DETERMINÍSTICO PARA TICA (NUEVOS TIEMPOS + 3 MONAZOS POR TURNO EXACTO)
function extraerTicaDirecto(textoCR, infoFecha) {
    const resultadosTica = {};
    if (!textoCR) return resultadosTica;

    const textoUp = normalizar(textoCR);
    const tieneFechaHoy = [
        `${infoFecha.dia}-${infoFecha.mes}`,
        `${infoFecha.dia}/${infoFecha.mes}`,
        `${infoFecha.diaNum}/${infoFecha.mes}`,
        `${infoFecha.diaNum}-${infoFecha.mes}`,
        infoFecha.fechaISO
    ].some(f => textoUp.includes(f));

    if (!tieneFechaHoy) return resultadosTica;

    const turnos = [
        { clave: 'MEDIODIA', etiqueta: 'MEDIODIA' },
        { clave: 'TARDE',    etiqueta: 'TARDE' },
        { clave: 'NOCHE',    etiqueta: 'NOCHE' }
    ];

    for (const t of turnos) {
        // Buscar Nuevos Tiempos <Turno> -> 2 dígitos
        const rxNT = new RegExp(`NUEVOS\\s+TIEMPOS\\s+${t.etiqueta}[^0-9]{0,60}?(\\d{2})(?!\\d)`, 'i');
        // Buscar 3 Monazos <Turno> -> 3 dígitos exactos (XYZ -> p2=XY, p3=YZ)
        const rx3M = new RegExp(`(?:3|TRES)\\s*MONAZOS\\s+${t.etiqueta}[^0-9]{0,60}?(\\d{3})(?!\\d)`, 'i');

        const mNT = textoUp.match(rxNT);
        const m3M = textoUp.match(rx3M);

        if (mNT && m3M) {
            const tresDig = m3M[1];
            resultadosTica[t.clave] = {
                p1: mNT[1],
                p2: tresDig.slice(0, 2),
                p3: tresDig.slice(1, 3)
            };
        }
    }

    return resultadosTica;
}

async function descargarFuente(nombre, url, timeoutMs = 8000) {
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
        nombre: s.nombre,
        hora_cierre_panama: s.hora_cierre || null
    }));

    const prompt = `Eres un extractor experto de resultados oficiales de loterías para el sistema BuxyLoto.
Fecha del sorteo a buscar (hora Panamá): ${infoFecha.fechaISO} (en las webs puede figurar como "${infoFecha.fechaISO}", "${infoFecha.dia}-${infoFecha.mes}", "${infoFecha.dia}/${infoFecha.mes}", "${infoFecha.diaNum}-${infoFecha.mes}", "${infoFecha.diaNum}/${infoFecha.mes}" o "${infoFecha.diaNum} Nov").
Hora actual Panamá: ${infoFecha.hora24}, Hora RD/Anguilla: ${infoFecha.horaRD24}, Hora NY/Florida: ${infoFecha.horaNY24}.

REGLAS ESTRICTAS DE EXTRACCIÓN (PROHIBIDO INVENTAR O CRUZAR HORARIOS):
1. Verifica que los números correspondan al día ${infoFecha.dia}-${infoFecha.mes} (${infoFecha.fechaISO}). Nota: en portales de República Dominicana/Anguilla, si ya pasó la medianoche en RD (fecha RD ${infoFecha.fechaRDISO}), los sorteos de ayer en RD (${infoFecha.dia}-${infoFecha.mes}) son exactamente los que buscamos. Si el sorteo aún no ha salido, devuelve null.
2. MAPEO EXACTO POR PAÍS Y TURNO HORARIO:
   - **TICA (Costa Rica)** — Lee EXCLUSIVAMENTE LOTERIAS_CR o LOTERIAS_CR_MD:
     * "TICA DIA 2PM" / "TICA 2:30PM" / "TICA 2PM" / "TICA 12PM" -> sorteo **MEDIODÍA** (~12:55 PM CR).
     * "TICA TARDE 5:30PM" / "TICA TARDE" -> sorteo **TARDE** (~4:30 PM CR).
     * "TICA NOCHE 8:30PM" / "TICA NOCHE" -> sorteo **NOCHE** (~7:30 PM CR).
     * p1 = 2 dígitos de **Nuevos Tiempos** de ese turno exacto (ignora el número de Reventados).
     * p2 y p3 = del número de **3 dígitos** (XYZ) de **3 Monazos** de ese MISMO turno exacto: p2 = primeros dos dígitos (XY) y p3 = últimos dos dígitos (YZ). NUNCA tomes dígitos de Lotto ni Chances.
   - **ANGUILLA** — Lee CONECTATE_RD, CONECTATE_RD_MD, ENLOTERIA y KINGARROBA:
     * "ANGUILLA 9AM" / "10AM" -> **Anguilla 10:00 AM** (3 premios: 1ro, 2do, 3ro).
     * "ANGUILLA 12PM" / "1PM" -> **Anguilla 1:00 PM** (3 premios: 1ro, 2do, 3ro).
     * "ANGUILLA 5PM" / "6PM" -> **Anguilla 6:00 PM** (3 premios: 1ro, 2do, 3ro).
     * "ANGUILLA 8PM" / "9PM" -> **Anguilla 9:00 PM** (3 premios: 1ro, 2do, 3ro).
   - **HONDURAS** (-1h respecto a Panamá):
     * "HONDURAS 12PM" = 11:00 AM Honduras; "HONDURAS 4PM" = 3:00 PM Honduras; "HONDURAS 10PM" = 9:00 PM Honduras.
     * p1 = La Diaria de ese turno; p2 y p3 = los 2 números de 2 dígitos de **Premia 2** de ese MISMO turno.
   - **NICA (Nicaragua)** (-1h respecto a Panamá):
     * "NICA 12PM" = 11:00 AM Nicaragua; "NICA 4PM" = 3:00 PM Nicaragua; "NICA 7PM" = 6:00 PM Nicaragua; "NICA 10PM" = 9:00 PM Nicaragua.
     * p1 = La Diaria de ese turno; p2 y p3 = los 2 números de 2 dígitos de **Premia 2** de ese MISMO turno (léelos de NUEVAYA_NICA_MD, LOTERIAS_NICA_MD, NACIONALLOTERIA_NI_MD, KINGARROBA_NI o LOTERIAS_CR_MD).
   - **LA PRIMERA / FLORIDA / NEW YORK**: Lee CONECTATE_RD, ENLOTERIA y KINGARROBA (3 premios: 1ro, 2do, 3ro del turno exacto).

SORTEOS A BUSCAR:
${JSON.stringify(listaSorteos)}

TEXTO EXTRAÍDO DE LOS PORTALES WEB:
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

    const modelos = ['gemini-3.1-flash-lite-preview', 'gemini-3-flash-preview', 'gemini-3.1-pro-preview'];
    const errores = [];

    for (const modelo of modelos) {
        for (let intento = 0; intento < 3; intento++) {
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

            const detalle = (await response.text()).slice(0, 140);
            errores.push(`${modelo} (${response.status}): ${detalle}`);

            if ((response.status === 429 || response.status === 503) && intento < 2) {
                await new Promise(r => setTimeout(r, 2000 * (intento + 1)));
                continue;
            }
            break;
        }
    }

    throw new Error(`Error Gemini API: ${errores.join(' | ')}`);
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

        if (/PRIMERA|ANGUILLA|ANGUILA|FLORIDA|YORK/.test(nombresPend)) {
            tareasDescarga.push(
                descargarFuente('CONECTATE_RD', 'https://www.conectate.com.do/loterias/'),
                descargarFuente('CONECTATE_RD_MD', 'https://r.jina.ai/https://www.conectate.com.do/loterias/anguilla', 9000),
                descargarFuente('ENLOTERIA', 'https://enloteria.com/'),
                descargarFuente('KINGARROBA', 'https://www.kingarrobanumeros.com/resultados')
            );
        }
        if (/TICA|NICA|HONDURAS/.test(nombresPend)) {
            tareasDescarga.push(
                descargarFuente('LOTERIAS_CR', 'https://loteriascostarica.com/'),
                descargarFuente('LOTERIAS_CR_MD', 'https://r.jina.ai/https://loteriascostarica.com/', 9000)
            );
        }
        if (/NICA/.test(nombresPend)) {
            tareasDescarga.push(
                descargarFuente('NUEVAYA_NICA_MD', 'https://r.jina.ai/https://nuevaya.com.ni/loto-diaria-de-nicaragua/', 9000),
                descargarFuente('LOTERIAS_NICA_MD', 'https://r.jina.ai/https://loteriasdenicaragua.com/', 9000),
                descargarFuente('NACIONALLOTERIA_NI_MD', 'https://r.jina.ai/https://www.nacionalloteria.com/nicaragua/loto-premia2.php', 9000),
                descargarFuente('KINGARROBA_NI', 'https://www.kingarrobanumeros.com/nicaragua-hoy')
            );
        }
        if (/HONDURAS/.test(nombresPend)) {
            tareasDescarga.push(
                descargarFuente('LOTERIAS_HONDURAS_DIRECTO', 'https://loteriasdehonduras.com/'),
                descargarFuente('LOTERIAS_HONDURAS_MD', 'https://r.jina.ai/https://loteriasdehonduras.com/', 9000),
                descargarFuente('LOTERIAS_HONDURAS_P2_MD', 'https://r.jina.ai/https://loteriasdehonduras.com/premia-2/', 9000),
                descargarFuente('KINGARROBA_HN', 'https://www.kingarrobanumeros.com/honduras-hoy'),
                descargarFuente('NACIONALLOTERIA_HN_P2', 'https://www.nacionalloteria.com/honduras/loto-premia2.php')
            );
        }

        const fuentes = await Promise.all(tareasDescarga);
        for (const f of fuentes) {
            diagnostico.push(`${f.nombre}: ${f.estado}`);
        }

        // 1. Extracción determinística directa para Anguilla
        const textoFuentesAnguilla = fuentes
            .filter(f => ['CONECTATE_RD', 'CONECTATE_RD_MD', 'ENLOTERIA', 'KINGARROBA'].includes(f.nombre) && f.texto)
            .map(f => f.texto)
            .join('\n');
        const anguillaDirecto = extraerAnguillaDirecto(textoFuentesAnguilla, infoFecha);

        // 2. Extracción determinística directa para Tica (Nuevos Tiempos + 3 Monazos)
        const textoFuentesCR = fuentes
            .filter(f => ['LOTERIAS_CR', 'LOTERIAS_CR_MD'].includes(f.nombre) && f.texto)
            .map(f => f.texto)
            .join('\n');
        const ticaDirecto = extraerTicaDirecto(textoFuentesCR, infoFecha);

        const bloquesTexto = fuentes
            .filter(f => f.texto)
            .map(f => {
                const limite = /HONDURAS|NICA|LOTERIAS_CR/.test(f.nombre) ? 24000 : 15000;
                return `=== FUENTE: ${f.nombre} ===\n${f.texto.slice(0, limite)}`;
            })
            .join('\n\n');

        if (!bloquesTexto) {
            return res.status(200).json({
                success: true,
                message: 'Ningún portal web respondió contenido legible en este intento.',
                diagnostico
            });
        }

        // Filtrar los sorteos ya resueltos por los extractores determinísticos
        const pendientesParaIA = pendientes.filter(s => {
            const n = normalizar(s.nombre);
            if (n.includes('ANGUILLA') || n.includes('ANGUILA')) {
                const turno = detectarTurnoAnguilla(s);
                if (turno && anguillaDirecto[turno]) return false;
            }
            if (n.includes('TICA')) {
                const turno = detectarTurnoTica(s);
                if (turno && ticaDirecto[turno]) return false;
            }
            return true;
        });

        const extraidosIA = pendientesParaIA.length > 0
            ? await extraerConGemini(pendientesParaIA, bloquesTexto, infoFecha)
            : [];
        const mapaIA = new Map(extraidosIA.map(item => [String(item.id), item]));

        const limpiar2Digitos = (val) => {
            if (!val) return null;
            const m = String(val).trim().match(/^\d{2}$/);
            return m ? m[0] : null;
        };

        const aInsertar = [];
        for (const sorteo of pendientes) {
            const n = normalizar(sorteo.nombre);
            let hallado = null;

            if (n.includes('ANGUILLA') || n.includes('ANGUILA')) {
                const turno = detectarTurnoAnguilla(sorteo);
                if (turno && anguillaDirecto[turno]) {
                    hallado = anguillaDirecto[turno];
                }
            } else if (n.includes('TICA')) {
                const turno = detectarTurnoTica(sorteo);
                if (turno && ticaDirecto[turno]) {
                    hallado = ticaDirecto[turno];
                }
            }

            if (!hallado) {
                hallado = mapaIA.get(String(sorteo.id));
            }
            if (!hallado) continue;

            const previo = mapaRegistrados.get(String(sorteo.id));
            const p1Final = limpiar2Digitos(hallado.p1) || previo?.p1 || null;
            const p2Final = limpiar2Digitos(hallado.p2) || previo?.p2 || null;
            const p3Final = limpiar2Digitos(hallado.p3) || previo?.p3 || null;

            if (!p1Final) continue;

            // Exigir 3 premios completos antes de guardar y escrutar
            if (!p2Final || !p3Final) {
                diagnostico.push(`⏳ Esperando 3 premios completos para ${sorteo.nombre} (actual: ${p1Final}-${p2Final || '--'}-${p3Final || '--'})`);
                continue;
            }

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
            diagnostico.push(`✅ Detectado ${sorteo.nombre}: ${p1Final}-${p2Final}-${p3Final}`);
        }

        if (aInsertar.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'Escaneo completado. Esperando resultados completos.',
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
            message: `Actualizados ${aInsertar.length} sorteos automáticamente.`,
            data: aInsertar,
            diagnostico
        });

    } catch (error) {
        if (String(error.message).includes('429') || String(error.message).includes('503')) {
            return res.status(200).json({
                success: true,
                message: 'Servidores de IA ocupados temporalmente. Se reintentará automáticamente en el próximo ciclo.',
                diagnostico
            });
        }
        return res.status(500).json({ success: false, message: error.message, diagnostico });
    }
}