// Importar scripts de compatibilidad de Firebase v10
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.13.0/firebase-messaging-compat.js');

// Inicializar la app de Firebase dentro del Service Worker
firebase.initializeApp({
  apiKey: "AIzaSyAm-A8CYSFuUZOMAxNNgsuJsj3nhQenjl8",
  authDomain: "authcrmjdl.firebaseapp.com",
  projectId: "authcrmjdl",
  storageBucket: "authcrmjdl.firebasestorage.app",
  messagingSenderId: "683671559515",
  appId: "1:683671559515:web:2ba6c92fea2019b280ce7e"
});

const messaging = firebase.messaging();

// Listener para mensajes en segundo plano (Background)
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Mensaje recibido en segundo plano:', payload);
  
  const notificationTitle = payload.notification.title || 'Nueva notificación';
  const notificationOptions = {
    body: payload.notification.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
