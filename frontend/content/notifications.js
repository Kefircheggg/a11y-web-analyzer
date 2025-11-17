/**
 * Модуль для отображения уведомлений на странице
 */

/**
 * Показывает уведомление на странице
 * @param {string} message - текст сообщения
 */
function showNotification(message) {
  const existingNotif = document.getElementById('axe-highlight-notification');
  if (existingNotif) {
    existingNotif.remove();
  }
  
  const notification = document.createElement('div');
  notification.id = 'axe-highlight-notification';
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #667eea;
    color: white;
    padding: 16px 24px;
    border-radius: 8px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 9999999;
    animation: slideIn 0.3s ease-out;
  `;
  
  // Добавляем анимацию
  injectNotificationStyles();
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * Инжектит стили для анимации уведомлений
 */
function injectNotificationStyles() {
  if (document.getElementById('axe-notification-styles')) {
    return;
  }
  
  const style = document.createElement('style');
  style.id = 'axe-notification-styles';
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
  `;
  document.head.appendChild(style);
}
