/**
 * Модуль для создания и управления тултипами
 */

/**
 * Создает тултип для элемента с проблемой
 * @param {Object} violation - информация о нарушении
 * @param {HTMLElement} element - элемент на странице
 * @param {number|null} issueNumber - номер проблемы
 * @param {Object} backendIssuesMap - карта проблем от backend
 * @returns {HTMLElement} созданный тултип
 */
function createTooltip(violation, element, issueNumber, backendIssuesMap = {}) {
  const tooltip = document.createElement('div');
  tooltip.className = 'axe-highlight-tooltip';
  
  const impactColors = getImpactColors();
  const color = impactColors[violation.impact] || impactColors.moderate;
  
  const backendIssue = backendIssuesMap[violation.id];
  const title = (backendIssue && backendIssue.title) ? backendIssue.title : violation.help;
  const description = (backendIssue && backendIssue.description) ? backendIssue.description : violation.description;
  
  tooltip.innerHTML = `
    <div style="
      background: white;
      border: 2px solid ${color};
      border-radius: 8px;
      padding: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      max-width: 300px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 13px;
      line-height: 1.4;
      z-index: 999999;
    ">
      <div style="
        font-weight: 600;
        color: ${color};
        margin-bottom: 6px;
        text-transform: uppercase;
        font-size: 11px;
      ">
        ${violation.impact.toUpperCase()}
      </div>
      <div style="color: #1f2937; font-weight: 500; margin-bottom: 4px;">
        ${escapeHtml(title)}
      </div>
      <div style="color: #6b7280; font-size: 12px;">
        ${escapeHtml(description)}
      </div>
      ${issueNumber ? `
        <div style="
          margin-top: 8px;
          padding: 4px 8px;
          background: ${color};
          color: white;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          text-align: center;
        ">
          Issue #${issueNumber}
        </div>
      ` : ''}
    </div>
  `;
  
  tooltip.style.cssText = `
    position: absolute;
    pointer-events: none;
    z-index: 999999;
  `;
  
  return tooltip;
}

/**
 * Позиционирует тултип относительно элемента
 * @param {HTMLElement} tooltip - элемент тултипа
 * @param {HTMLElement} element - целевой элемент
 */
function positionTooltip(tooltip, element) {
  const rect = element.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  let top = rect.top + window.scrollY - tooltipRect.height - 10;
  let left = rect.left + window.scrollX;
  
  // Если тултип не помещается сверху, показываем снизу
  if (top < window.scrollY) {
    top = rect.bottom + window.scrollY + 10;
  }
  
  // Если тултип выходит за правый край, сдвигаем влево
  if (left + tooltipRect.width > window.innerWidth) {
    left = window.innerWidth - tooltipRect.width - 10;
  }
  
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

/**
 * Экранирует HTML в тексте
 * @param {string} text - текст для экранирования
 * @returns {string} экранированный текст
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Возвращает цвета для разных уровней важности
 * @returns {Object} карта цветов
 */
function getImpactColors() {
  return {
    critical: '#DC2626',
    serious: '#F59E0B',
    moderate: '#FBBF24',
    minor: '#3B82F6'
  };
}
