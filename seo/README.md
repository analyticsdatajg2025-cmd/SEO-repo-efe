# Panel SEO de Tiendas EFE (Search Console)

Clics, impresiones, CTR y posición media de `https://www.efe.com.pe/`, con tablas de consultas, páginas,
dispositivos y países para 7 días, 28 días, 90 días y 12 meses. Cada cifra se compara con el período anterior de igual duración.

## Actualizar

    node seo/gsc.js ruta/a/la-clave.json

Escribe `seo/datos.js`. Después se abre `seo/index.html` con doble clic; no hace falta servidor ni instalar nada (Node 18 o más).

- Cuenta de servicio: `seo-ai-bot@seo-grupo-efe-api.iam.gserviceaccount.com`. Ya tiene acceso a la propiedad
  `https://www.efe.com.pe/` en Search Console.
- Otra propiedad: `GSC_SITE="sc-domain:efe.com.pe" node seo/gsc.js clave.json`.
- En vez de pasar la ruta, la clave también puede ir en la variable `GSC_CREDENTIALS` con el JSON completo.

**El repo es público:** `seo/datos.js` y la clave están en `.gitignore`. No los subas, ni tampoco los muevas a `docs/`, porque
todo lo que está en `docs/` queda publicado en GitHub Pages.
