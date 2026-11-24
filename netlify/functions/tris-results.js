
// Netlify Function: consulta los resultados TRIS.
const SOURCE = 'https://www.loterianacional.gob.mx/Tris/Resultados';
const ORDER = ['Mediodía', 'De las 3', 'Extra', 'De las 7', 'Clásico'];
const ANCHOR_DRAW = 36968;

function clean(value) {
  return String(value || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ').trim();
}

function drawForNumber(number) {
  const offset = ((Number(number) - ANCHOR_DRAW) % 5 + 5) % 5;
  return ORDER[offset];
}

function parseRows(html) {
  const found = new Map();
  const rows = html.match(/<tr\b[^>]*>[\s\S]*?<\/tr>/gi) || [];

  for (const row of rows) {
    const cells = (row.match(/<t[dh]\b[^>]*>[\s\S]*?<\/t[dh]>/gi) || []).map(clean);
    if (cells.length < 3) continue;

    const drawIndex = cells.findIndex(v => /^\d{4,6}$/.test(v));
    const number = drawIndex >= 0 ? cells[drawIndex] : '';
    if (!number || Number(number) < 30000) continue;

    const value = cells.slice(drawIndex + 1)
      .map(v => v.replace(/[\s–—-]/g, ''))
      .find(v => /^\d{5}$/.test(v));

    if (!value) continue;

    const date = cells.find(v => /^\d{1,2}[/-]\d{1,2}[/-]\d{4}$/.test(v)) || '';
    const draw = drawForNumber(number);
    const multiplier = cells.find(v => /^(si|sí|no)$/i.test(v)) || '';

    found.set(number, {
      gameId: 'tris',
      draw,
      drawNo: number,
      value,
      date,
      multiplier
    });
  }

  return [...found.values()]
    .sort((a, b) => Number(a.drawNo) - Number(b.drawNo))
    .slice(-20);
}

exports.handler = async function () {
  try {
    const response = await fetch(SOURCE, {
      headers: {
        'User-Agent': 'NUMERIQ-AI/1.8.1 (results sync)',
        'Accept': 'text/html'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Lotería Nacional respondió ${response.status}`);
    }

    const html = await response.text();
    const results = parseRows(html);

    if (!results.length) {
      throw new Error('Cambió el formato de la página oficial o aún no publica resultados.');
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify({
        ok: true,
        source: SOURCE,
        updatedAt: new Date().toISOString(),
        results
      })
    };
  } catch (error) {
    return {
      statusCode: 502,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store'
      },
      body: JSON.stringify({
        ok: false,
        error: error.message || 'No fue posible consultar la fuente oficial.'
      })
    };
  }
};
