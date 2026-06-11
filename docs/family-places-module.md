# Family Places Module

Раздел `Места` перенесен из отдельного проекта Family Hub в этот репозиторий как самостоятельный статический модуль.

## Где лежит модуль

- Вход из портала: `06 Сайт/src/pages/places.astro`.
- Статическое приложение мест: `06 Сайт/public/family-places/`.
- Данные мест: `06 Сайт/public/family-places/places.js`.
- Логика интерфейса: `06 Сайт/public/family-places/app.js`.
- Стили модуля: `06 Сайт/public/family-places/styles.css` и `06 Сайт/public/family-places/tokens.css`.
- Приемка новых мест: `06 Сайт/public/family-places/inbox.html`.

## Как это работает

Страница `/places` остается частью Astro-портала и использует общий `AppLayout`. Внутри нее открывается статический модуль `/family-places/` в iframe. Это сохраняет готовые фильтры, карту, карточки, медиа, статусы `хотим` / `были` и поле впечатлений без рискованного переписывания.

## Как добавлять новые места

1. Добавить объект в `06 Сайт/public/family-places/places.js`.
2. Проверить координаты, `city`, категорию, ссылки и медиа.
3. Обновить счетчик/описания в портале, если количество мест показывается в тексте.
4. При необходимости повысить cache-bust в `06 Сайт/public/family-places/index.html`.

Минимальная проверка:

```powershell
node --check "06 Сайт/public/family-places/app.js"
node --check "06 Сайт/public/family-places/places.js"
node -e "const fs=require('fs'); let raw=fs.readFileSync('06 Сайт/public/family-places/places.js','utf8'); raw=raw.slice(raw.indexOf('['), raw.lastIndexOf(';')); const p=JSON.parse(raw); console.log(p.length, [...new Set(p.map(x=>x.city))], 'missingCity='+p.filter(x=>!x.city).length)"
```

## Ограничения

- Семейные статусы и впечатления пока сохраняются только в браузере через `localStorage`.
- Модуль использует клиентский Yandex Maps JavaScript API.
- Переписывание в native Astro components отложено: текущая миграция специально сохраняет рабочее приложение без изменения схемы данных.

## Безопасность

Модуль мест не должен затрагивать медицинские документы, входящие PDF/JPG и приватные данные медицинской базы. При коммитах нужно отдельно проверять staged diff.
