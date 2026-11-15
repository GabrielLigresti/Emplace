// Los tests no dependen del .env local: dotenv no pisa variables ya definidas,
// así que un TRUST_PROXY o WEB_DIST cargado para probar la build no los cambia.
process.env.TRUST_PROXY = 'loopback';
process.env.WEB_DIST = '';
