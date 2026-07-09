const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  console.log('⚡ Conexión SSH al VPS para verificar el directorio de Bodega.');

  const commands = [
    'ls -la /var/www/Bodega || ls -la /var/www/'
  ];

  const fullCommand = commands.join(' && ');

  conn.exec(fullCommand, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
      process.exit(code);
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).connect({
  host: '2.25.166.211',
  port: 22,
  username: 'root',
  password: '&Za&6uaK#OdYri',
  readyTimeout: 30000
});
