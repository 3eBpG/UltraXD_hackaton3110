# Подключение к Ujin

Все команды вводятся в Терминале macOS/Linux или WSL. Слова заглавными буквами заменяй своими значениями.

## 1. Возьми доступы

[Открыть доступы.json в GitHub](https://github.com/3eBpG/UltraXD_hackaton3110/blob/main/docs/ultraxd/доступы.json)

- `employee.login` и `employee.password` — сотрудник, для чтения карточки устройства.
- `residents[0].ust` — готовый токен жителя, для создания устройства.
- Квартира команды — `2860`. Доступ сотрудника к нашим домам уже выдан.

## 2. Получи токен сотрудника

```bash
curl -d 'login=ЛОГИН&password=ПАРОЛЬ&app=employee' https://api-uae-test.ujin.tech/api/auth/authenticate/
```

При `error:0` скопируй токен из `data.user.token`. Если в логине или пароле есть `&`, `+` или `%`, используй кодирование:

```bash
curl --data-urlencode 'login=ЛОГИН' --data-urlencode 'password=ПАРОЛЬ' -d 'app=employee' https://api-uae-test.ujin.tech/api/auth/authenticate/
```

## 3. Заполни переменные

```bash
API='https://api-uae-test.ujin.tech/api'
STAFF='ТОКЕН_СОТРУДНИКА'
UST='ТОКЕН_ИЗ_RESIDENTS_0_UST'
EXT='ultraxd_test_02'
```

`EXT` — уникальный внешний идентификатор нового устройства. Выбери своё имя из латинских букв, цифр и подчёркиваний. Дефисы не используй.

## 4. Создай устройство

```bash
curl "$API/import_device/create-update-device/?token=$UST&apartment_id=2860&serialnumber=$EXT" -d "model=parkcloud_device&device_ext_id=$EXT&serialnumber=$EXT&title=Test"
```

При `error:0` скопируй числовой номер из `data.sapfir_device_serialnumber` и запиши его строкой:

```bash
SN='НОМЕР_ИЗ_ОТВЕТА'
```

Создаётся экземпляр общей модели платформы. Его полезные показания сами по себе не появляются.

## 5. Привяжи своё устройство к нашей квартире

```bash
curl "$API/admin/connect-device-apartment/?token=$STAFF&serialnumber=$SN&apartment=2860"
```

При `error:0` проверь привязку чтением. Используй этот шаг только для своего устройства и квартиры команды.

## 6. Прочитай карточку сотрудником

```bash
curl "$API/bmsdevice/get-device-info/?token=$STAFF&serialnumber=$SN&mts=1"
```

Проверь: `data.meta.serialnumber` — твой номер, `data.meta.apartment.id` — `2860`, `data.meta.serialnumber_human` — твой `EXT`. Сигналы находятся в `data.signals`.

Список устройств и доступных сигналов глазами жителя:

```bash
curl "$API/apartment/get-device-signals/?token=$UST&apartment_id=2860"
```

Для чтения уже созданного «Сканера мух» шаги 4–5 пропусти и задай:

```bash
SN='17048805610017116'
```

## Если результат пустой

- Ошибка авторизации — проверь, какой токен используется. Для BMS-чтения нужен сотрудник.
- Пустая карточка — проверь числовой `SN` и привязку к квартире.
- Есть карточка, но только служебные сигналы — доступ к устройству работает, чтение полезных показаний ещё не подтверждено. Именно такой результат получен у нашего тестового устройства.

Отдельная админская учётка платформы для этих проверенных шагов не использовалась. Права сотрудника на другие дома назначают организаторы.
