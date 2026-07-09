const { Client } = require('ssh2');

const pm2Path = '/root/.nvm/versions/node/v24.16.0/bin/pm2';

const conn = new Client();
conn.on('ready', () => {
  console.log('⚡ Conectado al VPS. Reiniciando bodega-app en PM2...');

  const commands = [
    'export PATH=$PATH:/root/.nvm/versions/node/v24.16.0/bin',
    `${pm2Path} restart bodega-app`
  ];

  const fullCommand = commands.join(' && ');

  conn.exec(fullCommand, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code) => {
      console.log(`\n🎉 PM2 reiniciado correctamente con código ${code}.`);
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
  readyTimeout: 60000
});
