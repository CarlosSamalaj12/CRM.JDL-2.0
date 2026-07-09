const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');

const localPath = 'C:\\Users\\kevin\\Documents\\WEB25\\JDL\\Bodega';
const remotePath = '/var/www/Bodega';

const ignoreList = [
  'node_modules',
  '.git',
  '.env',
  '.vscode',
  '.codegraph',
  'server_runtime.log'
];

function getFilesRecursive(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    if (ignoreList.includes(file)) return;
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFilesRecursive(fullPath));
    } else {
      results.push(fullPath);
    }
  });
  return results;
}

console.log('📦 Escaneando archivos locales...');
const filesToUpload = getFilesRecursive(localPath);
console.log(`🔍 Encontrados ${filesToUpload.length} archivos para subir.`);

const conn = new Client();
conn.on('ready', () => {
  console.log('⚡ Conectado al VPS por SSH. Iniciando SFTP...');
  conn.sftp((err, sftp) => {
    if (err) throw err;

    // Crear la estructura de carpetas remotas requerida antes de subir los archivos
    console.log('📂 Limpiando y creando carpeta base en el VPS...');
    
    conn.exec(`rm -rf ${remotePath} && mkdir -p ${remotePath}`, (err, stream) => {
      if (err) throw err;
      stream.on('close', async () => {
        
        let uploadedCount = 0;

        async function uploadFile(index) {
          if (index >= filesToUpload.length) {
            console.log('\n✅ Todos los archivos subidos exitosamente por SFTP.');
            configureVPS();
            return;
          }

          const localFilePath = filesToUpload[index];
          const relativePath = path.relative(localPath, localFilePath).replace(/\\/g, '/');
          const remoteFilePath = `${remotePath}/${relativePath}`;
          const remoteDir = path.dirname(remoteFilePath);

          // Asegurar que exista la carpeta remota para este archivo
          await new Promise((resolve) => {
            conn.exec(`mkdir -p ${remoteDir}`, (err, stream) => {
              if (err) resolve();
              else stream.on('close', resolve);
            });
          });

          // Subir archivo
          sftp.fastPut(localFilePath, remoteFilePath, (err) => {
            if (err) {
              console.error(`❌ Error al subir: ${relativePath}`, err);
            } else {
              uploadedCount++;
              process.stdout.write(`\r📤 Progreso: ${uploadedCount}/${filesToUpload.length} archivos subidos`);
            }
            uploadFile(index + 1);
          });
        }

        uploadFile(0);
      }).on('data', () => {}).stderr.on('data', () => {});
    });
  });
}).connect({
  host: '2.25.166.211',
  port: 22,
  username: 'root',
  password: '&Za&6uaK#OdYri',
  readyTimeout: 60000
});

function configureVPS() {
  console.log('\n⚙️ Iniciando configuración y aprovisionamiento en el VPS...');

  // 1. Crear base de datos bodega_hotel
  // 2. Escribir el .env de producción
  // 3. npm install
  // 4. Configurar PM2 en puerto 3003
  // 5. Configurar Nginx y Let's Encrypt SSL
  const envContent = [
    'HOST=127.0.0.1',
    'PORT=3003',
    'DB_HOST=127.0.0.1',
    'DB_PORT=3307',
    'DB_USER=root',
    'DB_PASS=2022',
    'DB_NAME=bodega_hotel',
    'JWT_SECRET="JDL_bodega_2026_!s3cr3t#xP9vQ2mL7"',
    'ALLOWED_ORIGINS=https://bodega.appjardinesdellago.tech,http://localhost:3003'
  ].join('\\n');

  const nginxConfig = [
    'server {',
    '    listen 80;',
    '    server_name bodega.appjardinesdellago.tech;',
    '    return 301 https://$host$request_uri;',
    '}',
    '',
    'server {',
    '    listen 443 ssl;',
    '    server_name bodega.appjardinesdellago.tech;',
    '',
    '    ssl_certificate /etc/letsencrypt/live/appjardinesdellago.tech/fullchain.pem;',
    '    ssl_certificate_key /etc/letsencrypt/live/appjardinesdellago.tech/privkey.pem;',
    '',
    '    location / {',
    '        proxy_pass http://localhost:3003;',
    '        proxy_http_version 1.1;',
    '        proxy_set_header Upgrade $http_upgrade;',
    '        proxy_set_header Connection \\\'upgrade\\\';',
    '        proxy_set_header Host $host;',
    '        proxy_cache_bypass $http_upgrade;',
    '    }',
    '',
    '    location /socket.io/ {',
    '        proxy_pass http://localhost:3003;',
    '        proxy_http_version 1.1;',
    '        proxy_set_header Upgrade $http_upgrade;',
    '        proxy_set_header Connection "upgrade";',
    '        proxy_set_header Host $host;',
    '    }',
    '}'
  ].join('\\n');

  const commands = [
    // 1. Base de Datos
    'mysql -h 127.0.0.1 -P 3307 -u root -p2022 -e "CREATE DATABASE IF NOT EXISTS bodega_hotel CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"',
    
    // 2. Archivo .env
    `printf "${envContent}" > ${remotePath}/.env`,
    
    // 3. Instalar dependencias
    `cd ${remotePath} && npm install`,
    
    // 4. Registrar e iniciar en PM2
    `cd ${remotePath} && pm2 delete bodega-app || true`,
    `cd ${remotePath} && pm2 start server.js --name bodega-app`,
    'pm2 save',
    
    // 5. Configurar Nginx
    `printf "${nginxConfig}" > /etc/nginx/sites-available/bodega`,
    'ln -sf /etc/nginx/sites-available/bodega /etc/nginx/sites-enabled/bodega',
    
    // 6. Generar Certificado SSL (Nginx se reinicia tras Let\'s Encrypt)
    'certbot --nginx -d bodega.appjardinesdellago.tech --non-interactive --agree-tos -m admin@appjardinesdellago.tech || systemctl reload nginx'
  ];

  const fullCommand = commands.join(' && ');

  conn.exec(fullCommand, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      console.log(`\n🎉 Despliegue y configuración de Bodega completados en el VPS con código ${code}!`);
      conn.end();
      process.exit(code);
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}
