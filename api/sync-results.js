import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ruruabsbkvfbudnqkjby.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  try {
    const { data: sorteos, error: errSorteos } = await supabase.from('sorteos').select('id, nombre');
    if (errSorteos || !sorteos) throw new Error('No se pudieron obtener los sorteos.');

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    };

    const [resMain, resAnguilla] = await Promise.all([
      fetch('https://enloteria.com/', { headers }).then(r => r.ok ? r.text() : '').catch(() => ''),
      fetch('https://enloteria.com/resultados-anguilla', { headers }).then(r => r.ok ? r.text() : '').catch(() => '')
    ]);

    const hallados = [];
    if (resMain) hallados.push(...extraerPremios(resMain, sorteos));
    if (resAnguilla) hallados.push(...extraerPremios(resAnguilla, sorteos));

    if (hallados.length === 0) {
      return res.status(200).json({ success: true, message: 'No hay nuevos números publicados.' });
    }

    const hoyPanama = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Panama' });
    let guardados = 0;

    for (const item of hallados) {
      const payload = {
        sorteo_id: item.sorteo_id,
        fecha: hoyPanama,
        primero: item.primero,
        segundo: item.segundo,
        tercero: item.tercero,
        p1: item.primero,
        p2: item.segundo,
        p3: item.tercero,
        updated_at: new Date().toISOString()
      };

      const { error: upsertErr } = await supabase.from('resultados').upsert(payload, { onConflict: 'sorteo_id,fecha' });
      if (!upsertErr) guardados++;
    }

    return res.status(200).json({
      success: true,
      message: `Sincronizados ${guardados} sorteos para la fecha ${hoyPanama}.`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error en sync API:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

function extraerPremios(html, listaSorteos) {
  const hallados = [];
  for (const sorteo of listaSorteos) {
    if (!sorteo.nombre) continue;
    const nombreNorm = sorteo.nombre.toLowerCase();

    if (html.toLowerCase().includes(nombreNorm)) {
      const regex = new RegExp(`${nombreNorm}[\\s\\S]{1,300}?(\\d{2})[\\s\\-]{1,5}(\\d{2})[\\s\\-]{1,5}(\\d{2})`, 'i');
      const match = html.match(regex);
      if (match) {
        hallados.push({
          sorteo_id: sorteo.id,
          primero: match[1],
          segundo: match[2],
          tercero: match[3]
        });
      }
    }
  }
  return hallados;
}