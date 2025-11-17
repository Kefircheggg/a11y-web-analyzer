/**
 * Модуль для подсветки элементов с проблемами доступности
 */

let highlightedElements = [];

/**
 * Создает оверлей для выделения элемента
 * @param {HTMLElement} element - элемент для подсветки
 * @param {Object} violation - информация о нарушении
 * @param {number} violationIndex - индекс нарушения
 * @param {number} nodeIndex - индекс узла
 * @returns {HTMLElement} созданный оверлей
 */
function createOverlay(element, violation, violationIndex, nodeIndex) {
  const rect = element.getBoundingClientRect();
  const overlay = document.createElement('div');
  
  overlay.className = 'axe-highlight-overlay';
  overlay.dataset.violationId = `${violationIndex}-${nodeIndex}`;
  
  const impactColors = getImpactColors();
  const color = impactColors[violation.impact] || impactColors.moderate;
  
  // Создаем полупрозрачную версию цвета для фона
  const bgColor = color.replace('#', 'rgba(')
    .replace(/(..)(..)(..)/, (_, r, g, b) => {
      return `${parseInt(r, 16)}, ${parseInt(g, 16)}, ${parseInt(b, 16)}, 0.4)`;
    });
  
  overlay.style.cssText = `
    position: absolute;
    top: ${rect.top + window.scrollY}px;
    left: ${rect.left + window.scrollX}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    background-color: ${bgColor};
    border: 2px solid ${color};
    pointer-events: auto;
    z-index: 999998;
    box-sizing: border-box;
  `;
  
  return overlay;
}

/**
 * Подсвечивает все нарушения на странице
 * @param {Array} violations - список нарушений
 * @param {Object} backendIssuesMap - карта проблем от backend
 */
function highlightViolations(violations, backendIssuesMap = {}) {
  console.log('Starting highlight for', violations.length, 'violation types');
  removeHighlights();
  
  let totalHighlighted = 0;
  
  violations.forEach((violation, violationIndex) => {
    violation.nodes.forEach((node, nodeIndex) => {
      node.target.forEach(selector => {
        try {
          // Нормализуем селектор
          if (Array.isArray(selector)) {
            selector = selector[0];
          }
          
          const elements = document.querySelectorAll(selector);
          console.log(`Selector "${selector}" found ${elements.length} elements`);
          
          elements.forEach(element => {
            // Создаем оверлей
            const overlay = createOverlay(element, violation, violationIndex, nodeIndex);
            document.body.appendChild(overlay);
            highlightedElements.push(overlay);
            
            // Создаем тултип
            const tooltip = createTooltip(violation, element, null, backendIssuesMap);
            document.body.appendChild(tooltip);
            highlightedElements.push(tooltip);
            
            positionTooltip(tooltip, element);
            
            totalHighlighted++;
          });
        } catch (error) {
          console.error('Failed to highlight element:', selector, error);
        }
      });
    });
  });
  
  console.log(`Total highlighted elements: ${totalHighlighted}`);

  if (totalHighlighted > 0) {
    showNotification(`Подсвечено элементов с проблемами: ${totalHighlighted}`);
  } else {
    showNotification('Элементы для подсветки не найдены');
  }
}

/**
 * Подсвечивает одну конкретную проблему
 * @param {Array} violations - список нарушений
 * @param {number} globalIssueIndex - глобальный индекс проблемы
 * @param {Object} backendIssuesMap - карта проблем от backend
 */
function highlightSingleIssue(violations, globalIssueIndex, backendIssuesMap = {}) {
  console.log('Highlighting single issue with global index:', globalIssueIndex);
  removeHighlights(); 
  
  let currentIndex = 0;
  let found = false;
  
  for (let violationIndex = 0; violationIndex < violations.length && !found; violationIndex++) {
    const violation = violations[violationIndex];
    
    for (let nodeIndex = 0; nodeIndex < violation.nodes.length && !found; nodeIndex++) {
      const node = violation.nodes[nodeIndex];
      
      for (let selectorIndex = 0; selectorIndex < node.target.length && !found; selectorIndex++) {
        if (currentIndex === globalIssueIndex) {
          found = true;
          const selector = Array.isArray(node.target[selectorIndex]) 
            ? node.target[selectorIndex][0] 
            : node.target[selectorIndex];
          
          try {
            const elements = document.querySelectorAll(selector);
            console.log(`Found ${elements.length} elements for issue #${globalIssueIndex + 1}`);
            
            elements.forEach(element => {
              const overlay = createOverlay(element, violation, violationIndex, nodeIndex);
              
              // Добавляем кнопку закрытия
              const closeBtn = createCloseButton();
              overlay.appendChild(closeBtn);
              
              document.body.appendChild(overlay);
              highlightedElements.push(overlay);
              
              // Создаем тултип с номером проблемы
              const tooltip = createTooltip(violation, element, globalIssueIndex + 1, backendIssuesMap);
              document.body.appendChild(tooltip);
              highlightedElements.push(tooltip);
              
              positionTooltip(tooltip, element);
              
              // Прокручиваем к элементу
              element.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center',
                inline: 'center'
              });
            });
            
            showNotification(`Проблема #${globalIssueIndex + 1}`);
          } catch (error) {
            console.error('Failed to highlight element:', selector, error);
          }
        }
        currentIndex++;
      }
    }
  }
  
  if (!found) {
    console.warn('Issue not found:', globalIssueIndex);
    showNotification('Проблема не найдена на странице');
  }
}

/**
 * Создает кнопку закрытия подсветки
 * @returns {HTMLElement} кнопка
 */
function createCloseButton() {
  const closeBtn = document.createElement('button');
  closeBtn.className = 'axe-close-btn';
  closeBtn.innerHTML = '✕';
  closeBtn.style.cssText = `
    position: absolute;
    top: -12px;
    right: -12px;
    background: #ef4444;
    color: white;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 700;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    cursor: pointer;
    z-index: 1000001;
    transition: all 0.2s;
    pointer-events: auto;
  `;
  
  closeBtn.onmouseover = () => {
    closeBtn.style.background = '#dc2626';
    closeBtn.style.transform = 'scale(1.1)';
  };
  
  closeBtn.onmouseout = () => {
    closeBtn.style.background = '#ef4444';
    closeBtn.style.transform = 'scale(1)';
  };
  
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    e.preventDefault();
    removeHighlights();
    showNotification('Подсветка выключена');
  };
  
  return closeBtn;
}

/**
 * Удаляет все подсветки с страницы
 */
function removeHighlights() {
  highlightedElements.forEach(element => {
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  });
  highlightedElements = [];
}

/**
 * Возвращает карту цветов для разных уровней важности
 * @returns {Object}
 */
function getImpactColors() {
  return {
    critical: '#DC2626',
    serious: '#F59E0B',
    moderate: '#FBBF24',
    minor: '#3B82F6'
  };
}
