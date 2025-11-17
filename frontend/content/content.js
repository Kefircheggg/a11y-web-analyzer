// content script для подсветки элементов с проблемами
let isHighlightEnabled = false;
let highlightedElements = [];
let backendIssuesMap = {};

console.log('Content script loaded for highlighting');

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Content script received message:', message.action);
  
  if (message.action === 'toggleHighlight') {
    isHighlightEnabled = message.enabled;
    
    if (message.backendReport && message.backendReport.issues_by_impact) {
      backendIssuesMap = {};
      Object.values(message.backendReport.issues_by_impact).flat().forEach(issue => {
        backendIssuesMap[issue.id] = issue;
      });
    }
    
    if (isHighlightEnabled) {
      console.log('Enabling highlights for', message.violations.length, 'violations');
      highlightViolations(message.violations);
      window.lastViolations = message.violations;
    } else {
      console.log('Disabling highlights');
      removeHighlights();
    }
    
    sendResponse({ success: true });
  } else if (message.action === 'showSingleIssue') {
    console.log('Showing single issue:', message.issueIndex);
    
    if (message.backendReport && message.backendReport.issues_by_impact) {
      backendIssuesMap = {};
      Object.values(message.backendReport.issues_by_impact).flat().forEach(issue => {
        backendIssuesMap[issue.id] = issue;
      });
    }
    
    highlightSingleIssue(message.violations, message.issueIndex);
    window.lastViolations = message.violations;
    sendResponse({ success: true });
  } else if (message.action === 'storeViolations') {
    window.lastViolations = message.violations;
    
    if (message.backendReport && message.backendReport.issues_by_impact) {
      backendIssuesMap = {};
      Object.values(message.backendReport.issues_by_impact).flat().forEach(issue => {
        backendIssuesMap[issue.id] = issue;
      });
    }
    
    sendResponse({ success: true });
  } else if (message.action === 'clearHighlights') {
    console.log('Clearing all highlights');
    removeHighlights();
    isHighlightEnabled = false;
    sendResponse({ success: true });
  }
  
  return true;
});

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
  const style = document.createElement('style');
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
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideIn 0.3s ease-out reverse';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function highlightViolations(violations) {
  console.log('Starting highlight for', violations.length, 'violation types');
  removeHighlights();
  
  let totalHighlighted = 0;
  
  violations.forEach((violation, violationIndex) => {
    violation.nodes.forEach((node, nodeIndex) => {
      node.target.forEach(selector => {
        try {
          let elements;
          
          if (Array.isArray(selector)) {
            selector = selector[0];
          }
          
          elements = document.querySelectorAll(selector);
          
          console.log(`Selector "${selector}" found ${elements.length} elements`);
          
          elements.forEach(element => {
            const overlay = createOverlay(element, violation, violationIndex, nodeIndex);
            document.body.appendChild(overlay);
            highlightedElements.push(overlay);
            
            const tooltip = createTooltip(violation, element, null);
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

function createOverlay(element, violation, violationIndex, nodeIndex) {
  const rect = element.getBoundingClientRect();
  const overlay = document.createElement('div');
  
  overlay.className = 'axe-highlight-overlay';
  overlay.dataset.violationId = `${violationIndex}-${nodeIndex}`;
  
  const impactColors = {
    critical: 'rgba(220, 38, 38, 0.4)',
    serious: 'rgba(245, 158, 11, 0.4)',
    moderate: 'rgba(251, 191, 36, 0.4)',
    minor: 'rgba(59, 130, 246, 0.4)'
  };
  
  const color = impactColors[violation.impact] || impactColors.moderate;
  
  overlay.style.cssText = `
    position: absolute;
    top: ${rect.top + window.scrollY}px;
    left: ${rect.left + window.scrollX}px;
    width: ${rect.width}px;
    height: ${rect.height}px;
    background-color: ${color};
    border: 2px solid ${color.replace('0.4', '1')};
    pointer-events: auto;
    z-index: 999998;
    box-sizing: border-box;
  `;
  
  return overlay;
}

function createTooltip(violation, element, issueNumber) {
  const tooltip = document.createElement('div');
  tooltip.className = 'axe-highlight-tooltip';
  
  const impactColors = {
    critical: '#DC2626',
    serious: '#F59E0B',
    moderate: '#FBBF24',
    minor: '#3B82F6'
  };
  
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
        ${escapeHtmlTooltip(title)}
      </div>
      <div style="color: #6b7280; font-size: 12px;">
        ${escapeHtmlTooltip(description)}
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

function escapeHtmlTooltip(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function positionTooltip(tooltip, element) {
  const rect = element.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  
  let top = rect.top + window.scrollY - tooltipRect.height - 10;
  let left = rect.left + window.scrollX;
  
  if (top < window.scrollY) {
    top = rect.bottom + window.scrollY + 10;
  }
  
  if (left + tooltipRect.width > window.innerWidth) {
    left = window.innerWidth - tooltipRect.width - 10;
  }
  
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

function removeHighlights() {
  highlightedElements.forEach(element => {
    if (element.parentNode) {
      element.parentNode.removeChild(element);
    }
  });
  highlightedElements = [];
}

function highlightSingleIssue(violations, globalIssueIndex) {
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
              overlay.appendChild(closeBtn);
              
              document.body.appendChild(overlay);
              highlightedElements.push(overlay);
              
            
              const tooltip = createTooltip(violation, element, globalIssueIndex + 1);
              document.body.appendChild(tooltip);
              highlightedElements.push(tooltip);
              
              positionTooltip(tooltip, element);
              
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

function getImpactColor(impact) {
  const colors = {
    critical: '#DC2626',
    serious: '#F59E0B',
    moderate: '#FBBF24',
    minor: '#3B82F6'
  };
  return colors[impact] || colors.moderate;
}

let scrollTimeout;
window.addEventListener('scroll', () => {
  if (isHighlightEnabled && highlightedElements.length > 0) {
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const violations = window.lastViolations;
      if (violations) {
        highlightViolations(violations);
      }
    }, 100);
  }
});

window.addEventListener('resize', () => {
  if (isHighlightEnabled && highlightedElements.length > 0) {
    const violations = window.lastViolations;
    if (violations) {
      highlightViolations(violations);
    }
  }
});

function translateImpact(impact) {
  const impacts = {
    'critical': 'КРИТИЧЕСКАЯ',
    'serious': 'СЕРЬЕЗНАЯ',
    'moderate': 'УМЕРЕННАЯ',
    'minor': 'НЕЗНАЧИТЕЛЬНАЯ'
  };
  return impacts[impact] || impact.toUpperCase();
}

function translateText(text) {
  const translations = {
    'ARIA hidden element must not be focusable or contain focusable elements': 
      'Скрытый ARIA элемент не должен получать фокус',
    'html element must have a lang attribute': 
      'Элемент html должен иметь атрибут lang',
    'Images must have alternate text': 
      'Изображения должны иметь альтернативный текст',
    'Buttons must have discernible text': 
      'Кнопки должны иметь различимый текст',
    'Form elements must have labels': 
      'Элементы формы должны иметь метки',
    'Links must have discernible text': 
      'Ссылки должны иметь различимый текст',
    'Elements must meet minimum color contrast ratio thresholds': 
      'Элементы должны соответствовать минимальным требованиям контрастности',
    'id attribute value must be unique': 
      'Значение атрибута id должно быть уникальным'
  };
  
  if (translations[text]) {
    return translations[text];
  }
  
  for (const [key, value] of Object.entries(translations)) {
    if (text.startsWith(key)) {
      return text.replace(key, value);
    }
    if (text.includes(key)) {
      return text.replace(key, value);
    }
  }
  
  return text;
}
