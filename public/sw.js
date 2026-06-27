// Service Worker for Push Notifications

self.addEventListener('push', (event) => {
  const data = event.data?.json() || { title: 'New Notification', body: '' };
  
  const options = {
    body: data.body,
    icon: '/edutrack-icon-192.png', // Add this image later
    badge: '/edutrack-icon-72.png', // Add this image later
    vibrate: [200, 100, 200],
    tag: data.tag || 'edutrack-notification',
    data: {
      url: data.url || '/',
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

console.log('Edutrack Service Worker loaded');
