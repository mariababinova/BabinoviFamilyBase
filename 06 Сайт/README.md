# Медицинский дашборд

Статический Astro-сайт для просмотра медицинской базы из этого репозитория. Дашборд ничего не изменяет в хранилище: он только читает заметки, YAML-поля и вложенные документы, собирает индекс и публикует визуальную навигацию.

Обычная публичная сборка не копирует оригиналы PDF/JPG/PNG в `dist`: на сайте видны карточки и метаданные документов, но не raw-файлы.

## Локальная работа

```powershell
npm ci
npm run check
npm run validate:ops
npm run validate:data
npm run validate:assets
npm run build
npm run validate:pages-artifact
npm run preview
```

Открывать локально: `http://localhost:4321/MedsDataBase/`.

## Обновление данных

1. Отредактировать Obsidian-хранилище локально.
2. Проверить операционный слой командой `npm run validate:ops` из папки `06 Сайт`.
3. Проверить данные дашборда командой `npm run validate:data`.
4. Собрать сайт командой `npm run build`. Эта команда также проверяет, что raw-документы не попали в публичный артефакт.
5. Закоммитить и запушить изменения в `main`.

После push GitHub Actions пересобирает сайт и публикует `06 Сайт/dist` в GitHub Pages. Workflow также запускается раз в сутки, чтобы статусы задач по датам не зависали без нового коммита.

Для приватной локальной сборки с оригиналами документов есть отдельная явная команда:

```powershell
npm run build:with-documents
```

Её нельзя использовать для публичного GitHub Pages.

## Один запуск для новых документов

Когда в базу добавлен новый медицинский документ, обычный рабочий сценарий такой:

```powershell
cd <resolved 06 *>; npm run update:base
```

Где `<resolved 06 *>` — фактическая папка `06 Сайт` в этом репозитории. Команда последовательно запускает входящий агент, перенос одобренных черновиков, показатели, задачи, врачебные сводки, генерацию данных сайта и проверку вложений.

Для безопасной репетиции без записи:

```powershell
cd <resolved 06 *>; npm run update:base -- --dry-run
```

Для локальной проверки без AI-вызовов:

```powershell
cd <resolved 06 *>; npm run update:base -- --no-ai
```

После запуска проверять нужно не весь репозиторий, а конкретные review-точки:

- `04 Входящие/10 Черновики AI` и `04 Входящие/20 На проверке` — разобранные документы.
- `07 Показатели/metric_candidates.json` — новые значения, единицы, лабораторные референсы и источник.
- `07 Показатели/Проверка показателей.md`, если файл создан агентом, — человекочитаемая проверка показателей.
- `/metric-review` — локальная/сайт-страница для approve/reject кандидатов показателей.
- `08 Задачи/task_candidates.json` или страница `/task-review` — задачи, которые еще нельзя считать подтвержденными.
- `09 Наблюдение/update-base-state.json` — журнал последнего запуска, статусы шагов и ошибки.

Правило безопасности: AI-извлечение сначала попадает в черновики или кандидаты. Финальными становятся только записи, которым человек поставил `status: approved` или подтвердил их через review-страницу.

## Инструменты и ключи

Минимально для сайта нужны Node.js и npm. Проверить локальную среду можно так:

```powershell
node scripts/doctor-env.mjs
```

Для чтения PDF/фото через AI нужен `OPENAI_API_KEY` в `.env` корня репозитория или в переменных окружения. `OPENAI_MODEL` можно оставить по умолчанию.

Для извлечения текста из PDF и поиска референсов нужна Python-библиотека PyMuPDF:

```powershell
py -m pip install PyMuPDF
```

Если команда `py` недоступна:

```powershell
python -m pip install PyMuPDF
```

Production-ключи вроде `MEDS_GITHUB_TOKEN`, `OPENAI_CHATKIT_WORKFLOW_ID`, `SITE_AUTH_PASSWORD` и ключей документов нужны только для серверных review API, ChatKit, приватного хостинга или публикации документов. Их нельзя коммитить; они задаются в локальном `.env` или в приватных переменных деплоя.

## Локальные review API

Для кнопок на локальных страницах проверки нужны маленькие локальные API:

```powershell
npm run review:tasks:local
npm run review:metrics:local
```

Они меняют только review-файлы (`task_candidates.json` и `metric_candidates.json`) и не публикуют данные.

## Наблюдение за входящими

Локальный watcher можно запустить так:

```powershell
npm run watch:intake
```

Он следит за `04 Входящие/00 Новые файлы` и после паузы запускает безопасный локальный `update:base --no-ai`. Пересекающиеся запуски защищены lock-файлом самого `update:base`.

Windows Task Scheduler можно настроить на команду из папки `06 Сайт`:

```powershell
npm run update:base -- --dry-run
```

Для реальной обработки вместо мониторинга использовать:

```powershell
npm run update:base
```

Публикация остаётся отдельным ручным шагом после `npm run build`, `npm run validate:pages-artifact` и `npm run validate:privacy`.

## Входящий агент

1. Положить новый PDF, фото или текст в `04 Входящие/00 Новые файлы`.
2. Указать `OPENAI_API_KEY` в `.env` в корне репозитория или в переменных окружения.
3. Запустить `npm run agent:intake` из папки `06 Сайт`.
4. Агент прочитает содержимое файла, переименует его в `00 Новые файлы` и создаст черновик в `04 Входящие/10 Черновики AI`.
5. Проверить черновик в `04 Входящие/10 Черновики AI`.
6. Если черновик корректный, поставить во frontmatter `status: approved`.
7. Запустить `npm run agent:promote`, чтобы создать событие в `01 Члены семьи`.

Для проверки без записи файлов доступны `npm run agent:intake -- --dry-run` и `npm run agent:promote -- --dry-run`.

## Полезные команды

```powershell
npm run dev
npm run check
npm run validate:ops
npm run agent:intake
npm run agent:promote
npm run agent:metrics
npm run agent:tasks
npm run agent:doctor-summaries
npm run refresh:derived
npm run build
npm run preview
npm run validate:data
npm run validate:assets
npm run validate:pages-artifact
```

Служебная страница дашборда: `/operations`. Она показывает состояние входящих файлов, кандидатов показателей, задач, сводок и предупреждений качества данных.
