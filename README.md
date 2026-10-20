# ¡Conozcámonos mejor! — team-building en tiempo real

Actividad de 15 minutos para 6–10 personas. Cada participante entra desde su navegador; el anfitrión controla el avance.

- **Frontend** (`/`): React + Vite + TypeScript → Vercel.
- **Backend** (`/server`): Hono (Node) → Render. Es el único que habla con Postgres y con Object Storage.
- **Neon**: Postgres, Realtime (live queries) y Object Storage (bucket privado `team-building-uploads`).

```
Navegador ──HTTPS──▶ API (Render) ──▶ Neon Postgres
    │                    ├──────────▶ Neon Object Storage (privado, URLs firmadas de 5 min)
    └──WSS (consultas selladas)──▶ Neon Realtime
```

## Servicios Neon requeridos

| Servicio | Notas |
|---|---|
| Postgres | Ejecutar `npm run migrate` en `server/`. |
| Realtime (beta) | Región `aws-us-east-1`, `aws-us-east-2`, `aws-eu-central-1` o `aws-ap-southeast-1`. Habilitar con `neon realtime enable` y agregar el origen del frontend en `allowedOrigins`. |
| Object Storage | Bucket **privado** `team-building-uploads` (`neon buckets create team-building-uploads`) y una credencial con scopes `storage:read` y `storage:write`. |

Si Realtime no está disponible (variables vacías, error o región no soportada) la app **cae automáticamente a polling** (cada 1,5 s) contra la misma API. El indicador de arriba a la derecha muestra "En vivo" (Realtime) o "Sincronizando" (polling).

## Variables de entorno

**Servidor (Render) — nunca en el frontend** (`server/.env.example`):

| Variable | Descripción |
|---|---|
| `DATABASE_URL` | Conexión a Neon Postgres (`sslmode=require`). |
| `NEON_REALTIME_SECRET` | Secreto para sellar las consultas. Vacío = sin Realtime (solo polling). |
| `AWS_ENDPOINT_URL_S3`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION` | Credenciales de Object Storage. |
| `S3_BUCKET` | Por defecto `team-building-uploads`. |
| `ALLOWED_ORIGINS` | Orígenes del frontend permitidos por CORS (coma-separados), p. ej. `https://tu-app.vercel.app`. |
| `PORT` | Lo define Render. |

**Frontend (Vercel) — solo configuración pública** (`.env.example`):

| Variable | Descripción |
|---|---|
| `VITE_API_URL` | URL del backend en Render. |
| `VITE_NEON_REALTIME_URL` | Host público de Realtime con esquema `wss://` (p. ej. `wss://br-xxxx-neonrealtimesocket.compute.c-7.us-east-2.aws.neon.tech/`). Nunca uses `DATABASE_URL`. Vacío = polling. |
| `VITE_POLL_MS` | Intervalo de polling (opcional). |

## Puesta en marcha local

```bash
# 1. Backend
cd server
cp .env.example .env     # completar con tus valores
npm install
npm run migrate          # crea las tablas
npm run dev              # http://localhost:8787

# 2. Frontend (en otra terminal, desde la raíz)
npm install
npm run dev              # http://localhost:5173 (proxy /api -> :8787)
```

Verificá `GET http://localhost:8787/api/health`: devuelve si Realtime y Storage están configurados.

## Despliegue

**Backend en Render** (Web Service, root `server`):
- Build: `npm install && npm run build` — Start: `npm start`.
- Cargar las variables del servidor. Poner el dominio de Vercel en `ALLOWED_ORIGINS`.
- El plan gratuito se duerme tras inactividad: abrí `/api/health` unos minutos antes de la actividad.

**Frontend en Vercel**: importar el repo, framework Vite, definir `VITE_API_URL` y `VITE_NEON_REALTIME_URL`. `vercel.json` ya incluye el rewrite SPA. Agregar el dominio de Vercel a `allowedOrigins` de Realtime.

## Flujo de la actividad

1. **Lobby**: todos entran y suben una foto de un lugar, una foto de un objeto y escriben su talento inesperado. Un indicador muestra cuántos subieron cada cosa y avisa cuando "¡Todos subieron lo suyo!" (solo cantidades: nunca de quién es cada ítem). El anfitrión puede iniciar igual, con una confirmación si falta alguien.
2. **Elegí un lado**: 4 preguntas con votación. Los resultados se muestran ordenados de mayor a menor con barras animadas; si todos eligen lo mismo hay confeti. Cada pregunta entra con una transición.
3. **Ronda personal, tema por tema**: ✈️ Viaje soñado → 🎁 Objeto significativo → 🎭 Talento inesperado. En cada tema:
   - **Votar**: todos los ítems (fotos o talentos) aparecen juntos y anónimos, y cada uno adivina de quién es cada uno (menos el propio).
   - **Revelar**: el anfitrión revela una respuesta por vez, con quién acertó.
   - **Resumen**: ranking de aciertos y cada ítem con su dueño.
4. **Cierre**: al terminar el último tema la actividad finaliza. El anfitrión puede volver a jugar (conserva lo subido) o cerrar la sala y borrar todo.

## Modelo de seguridad

- El navegador nunca toca Postgres ni el bucket. Todas las escrituras pasan por la API.
- Sesión: token aleatorio de 256 bits en `localStorage`; en la base solo se guarda su hash SHA-256. El código de sala solo sirve para unirse; no autoriza nada más. El rol de anfitrión se verifica en el servidor en cada acción.
- Realtime no tiene RLS: el backend sella consultas ya acotadas a la sala y al participante autenticado (duran ~60 s y se renuevan). Antes de "Mostrar resultados" solo se ve cuántos votaron y tu propio voto; recién al revelar se publican los conteos y quién votó cada opción (solo de la pregunta revelada).
- Imágenes anónimas: las consultas de Realtime y la API nunca devuelven quién subió cada foto; solo si es tuya. El dueño y los votos de cada persona se publican recién cuando el anfitrión revela cada respuesta. El orden de las fotos es pseudoaleatorio y común a todos, para que no delate la autoría.
- Subida: JPEG/PNG/WebP, máx. 25 MB (tope de seguridad), validadas por contenido (magic bytes), clave de objeto aleatoria, 1 por categoría y participante. Fotos y talentos solo se pueden subir o cambiar antes de iniciar la actividad. Las URLs firmadas duran 5 min y cada foto solo se firma para otros participantes cuando le toca (solo durante la votación y el revelado de su tema). Al reemplazar, el objeto anterior se borra después de guardar el nuevo.
- "Cerrar sala y borrar imágenes" (pantalla final, anfitrión) elimina objetos, votos, participantes y sala.

## Limitaciones conocidas

- Si alguien pierde su token (borra datos del navegador), no puede reingresar con el mismo apodo; debe usar otro. Si el anfitrión lo pierde, pierde el control de la sala.
- Rate limiting en memoria, por instancia (suficiente para una sala; no para producción abierta).
- La presencia ("conectado") se calcula con latidos cada 5 s; la comparación usa el último latido del servidor, no el reloj del dispositivo.
- Las salas no se borran solas: usá el botón de cierre o borrá filas antiguas manualmente.
- Realtime está en beta; el protocolo puede cambiar.
- El contenido de preguntas está duplicado (ids) en `server/src/content.ts` y `src/data/questions.ts`; mantenelos sincronizados.
