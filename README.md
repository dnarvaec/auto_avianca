# Automatización Avianca

Framework de pruebas end-to-end con **Playwright + TypeScript + Data-Driven Testing (Excel) + Page Object Model**.

Esta guía describe el estado del repositorio al **22 de octubre de 2026**, los requisitos para instalarlo en otra máquina y su operación. Los comandos están escritos para **Windows PowerShell** y deben ejecutarse desde la raíz del proyecto.

> **Importante:** NBF recorre el flujo hasta enviar el pago y obtener la confirmación. Utilizar exclusivamente ambientes QA y datos de prueba autorizados. No es una prueba de solo consulta ni tiene un modo de simulación de compra.

## Índice

1. [Alcance y estado](#1-alcance-y-estado)
2. [Requisitos de instalación](#2-requisitos-de-instalación)
3. [Instalación en otra máquina](#3-instalación-en-otra-máquina)
4. [Variables de entorno](#4-variables-de-entorno)
5. [Excel maestro](#5-excel-maestro)
6. [Ejecución de NBF](#6-ejecución-de-nbf)
7. [Reportes y evidencias](#7-reportes-y-evidencias)
8. [Arquitectura y flujo técnico](#8-arquitectura-y-flujo-técnico)
9. [Configuración de Playwright](#9-configuración-de-playwright)
10. [Verificación técnica y limitaciones conocidas](#10-verificación-técnica-y-limitaciones-conocidas)
11. [Solución de problemas](#11-solución-de-problemas)
12. [Mantenimiento y manejo de información](#12-mantenimiento-y-manejo-de-información)
13. [Checklist de entrega de una máquina nueva](#13-checklist-de-entrega-de-una-máquina-nueva)

## 1. Alcance y estado

| Flujo | Estado | Alcance actual |
|---|---|---|
| NBF OW | Implementado | Reserva de solo ida: vuelos, bundle, pasajeros, servicios opcionales, pago y confirmación. |
| NBF RT | Implementado | Reserva de ida y vuelta, incluyendo selección de vuelos y bundle de ambos tramos. |
| SSCI | Incompleto | Existe una especificación inicial, con pasos pendientes e importación de un fixture ausente. No usar como validación funcional de check-in. |
| ATC | Pausado | Hoja de casos preparada. Automatización pendiente de despliegues del equipo de desarrollo; no existe suite ejecutable ATC. |

El flujo operativo documentado es **NBF**. La presencia de una hoja Excel no significa que exista automatización implementada para ella.

## 2. Requisitos de instalación

### 2.1 Software y accesos

| Requisito | Recomendación o condición |
|---|---|
| Sistema operativo | Windows 11 de 64 bits como referencia para replicar el entorno. Otras plataformas requieren validación propia y comandos equivalentes. |
| Node.js | Usar la línea **22.x**, preferentemente una revisión aprobada por la organización. Versión observada en la máquina de referencia: **22.23.2**. |
| npm | Incluido con Node.js. Versión observada: **12.0.2**; el proyecto no fija una versión obligatoria de npm. |
| Git | Instalado y disponible en `PATH`, con acceso de lectura al repositorio. |
| Google Chrome | Instalar el navegador de escritorio en el sistema. La configuración utiliza el canal `chrome`, no el Chromium descargado por defecto de Playwright. |
| Editor | VS Code recomendado; no es obligatorio para ejecutar por terminal. |
| Acceso a QA | VPN, DNS, proxy, certificados corporativos y permisos necesarios para abrir las URLs de reservas y su checkout. |
| Acceso a dependencias | Conectividad al registro npm aprobado por la organización. |
| Datos de prueba | URLs QA completas, tarjeta de prueba autorizada y Excel maestro disponible. |
| Edición del Excel | Microsoft Excel o una aplicación compatible con `.xlsx`; no se necesita Excel instalado para ejecutar las pruebas. |

Como orientación de capacidad, se recomiendan **8 GB de RAM o más** y varios GB libres para dependencias, Chrome y videos. No son mínimos medidos: el consumo depende de los casos y de la retención de evidencias.

No se requiere instalar Python, Java, ChromeDriver, Selenium ni TypeScript globalmente. Tampoco se necesita iniciar un servidor local de la aplicación: se prueba el ambiente QA remoto.

### 2.2 Dependencias del proyecto

Las versiones exactas se reproducen con [package-lock.json](./package-lock.json), no instalando paquetes globales ni actualizando versiones manualmente.

| Paquete | Rango declarado | Versión instalada en la máquina de referencia |
|---|---|---|
| `@playwright/test` | `^1.48.0` | `1.61.1` |
| `typescript` | `^5.6.0` | `5.9.3` |
| `@types/node` | `^22.0.0` | `22.20.1` |
| `exceljs` | `^4.4.0` | `4.4.0` |

Los rangos están en [package.json](./package.json). Las versiones de referencia no sustituyen al lockfile de la revisión que se clone.

## 3. Instalación en otra máquina

### Paso 1. Instalar herramientas base

Instalar Node.js 22.x, Git y Google Chrome mediante los mecanismos autorizados por la organización. Abrir una terminal nueva y verificar:

```powershell
node --version
npm --version
git --version
```

Abrir Chrome manualmente para comprobar que se instaló correctamente. Si la ejecución de scripts PowerShell bloquea `npm.ps1` o `npx.ps1`, usar `npm.cmd` y `npx.cmd` en los comandos equivalentes; no hace falta relajar globalmente las políticas de ejecución.

### Paso 2. Clonar el repositorio

Desde la carpeta donde se guardarán los proyectos:

```powershell
git clone https://github.com/dnarvaec/auto_avianca.git
Set-Location .\auto_avianca
```

La autenticación depende de los permisos y políticas del repositorio. No incluir tokens en la URL ni en archivos versionados.

### Paso 3. Restaurar dependencias

```powershell
npm ci
```

Este comando utiliza el lockfile e instala también las dependencias de desarrollo requeridas para ejecutar Playwright y TypeScript. No usar `--omit=dev` para preparar esta máquina.

No copiar `node_modules` desde otra computadora ni regenerar el lockfile como parte de una instalación normal. Si `npm ci` informa diferencias entre los manifiestos, resolverlas con el mantenedor.

### Paso 4. Preparar configuración y datos

1. Crear manualmente un archivo llamado `.env` en la raíz, junto a [package.json](./package.json).
2. Completar las variables de la [sección 4](#4-variables-de-entorno), obteniendo los valores reales por un canal seguro.
3. Comprobar la existencia de [data/maestro.xlsx](./data/maestro.xlsx), incluido en el repositorio.
4. Confirmar fechas futuras, disponibilidad de vuelos y datos válidos en el caso que se ejecutará.
5. Conectarse a la red o VPN correspondiente.

No hay un archivo `.env.example` en esta revisión; la plantilla de este documento es la referencia para crearlo.

### Paso 5. Verificar descubrimiento sin ejecutar compras

```powershell
npx playwright --version
npx playwright test tests\nbf\nbf.spec.ts --list
```

Con las variables requeridas configuradas, deben aparecer **dos tests**: uno OW y uno RT. Esto no ejecuta casos, no abre una compra y tampoco valida el contenido del Excel: las hojas se leen posteriormente en `beforeAll`.

### Paso 6. Ejecutar un único caso autorizado

```powershell
$env:TC_FILTER = "NBFRT-12"
npx playwright test tests\nbf\nbf.spec.ts --grep "Round Trip" --headed --workers=1 --retries=0
```

Este comando sí completa el flujo de compra. Se recomienda empezar con un caso revisado por el equipo, no necesariamente el más complejo del maestro.

### ¿Hay que instalar navegadores de Playwright?

**No para el proyecto `chrome` actual si Google Chrome ya está instalado.** Ejecutar `npx playwright install` sin especificar canal descarga navegadores administrados por Playwright, pero no sustituye el requisito de Chrome del sistema.

Si la organización permite que Playwright instale Chrome y este no existe en la máquina, se puede usar:

```powershell
npx playwright install chrome
```

La instalación puede requerir permisos o ser bloqueada por políticas corporativas. Preferir el instalador administrado de la organización.

El script `npm run install:browsers` existe y ejecuta `playwright install --with-deps`; no es un paso obligatorio para esta configuración y no activa Firefox ni WebKit.

## 4. Variables de entorno

La lectura se implementa en [environment.ts](./src/config/environment.ts).

### 4.1 Variables requeridas

| Variable | Uso |
|---|---|
| `NBF_OW_URL` | URL QA completa de entrada a disponibilidad OW, con los parámetros de búsqueda esperados por el ambiente. |
| `NBF_RT_URL` | URL QA completa de entrada a disponibilidad RT. |
| `SSCI_URL` | URL QA de check-in. Actualmente se exige al importar la configuración, incluso ejecutando solamente NBF. |
| `CC_NUMBER` | Número de tarjeta de prueba autorizado. |
| `CC_EXPIRY` | Vencimiento en formato `MM/YY`. |
| `CC_CVV` | Código de seguridad de la tarjeta de prueba. |

Las tres URLs y los tres datos obligatorios de tarjeta se resuelven al cargar el módulo. Deben estar definidos incluso en una enumeración NBF con `--list`.

### 4.2 Datos de facturación opcionales

| Variable | Valor predeterminado del código |
|---|---|
| `CC_HOLDER_NAME` | `Juan` |
| `CC_HOLDER_LASTNAME` | `Perez` |
| `CC_EMAIL` | `accept@accept.com` |
| `CC_AREA_CODE` | `Colombia (+57)` |
| `CC_PHONE` | `3001111111` |
| `CC_ADDRESS` | `Calle 100` |
| `CC_CITY` | `Bogota` |
| `CC_COUNTRY` | `Colombia` |

El contacto del pasajero viene del Excel; el contacto de facturación viene de esta configuración. No son necesariamente iguales.

**Limitación actual:** `CC_AREA_CODE` se carga, pero el Page Object de pago selecciona la primera opción disponible del desplegable en lugar de buscar ese valor. No asumir que cambiar esa variable modifica el código de área utilizado.

### 4.3 Plantilla sin credenciales

Crear `.env` con esta estructura y sustituir los marcadores antes de ejecutar:

```dotenv
# Reemplazar por las URLs QA completas entregadas por el equipo
NBF_OW_URL=REEMPLAZAR_URL_QA_OW
NBF_RT_URL=REEMPLAZAR_URL_QA_RT
SSCI_URL=REEMPLAZAR_URL_QA_SSCI

# Reemplazar exclusivamente por datos de tarjeta de prueba autorizados
CC_NUMBER=REEMPLAZAR_NUMERO_DE_PRUEBA
CC_EXPIRY=REEMPLAZAR_MM_YY
CC_CVV=REEMPLAZAR_CVV_DE_PRUEBA

# Opcionales
CC_HOLDER_NAME=Juan
CC_HOLDER_LASTNAME=Perez
CC_EMAIL=accept@accept.com
CC_AREA_CODE=Colombia (+57)
CC_PHONE=3001111111
CC_ADDRESS=Calle 100
CC_CITY=Bogota
CC_COUNTRY=Colombia
```

Los marcadores no son valores ejecutables. No inventar una URL base simplificada: el ambiente puede requerir parámetros adicionales de ruta, origen, destino o sesión.

### 4.4 Reglas de lectura

Prioridad implementada:

1. Valor del archivo `.env` físico.
2. Variable del proceso (`process.env`).
3. Valor predeterminado, solamente para campos opcionales.

En consecuencia, una variable de pipeline o PowerShell **no sobrescribe** una variable del mismo nombre presente en `.env`. Un valor vacío también puede provocar un error de configuración en lugar de usar el predeterminado.

El parser acepta líneas `CLAVE=valor`, comentarios en líneas que comienzan con `#` y comillas envolventes simples o dobles. No implementa expansión `${VARIABLE}`, prefijo `export` ni comentarios al final del valor. Ejecutar siempre desde la raíz: `.env` se localiza mediante `process.cwd()`.

`TC_FILTER` y `CI` se leen directamente desde el proceso, no desde el parser de `.env`. Configurarlas en PowerShell o en el pipeline.

## 5. Excel maestro

Fuente de datos: [data/maestro.xlsx](./data/maestro.xlsx). El lector está en [ExcelReader.ts](./src/helpers/ExcelReader.ts).

### 5.1 Hojas y convenciones

| Hoja | Casos con identificador en la revisión documentada | Consumo actual |
|---|---:|---|
| `NBF_OW` | 10 | NBF OW |
| `NBF_RT` | 12 | NBF RT |
| `SSCI_Casos` | 20 | Especificación incompleta |
| `ATC` | 3 | Sin automatización ejecutable |

Los conteos pueden cambiar al editar el maestro.

- Fila 1: nombres exactos de columnas.
- Fila 2 en adelante: casos.
- No cambiar los nombres de hojas, encabezados, espacios ni signos de los encabezados.
- No intercalar columnas sin encabezado; el lector actual no valida el esquema y puede desalinear valores si existen huecos.
- Mantener `TC` informado y único; evitar filas de metadatos dentro de los datos.
- Guardar el libro antes de ejecutar. Los cambios sin guardar en Excel no se leen.
- Usar texto para teléfonos y códigos cuando deban preservarse ceros iniciales.
- Las celdas de fecha se convierten a `YYYY-MM-DD`; también se puede suministrar texto ISO. Evitar fechas regionales ambiguas.
- Las fórmulas requieren un resultado calculado guardado por Excel: ExcelJS no recalcula fórmulas.
- El lector normaliza texto, números, booleanos, fechas, texto enriquecido e hipervínculos. El tipo TypeScript no valida por sí solo los datos del libro.

### 5.2 Columnas de NBF

| Columna | Uso y formato |
|---|---|
| `TC` | Identificador exacto, por ejemplo `NBFOW-01` o `NBFRT-12`. |
| `POS` | Punto de venta. Mapeos actuales: `COP`/`CO` a `CO`, `US`, `BR`, `ES`, `UK`/`GB` a `UK`, `AR`, `MX`. |
| `salida` | Fecha futura de ida en formato ISO, por ejemplo `2026-11-01`. |
| `regreso` | Fecha de vuelta para RT; para OW usar `NA` o vacío. |
| `Viaje` | `OW` o `RT`. Debe coincidir con la hoja; `RT` activa las acciones del segundo tramo. |
| `Bundle` | Dos palabras con cabina y tarifa: `Eco Basic`, `Eco Classic`, `Eco Flex`, `Bus Classic` o `Bus Flex`, según disponibilidad real. |
| `Adultos` | Cantidad de adultos; el código fuerza al menos uno. |
| `Youngs` | Cantidad de jóvenes. |
| `Children` | Cantidad de niños. |
| `Infants` | Cantidad de infantes. |
| `Nombre` | Nombre completo del primer adulto. Se separa la primera palabra como nombre y el resto como apellido. |
| `Genero` | `M` para masculino; el código utiliza femenino para los demás valores. Emplear `M` o `F`. |
| `F.Nac` | Fecha de nacimiento del primer adulto, `YYYY-MM-DD`. |
| `Nacionalidad` | País o código admitido por la interfaz. Hay mapeos para `CO`, `US`, `BR`, `ES`, `UK`, `AR`, `MX`, `PE`, `EC`, `VE`. |
| `LifeMiles` | `Si` o `No`; activa el formulario LifeMiles del primer adulto, no un número de socio desde Excel. |
| `Telefono` | Teléfono de contacto de la reserva. |
| `Correo` | Correo de contacto y su confirmación. |
| `Asiento` | `Si` para intentar seleccionar asiento. |
| `Equipaje Adic` | `Si` para intentar agregar equipaje. |
| `Sala VIP` | `Si` para intentar agregar sala VIP. |
| `Equipaje Deportivo` | `Si` para intentar agregar equipo deportivo. |
| `Asistencia Viaje` | `Si` para intentar agregar asistencia. |
| `Abordaje Prioritario` | `Si` para intentar agregar prioridad. |
| `Cobertura` | Descripción mostrada en el paso del reporte; no dirige por sí misma el flujo. |

Para servicios opcionales utilizar **`Si` sin tilde** o `No`. Los flags de ancillaries se normalizan a minúsculas, pero `Sí`, `true` y `1` no equivalen al valor esperado `si`.

Las cantidades, edades e itinerarios deben cumplir las reglas del negocio. El framework no garantiza validación previa de todas las combinaciones.

### 5.3 Comportamientos relevantes de los datos NBF

- La suite usa `NBF_OW_URL` o `NBF_RT_URL` según la hoja.
- Se modifican `fi`, `fr`, `na`, `nj`, `nn`, `ni` y `Pais` en la URL. Origen y destino permanecen en la URL base.
- Las fechas de búsqueda se convierten a `DDMMM`, sin año. Revisar cómo interpreta QA el cambio de año.
- Una fecha de regreso válida establece `fr`; una inválida lo elimina. No cargar regreso válido en una fila OW.
- La cabina se selecciona en la UI; `selectedCabin` de la URL no se sobrescribe.
- La selección actual exige **Economy y Business habilitadas en el mismo vuelo**, incluso para casos Economy. Esto aplica a ida y regreso.
- Los pasajeros adicionales se generan como `Test Passenger`, nacionalidad Colombia, con años de nacimiento fijos: adulto `1990`, joven `2013`, niño `2020`, infante `2025`. Revisar su validez frente a la fecha del viaje.
- LifeMiles utiliza actualmente el número fijo de prueba `123456`.
- Los nombres y apellidos se limpian de caracteres no admitidos. Un apellido sin letras termina usando `Perez`: por ejemplo, `Test 21` produce apellido `Perez`.
- Los flags de servicios activan rutinas, pero algunos servicios ausentes se omiten con un mensaje. No interpretar el éxito del pago como prueba de que todos los servicios fueron agregados.

### 5.4 Hojas SSCI y ATC

`SSCI_Casos` contiene:

```text
TC, PNR, Apellido, Pax, OW/RT, Asientos, Equip Bodega,
Cambio Asiento, Priority, Lounge, Wallet, Correo
```

`ATC` contiene:

```text
TC, PNR, Apellido, OW/RT, Tipo Flujo, Trayectos A Cambiar,
Vuelo Ida Nuevo, Vuelo Vuelta Nuevo, Tarifa Nueva, Total Esperado,
Requiere Pago, Medio De Pago, Resultado_Esperado, Estado
```

Son datos de preparación, no contratos implementados de automatización ATC. `Estado` no habilita ni filtra casos automáticamente. La interfaz `AtcCaseData` todavía solo declara `TC`.

Cuando se retome ATC, se requerirán un PNR vigente y el apellido exacto de un pasajero autorizado. No considerar `Pre condición` como un PNR o apellido válido. Los resultados de NBF permiten obtener ambos datos, pero hoy no existe integración automática que los escriba en ATC.

## 6. Ejecución de NBF

### 6.1 Un caso RT con navegador visible

```powershell
$env:TC_FILTER = "NBFRT-12"
npx playwright test tests\nbf\nbf.spec.ts --grep "Round Trip" --headed --workers=1 --retries=0
```

### 6.2 Un caso OW con navegador visible

```powershell
$env:TC_FILTER = "NBFOW-03"
npx playwright test tests\nbf\nbf.spec.ts --grep "One Way" --headed --workers=1 --retries=0
```

`TC_FILTER` compara exactamente el identificador de la fila, distinguiendo mayúsculas y minúsculas. No admite listas ni expresiones regulares.

**Advertencia:** un filtro inexistente puede terminar en verde sin ejecutar filas. Confirmar que el log y los pasos incluyen el caso solicitado.

### 6.3 Todos los casos de una hoja

Limpiar primero el filtro para no heredarlo de una ejecución anterior:

```powershell
Remove-Item Env:\TC_FILTER -ErrorAction SilentlyContinue
npm run test:nbf:ow -- --headed --workers=1 --retries=0
```

Para Round Trip:

```powershell
Remove-Item Env:\TC_FILTER -ErrorAction SilentlyContinue
npm run test:nbf:rt -- --headed --workers=1 --retries=0
```

Para ambas hojas, únicamente si está autorizado crear todas sus reservas:

```powershell
Remove-Item Env:\TC_FILTER -ErrorAction SilentlyContinue
npm run test:nbf -- --headed --workers=1 --retries=0
```

### 6.4 Modo headless, depuración e interfaz de Playwright

Sin `--headed`, Playwright utiliza el modo headless:

```powershell
$env:TC_FILTER = "NBFOW-01"
npx playwright test tests\nbf\nbf.spec.ts --grep "One Way" --workers=1 --retries=0
```

Depuración:

```powershell
npx playwright test tests\nbf\nbf.spec.ts --grep "One Way" --debug --retries=0
```

Interfaz interactiva:

```powershell
npx playwright test tests\nbf\nbf.spec.ts --ui
```

Estos modos no deshabilitan el pago. Los pasos ejecutados desde el inspector o la interfaz pueden crear reservas.

### 6.5 Scripts disponibles

| Script | Comportamiento |
|---|---|
| `npm test` | Intenta ejecutar todas las especificaciones; actualmente puede fallar al cargar SSCI. |
| `npm run test:headed` | Todas las especificaciones con navegador visible; misma limitación SSCI. |
| `npm run test:ui` | Interfaz de Playwright para el conjunto completo. |
| `npm run test:debug` | Depuración del conjunto completo. |
| `npm run test:nbf` | Solo la especificación NBF. |
| `npm run test:nbf:ow` | Solo el test OW de NBF. |
| `npm run test:nbf:rt` | Solo el test RT de NBF. |
| `npm run test:ssci` | Especificación SSCI incompleta; no utilizar como prueba funcional. |
| `npm run report` | Abre el reporte HTML existente. |
| `npm run install:browsers` | Instala navegadores administrados y dependencias; no es necesario para Chrome ya instalado. |

Después de `--` se pasan opciones a Playwright. Para la operación actual, preferir los scripts NBF en lugar de los genéricos.

## 7. Reportes y evidencias

### 7.1 PNR y apellido

Al terminar correctamente el flujo, se muestra una línea similar a este ejemplo ficticio:

```text
[NBFRT-12] PNR: ABC123 | Apellido: Perez
```

El reporte incluye las anotaciones:

- `Booking Code (PNR)`.
- `Apellido`.

El apellido es el valor utilizado al llenar el primer adulto, incluyendo su normalización. No es necesariamente el texto literal de `Nombre` en el Excel.

Los resultados se generan al alcanzar la confirmación. Si el flujo falla antes, no se garantiza obtener esos datos.

### 7.2 Archivos generados

| Ubicación | Contenido |
|---|---|
| `playwright-report` | Reporte HTML. |
| `test-results` | Evidencias por test, incluido video. |

Abrir el reporte:

```powershell
npm run report
```

Detener el servidor de reportes con `Ctrl+C` al terminar. No es necesario mantenerlo abierto mientras se ejecutan pruebas.

Los videos se graban también en ejecuciones exitosas. Las capturas de pantalla y los traces están desactivados por defecto. Para una investigación autorizada se puede activar trace solo en la invocación:

```powershell
npx playwright test tests\nbf\nbf.spec.ts --grep "Round Trip" --headed --workers=1 --retries=0 --trace on
```

Esto sigue ejecutando la compra y puede capturar datos sensibles. No publicar reportes, videos ni traces fuera de los canales aprobados. Archivar las evidencias necesarias antes de nuevas ejecuciones; no son un historial permanente.

### 7.3 Interpretación del resultado DDT

Cada hoja NBF corresponde a **un test Playwright** que recorre sus filas mediante `test.step`. Por eso 12 casos RT no aparecen como 12 tests independientes.

- Los errores por fila se acumulan y se lanza un error al terminar el recorrido.
- El timeout general cubre todas las filas del test, no cinco minutos por fila.
- El video corresponde al test agregado.
- Las anotaciones PNR/apellido se agregan al mismo resultado cuando se procesan varias filas. Para relacionarlas inequívocamente con `TC`, consultar los pasos y la consola o ejecutar un único caso.
- Un reintento vuelve a ejecutar el test de la hoja, incluidos casos que ya pudieron completar una reserva.

Se recomienda `--workers=1 --retries=0` para ejecuciones controladas, especialmente durante instalación y diagnóstico.

## 8. Arquitectura y flujo técnico

### 8.1 Estructura

```text
auto_avianca
|-- data
|   `-- maestro.xlsx
|-- src
|   |-- config
|   |   `-- environment.ts
|   |-- helpers
|   |   `-- ExcelReader.ts
|   |-- pages
|   |   |-- BasePage.ts
|   |   `-- nbf
|   |       |-- AvailabilityPage.ts
|   |       |-- TripSummaryPage.ts
|   |       |-- TravelersPage.ts
|   |       |-- AncillariesPage.ts
|   |       |-- PaymentPage.ts
|   |       `-- ConfirmationPage.ts
|   `-- types
|       `-- index.ts
|-- tests
|   |-- nbf
|   |   `-- nbf.spec.ts
|   `-- ssci
|       `-- ssci.spec.ts
|-- .env                  (local, no versionado)
|-- .vscode
|   `-- mcp.json
|-- package.json
|-- package-lock.json
|-- playwright.config.ts
|-- tsconfig.json
`-- README.md
```

Los directorios `node_modules`, `playwright-report` y `test-results` se generan localmente.

### 8.2 Responsabilidades

| Componente | Responsabilidad |
|---|---|
| [environment.ts](./src/config/environment.ts) | Configuración de URLs y pago mediante archivo o proceso. |
| [ExcelReader.ts](./src/helpers/ExcelReader.ts) | Lectura de hojas y normalización de celdas con ExcelJS. |
| [index.ts](./src/types/index.ts) | Tipos de filas por flujo. |
| [BasePage.ts](./src/pages/BasePage.ts) | Navegación, scroll, acciones y aserciones comunes. |
| [nbf.spec.ts](./tests/nbf/nbf.spec.ts) | Carga de casos, filtro, construcción de URL, pasos, manejo agregado de fallos y anotaciones. |
| [AvailabilityPage.ts](./src/pages/nbf/AvailabilityPage.ts) | Selección de vuelos con ambas cabinas, bundle y modal de upsell; incluye regreso RT. |
| [TripSummaryPage.ts](./src/pages/nbf/TripSummaryPage.ts) | Resumen y continuación como invitado cuando aplica. |
| [TravelersPage.ts](./src/pages/nbf/TravelersPage.ts) | Pasajeros, titular, contacto y privacidad; devuelve el apellido del primer adulto. |
| [AncillariesPage.ts](./src/pages/nbf/AncillariesPage.ts) | Decisión de equipaje y servicios opcionales; transición al pago. |
| [PaymentPage.ts](./src/pages/nbf/PaymentPage.ts) | Formulario de tarjeta, facturación, términos y envío del pago. |
| [ConfirmationPage.ts](./src/pages/nbf/ConfirmationPage.ts) | Espera de confirmación, lectura del PNR y recorrido visual de evidencia. |

Secuencia:

```text
Excel + configuración
  -> URL de búsqueda por caso
  -> Vuelo y bundle (ida y regreso si RT)
  -> Resumen
  -> Pasajeros y titular
  -> Servicios opcionales
  -> Formulario de pago
  -> Envío del pago
  -> Confirmación y PNR
  -> Consola y anotaciones con PNR/apellido
```

La confirmación actual verifica la navegación y la visibilidad del código de reserva. El recorrido visual de pago, itinerario y servicios no equivale a aserciones exhaustivas de importes, emisión o cada producto comprado.

### 8.3 Herramientas opcionales de inspección

[.vscode/mcp.json](./.vscode/mcp.json) configura Playwright MCP mediante `npx @playwright/mcp@latest`. Es opcional para inspección asistida de UI en un cliente compatible; no es necesario para ejecutar los tests.

Puede requerir descarga adicional y autorización corporativa. Al usar `latest`, su versión no queda fijada por el lockfile del framework. La presencia del agente en [.github/agents/Automatizar y Ejecutar.md](./.github/agents/Automatizar%20y%20Ejecutar.md) tampoco es un requisito de ejecución.

## 9. Configuración de Playwright

Fuente: [playwright.config.ts](./playwright.config.ts).

| Parámetro | Valor actual |
|---|---|
| Proyecto | `chrome`, canal Google Chrome del sistema. |
| Directorio de tests | `tests`. |
| Paralelismo interno | `fullyParallel: false`. |
| Workers locales | 2; CLI permite sobrescribirlos. |
| Workers con `CI` definido y no vacío | 1. |
| Reintentos locales | 0. |
| Reintentos con `CI` definido y no vacío | 2. |
| Timeout de cada test | 300 000 ms. |
| Timeout de acciones | 30 000 ms. |
| Timeout de navegación | 70 000 ms. |
| Viewport del proyecto Chrome | `null`; ventana maximizada con `--start-maximized`. |
| Video | Activado. |
| Screenshot / trace | Desactivados. |
| Reporters | HTML y lista en consola. |
| Permisos del contexto | Lectura y escritura del portapapeles. |
| `test.only` en CI | Rechazado. |

Los Page Objects incluyen timeouts específicos que pueden diferir de los generales.

**Atención con `CI`:** el código comprueba si existe un texto no vacío. `CI=false` y `CI=0` siguen activando los valores de CI. Para una sesión local donde esa variable se haya heredado:

```powershell
Get-Item Env:\CI -ErrorAction SilentlyContinue
```

Si corresponde a una sesión local y no se desea ese comportamiento:

```powershell
Remove-Item Env:\CI -ErrorAction SilentlyContinue
```

También se puede forzar `--retries=0 --workers=1` en la invocación. No se incluye actualmente un workflow de CI en el repositorio; cualquier integración futura debe preparar Chrome, secretos, red QA y conservación de evidencias.

## 10. Verificación técnica y limitaciones conocidas

### 10.1 Descubrimiento NBF

Comprobación sin ejecutar compras:

```powershell
npx playwright test tests\nbf\nbf.spec.ts --list
```

No usar el descubrimiento global como único criterio de instalación: SSCI tiene una importación a `src\fixtures\test.fixture` que no existe.

### 10.2 TypeScript

Playwright transforma TypeScript para ejecutar pruebas, pero no sustituye el chequeo completo de tipos.

El comando general:

```powershell
npx tsc --noEmit
```

tiene una limitación preexistente: [tsconfig.json](./tsconfig.json) contiene `ignoreDeprecations: "6.0"`, incompatible con TypeScript 5.9.3. Por eso puede fallar con `TS5103` aunque NBF se ejecute con Playwright.

Para comprobar específicamente los archivos NBF sin cambiar la configuración:

```powershell
npx tsc --noEmit --strict --esModuleInterop --skipLibCheck --target ES2022 --module commonjs --moduleResolution node --types node tests\nbf\nbf.spec.ts
```

Este chequeo sigue sus imports, pero no certifica SSCI ni toda la configuración del repositorio. No actualizar TypeScript, eliminar configuraciones o crear fixtures ficticios solo para ocultar el error sin revisar el impacto.

### 10.3 Otras limitaciones a considerar

- Un `TC_FILTER` sin coincidencias no produce actualmente error explícito.
- Un error al leer la hoja RT se transforma en una lista vacía; un resultado verde debe contrastarse con el número de filas y los pasos ejecutados.
- Los casos de la misma hoja reutilizan el contexto. El código limpia cookies e intenta limpiar almacenamiento, pero esa lógica no equivale a crear un contexto completamente nuevo por caso.
- El timeout de la hoja puede resultar insuficiente al ejecutar todos los casos de una sola vez.
- No hay suite de pruebas unitarias versionada en la revisión documentada.
- No hay validación de esquema Excel en tiempo de ejecución, gestión automática de inventario ni limpieza automática de las reservas creadas.
- ATC no tiene todavía Page Objects, URL en `URLS`, script de ejecución ni enlace automático con los resultados NBF.

Estas observaciones documentan el estado actual; esta guía no cambia el comportamiento funcional.

## 11. Solución de problemas

| Síntoma | Revisar o actuar |
|---|---|
| `node`, `npm` o `git` no se reconoce | Reabrir terminal tras instalar; revisar `PATH` con soporte local. |
| PowerShell bloquea `npm.ps1` | Usar `npm.cmd`/`npx.cmd` o la solución autorizada por TI. |
| `npm ci` falla por red o certificado | Revisar VPN, proxy y cadena de confianza corporativa. No desactivar SSL como atajo. |
| No se encuentra Chrome | Instalar Google Chrome del sistema; descargar Chromium no resuelve por sí solo el canal `chrome`. |
| `[Config] Variable de entorno requerida no encontrada` | Revisar nombre, valor no vacío, ubicación de `.env` y directorio desde donde se ejecuta. |
| Un cambio en `$env:NBF_RT_URL` no se aplica | `.env` tiene prioridad; revisar el valor físico sin compartirlo en logs. |
| Se solicita `SSCI_URL` al ejecutar NBF | Es requerido por la inicialización actual del módulo compartido, aunque SSCI esté incompleto. |
| No se encuentra el Excel o una pestaña | Confirmar `data\maestro.xlsx`, nombres exactos y que el libro fue guardado. |
| El test pasa sin realizar acciones | Revisar `TC_FILTER`, casos cargados y hoja RT; no interpretar el verde como ejecución efectiva sin pasos. |
| Se muestran solo dos tests al listar NBF | Es el diseño DDT actual: cada hoja agrupa sus filas en un test. |
| `Cannot find module '../../src/fixtures/test.fixture'` | Se cargó SSCI. Ejecutar la especificación NBF explícitamente; SSCI requiere implementación aparte. |
| `TS5103` sobre `ignoreDeprecations` | Ver la sección TypeScript; es una incompatibilidad de configuración conocida. |
| `Access Denied`, error de conexión o modal de error QA | Comprobar acceso manual, VPN, permisos y disponibilidad del ambiente; no intentar evadir controles. |
| No hay vuelos para la fecha | Revisar fecha futura, interpretación del año y ruta definida en la URL base. |
| Ningún vuelo ofrece Economy y Business | La búsqueda requiere ambas cabinas; revisar inventario y combinación de pasajeros del caso. No se selecciona un vuelo arbitrario como alternativa. |
| No aparece el precio del bundle | Revisar que el panel se abra, que QA conserve sus selectores y que exista la tarifa solicitada para ese vuelo. |
| Fecha de nacimiento o tipo de pasajero rechazado | Revisar fechas del Excel y años fijos de pasajeros adicionales. |
| Se reintenta dos veces sin esperarlo | Revisar `CI`; usar `--retries=0` para una ejecución controlada. |
| Se supera el timeout al correr una hoja | Ejecutar un caso con `TC_FILTER`. Un aumento temporal de `--timeout` debe justificarse por la duración esperada, no ocultar una espera defectuosa. |
| Apellido mostrado distinto al Excel | Se reporta el apellido normalizado del primer adulto; por ejemplo, `Test 21` termina usando `Perez`. |
| ATC no encuentra la reserva | ATC está pausado; al retomarlo se necesita un PNR vigente y apellido correcto, además del despliegue requerido. |

Antes de reportar un fallo, conservar: identificador `TC`, comando sin credenciales, fecha/hora, versión del código, paso fallido y evidencias autorizadas. No adjuntar `.env` ni datos completos de tarjeta.

## 12. Mantenimiento y manejo de información

### 12.1 Control de versiones

Según [.gitignore](./.gitignore):

- Se versiona [data/maestro.xlsx](./data/maestro.xlsx).
- Se ignoran otros `.xlsx` y `.xls` dentro de `data`.
- Se ignoran `.env`, `node_modules`, `dist`, reportes, resultados y archivos `.log`.

El maestro es un archivo binario: los cambios no se revisan fácilmente como texto. Coordinar ediciones y revisar los datos antes de hacer commit. Que un archivo esté versionado no autoriza guardar información real de clientes o tarjetas.

Los PNR y apellidos permiten acceder a reservas; tratarlos como información restringida de pruebas. Mantenerlos solo donde esté autorizado y evitar su publicación.

### 12.2 Actualización del código y dependencias

Antes de actualizar:

```powershell
git status --short
```

Conservar primero el trabajo local y seguir el procedimiento de ramas del equipo. Después de obtener cambios aprobados que afecten manifiestos o lockfile, restaurar con `npm ci`.

No ejecutar `npm update`, instalaciones globales ni correcciones automáticas masivas como parte de una reinstalación rutinaria. Una actualización de Playwright, TypeScript o Chrome requiere validación de compatibilidad.

### 12.3 Cambios funcionales

- Agregar casos NBF conservando esquema, IDs y consistencia OW/RT.
- Modificar selectores en el Page Object correspondiente, no duplicar la lógica de UI dentro de la especificación.
- Verificar el cambio en QA con casos autorizados y sin repetir pagos innecesarios.
- Mantener NBF estable al desarrollar otros flujos.
- Retomar ATC solo después del despliegue pendiente y la disponibilidad de reservas válidas.
- No suponer que un estado de Excel filtra o ejecuta casos si no existe lógica que lo implemente.

## 13. Checklist de entrega de una máquina nueva

- [ ] Node.js 22.x, npm y Git disponibles en una terminal nueva.
- [ ] Google Chrome instalado y ejecutable.
- [ ] Acceso al repositorio y a los ambientes QA autorizado.
- [ ] VPN, proxy y certificados preparados.
- [ ] Repositorio clonado y `npm ci` completado.
- [ ] `.env` creado localmente con las seis variables requeridas y los datos opcionales necesarios.
- [ ] No hay credenciales en archivos versionados ni en comandos compartidos.
- [ ] `data\maestro.xlsx` disponible, guardado y con casos vigentes.
- [ ] `npx playwright test tests\nbf\nbf.spec.ts --list` muestra los dos tests NBF.
- [ ] Se conoce que ese descubrimiento no valida todavía el contenido del Excel.
- [ ] Se revisaron las limitaciones de TypeScript y SSCI.
- [ ] Se eligió un único `TC` autorizado y se verificó que corresponde a OW o RT.
- [ ] Primera ejecución controlada con `--headed --workers=1 --retries=0`.
- [ ] Resultado, PNR y apellido visibles en consola y reporte si se completó la compra.
- [ ] Evidencias almacenadas según políticas y filtro limpiado cuando corresponda.
- [ ] ATC permanece pausado hasta autorización para retomarlo.
