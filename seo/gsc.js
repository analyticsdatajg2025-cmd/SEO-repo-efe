// Baja de Google Search Console los clics, impresiones, CTR y posición de efe.com.pe y los deja en
// seo/datos.js, que es lo que lee el panel seo/index.html (se abre con doble clic, sin servidor).
//
// Credencial: la cuenta de servicio seo-ai-bot@seo-grupo-efe-api.iam.gserviceaccount.com.
//   - En Actions: el secreto GSC_CREDENTIALS con el JSON completo de la clave.
//   - En una PC:  node seo/gsc.js ruta/a/la-clave.json
// La clave NUNCA se sube al repo (.gitignore la cubre).
//
// Antes de la primera corrida, en Search Console > Configuración > Usuarios y permisos de la
// propiedad de efe.com.pe: Añadir usuario → el correo de la cuenta de servicio, permiso Restringido.
// Sin eso Google responde 403 aunque la clave sea buena.
//
// Propiedad: GSC_SITE (p. ej. «sc-domain:efe.com.pe» o «https://www.efe.com.pe/»). Si no se da, se
// usa la primera que la cuenta vea con efe.com.pe (prefiere la de dominio).
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const API = 'https://searchconsole.googleapis.com/webmasters/v3';
const SALIDA = path.join(__dirname, 'datos.js');
const VENTANAS = [7, 28, 90, 365];   // días; las mismas que ofrece el panel
const FILAS = 250;                   // filas por tabla (consultas y páginas)

function credencial() {
  const archivo = process.argv[2];
  const texto = archivo ? fs.readFileSync(archivo, 'utf8') : process.env.GSC_CREDENTIALS;
  if (!texto) throw new Error('Falta la clave: pasá la ruta del JSON o definí GSC_CREDENTIALS');
  return JSON.parse(texto);
}

// Token OAuth con un JWT firmado por la cuenta de servicio (sin dependencias).
async function token(c) {
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const ahora = Math.floor(Date.now() / 1000);
  const cuerpo = b64({ alg: 'RS256', typ: 'JWT' }) + '.' + b64({
    iss: c.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: c.token_uri, iat: ahora, exp: ahora + 3600,
  });
  const firma = crypto.sign('RSA-SHA256', Buffer.from(cuerpo), c.private_key).toString('base64url');
  const r = await fetch(c.token_uri, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: cuerpo + '.' + firma }),
  });
  const j = await r.json();
  if (!j.access_token) throw new Error('Google no dio token: ' + JSON.stringify(j));
  return j.access_token;
}

async function pedir(tk, ruta, cuerpo) {
  const r = await fetch(API + ruta, {
    method: cuerpo ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer ' + tk, 'Content-Type': 'application/json' },
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error(`${r.status} en ${ruta}: ${j.error && j.error.message || JSON.stringify(j)}`);
  return j;
}

async function elegirSitio(tk) {
  if (process.env.GSC_SITE) return process.env.GSC_SITE;
  const { siteEntry = [] } = await pedir(tk, '/sites');
  const efe = siteEntry.filter(s => /(^|[.:/])efe\.com\.pe/.test(s.siteUrl) && s.permissionLevel !== 'siteUnverifiedUser');
  if (!efe.length) {
    throw new Error('La cuenta de servicio no ve ninguna propiedad de efe.com.pe. Agregala como usuario en Search Console. ' +
      'Ve: ' + (siteEntry.map(s => s.siteUrl).join(', ') || 'ninguna'));
  }
  efe.sort((a, b) => b.siteUrl.startsWith('sc-domain:') - a.siteUrl.startsWith('sc-domain:'));
  return efe[0].siteUrl;
}

const dia = (d, n = 0) => new Date(d.getTime() + n * 864e5).toISOString().slice(0, 10);
const redondo = f => ({
  clics: f.clicks, impresiones: f.impressions,
  ctr: Math.round(f.ctr * 10000) / 10000, posicion: Math.round(f.position * 10) / 10,
});

async function main() {
  const c = credencial();
  const tk = await token(c);
  const sitio = await elegirSitio(tk);
  const ruta = '/sites/' + encodeURIComponent(sitio) + '/searchAnalytics/query';
  const consulta = (desde, hasta, dimensions, rowLimit) =>
    pedir(tk, ruta, { startDate: desde, endDate: hasta, dimensions, rowLimit, dataState: 'final' }).then(j => j.rows || []);

  // Serie diaria de 16 meses (lo máximo que guarda Search Console); el último día con datos manda.
  const hoy = new Date();
  const diario = (await consulta(dia(hoy, -486), dia(hoy), ['date'], 25000))
    .map(f => ({ fecha: f.keys[0], ...redondo(f) }));
  if (!diario.length) throw new Error('Search Console no devolvió datos para ' + sitio);
  const fin = new Date(diario[diario.length - 1].fecha + 'T00:00:00Z');

  const tablas = {};
  for (const n of VENTANAS) {
    const desde = dia(fin, -(n - 1)), hasta = dia(fin);
    const [consultas, paginas, dispositivos, paises] = await Promise.all([
      consulta(desde, hasta, ['query'], FILAS),
      consulta(desde, hasta, ['page'], FILAS),
      consulta(desde, hasta, ['device'], 10),
      consulta(desde, hasta, ['country'], 15),
    ]);
    const filas = rs => rs.map(f => ({ clave: f.keys[0], ...redondo(f) }));
    tablas[n] = { desde, hasta, consultas: filas(consultas), paginas: filas(paginas), dispositivos: filas(dispositivos), paises: filas(paises) };
    console.log(`${n} días (${desde} → ${hasta}): ${consultas.length} consultas, ${paginas.length} páginas`);
  }

  const datos = { sitio, generado: new Date().toISOString(), diario, tablas };
  fs.writeFileSync(SALIDA, '// Lo escribe seo/gsc.js; no editar a mano.\nwindow.GSC_DATOS = ' + JSON.stringify(datos) + ';\n');
  console.log(`Listo: ${sitio}, ${diario.length} días hasta ${dia(fin)} → ${path.relative(process.cwd(), SALIDA)}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
