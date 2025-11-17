// Словарь переводов для axe-core сообщений
const translations = {
  'critical': 'критическая',
  'serious': 'серьезная',
  'moderate': 'умеренная',
  'minor': 'незначительная',
  
  'element': 'элемент',
  'elements': 'элементов',
  'Fix': 'Исправить',
  'Learn more': 'Узнать больше',
  'Affected Elements': 'Затронутые элементы',
  'How to Fix': 'Как исправить',
  
  'Ensures aria-hidden elements are not focusable nor contain focusable elements': 
    'Гарантирует, что элементы с aria-hidden не могут получить фокус и не содержат фокусируемых элементов',
  
  'Ensures every HTML document has a lang attribute': 
    'Гарантирует, что каждый HTML-документ имеет атрибут lang',
  
  'Ensures <img> elements have alternate text or a role of none or presentation': 
    'Гарантирует, что элементы <img> имеют альтернативный текст или роль none/presentation',
  
  'Ensures buttons have discernible text': 
    'Гарантирует, что кнопки имеют различимый текст',
  
  'Ensures every form element has a label': 
    'Гарантирует, что каждый элемент формы имеет метку',
  
  'Ensures links have discernible text': 
    'Гарантирует, что ссылки имеют различимый текст',
  
  'Ensures the contrast between foreground and background colors meets WCAG 2 AA minimum contrast ratio thresholds': 
    'Гарантирует, что контраст между цветом текста и фона соответствует минимальным требованиям WCAG 2 AA',
  
  'Ensures every id attribute value is unique': 
    'Гарантирует, что каждое значение атрибута id уникально',
  
  'Ensures <meta name="viewport"> does not disable text scaling and zooming': 
    'Гарантирует, что <meta name="viewport"> не отключает масштабирование текста',
  
  'Ensures headings have discernible text': 
    'Гарантирует, что заголовки имеют различимый текст',
  
  'Ensures the order of headings is semantically correct': 
    'Гарантирует, что порядок заголовков семантически корректен',
  
  'Ensures <iframe> and <frame> elements contain a non-empty title attribute': 
    'Гарантирует, что элементы <iframe> и <frame> содержат непустой атрибут title',
  
  'Ensures the document has a main landmark': 
    'Гарантирует, что документ имеет главную область (main landmark)',
  
  'Ensures all page content is contained by landmarks': 
    'Гарантирует, что все содержимое страницы находится внутри областей (landmarks)',
  
  'Ensures <html> element has a valid lang attribute': 
    'Гарантирует, что элемент <html> имеет корректный атрибут lang',
  
  'ARIA hidden element must not be focusable or contain focusable elements': 
    'Скрытый ARIA элемент не должен получать фокус или содержать фокусируемые элементы',
  
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
    'Элементы должны соответствовать минимальным требованиям контрастности цветов',
  
  'id attribute value must be unique': 
    'Значение атрибута id должно быть уникальным',
  
  'Zooming and scaling must not be disabled': 
    'Масштабирование не должно быть отключено',
  
  'Headings must have discernible text': 
    'Заголовки должны иметь различимый текст',
  
  'Heading levels should only increase by one': 
    'Уровни заголовков должны увеличиваться только на один',
  
  'Frames must have a unique title attribute': 
    'Фреймы должны иметь уникальный атрибут title',
  
  'Document should have one main landmark': 
    'Документ должен иметь одну главную область (main)',
  
  'All page content should be contained by landmarks': 
    'Все содержимое страницы должно быть внутри областей (landmarks)',
  
  '<html> element must have a valid value for the lang attribute': 
    'Элемент <html> должен иметь корректное значение атрибута lang',
  
  // Сообщения об исправлении
  'Fix any of the following': 
    'Исправьте любое из следующего',
  
  'Fix all of the following': 
    'Исправьте все следующее',
  
  'Element does not have a lang attribute': 
    'Элемент не имеет атрибута lang',
  
  'Element has no title attribute': 
    'Элемент не имеет атрибута title',
  
  'Focusable content should be disabled or be removed from the DOM': 
    'Фокусируемый контент должен быть отключен или удален из DOM',
  
  'Element has insufficient color contrast': 
    'Элемент имеет недостаточный контраст цветов',
  
  'Document has multiple main landmarks': 
    'Документ имеет несколько главных областей (main)',
  
  'Document has no main landmark': 
    'Документ не имеет главной области (main)'
};

// Функция для перевода текста
function translate(text) {
  if (!text) return text;
  
  // Проверяем точное совпадение
  if (translations[text]) {
    return translations[text];
  }
  
  // Проверяем частичное совпадение (начало строки)
  for (const [key, value] of Object.entries(translations)) {
    if (text.startsWith(key)) {
      return text.replace(key, value);
    }
  }
  
  // Возвращаем оригинал если перевод не найден
  return text;
}

// Экспортируем для использования в других файлах
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { translate, translations };
}
