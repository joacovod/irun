# Kilometros en Equipo

PWA familiar para anotar salidas con fecha, distancia, tiempo y circuito: `montana` o `calle`.

La app esta pensada para:

- Subirse a GitHub.
- Publicarse en Netlify con plan gratuito.
- Guardar los datos compartidos en el archivo `data/runs.json` del repo, usando una Netlify Function como backend.
- Instalarse en celulares como una app.

## Como funciona

El navegador habla con `/api/runs`.

Netlify redirige esa ruta a `netlify/functions/runs.js`. Esa funcion lee y escribe el archivo `data/runs.json` en GitHub con un token privado guardado como variable de entorno en Netlify.

El token nunca queda dentro del codigo del navegador.

## Probar en local

Para ver solo la pantalla:

```bash
npm run serve
```

Abrir:

```text
http://localhost:4173
```

Sin variables de GitHub, la app entra en modo local: guarda en ese dispositivo, pero no sincroniza.

Para probar tambien el backend local, instalar dependencias y usar Netlify CLI:

```bash
npm install
npm start
```

## Deploy en GitHub

1. Crear un repositorio en GitHub.
2. Subir estos archivos al repo.
3. Confirmar que exista `data/runs.json` con `[]` adentro.

## Token de GitHub

Crear un Fine-grained personal access token en GitHub:

1. Ir a GitHub: Settings -> Developer settings -> Personal access tokens -> Fine-grained tokens.
2. Crear un token para este repositorio.
3. Dar permisos:
   - Contents: Read and write
4. Copiar el token.

## Configurar Netlify

1. Crear un sitio nuevo desde el repo de GitHub.
2. En Build settings:
   - Publish directory: `.`
   - Functions directory: `netlify/functions`
3. En Site configuration -> Environment variables, agregar:

```text
GITHUB_OWNER=tu_usuario_o_organizacion
GITHUB_REPO=nombre_del_repo
GITHUB_TOKEN=el_token_privado
GITHUB_BRANCH=main
DATA_FILE_PATH=data/runs.json
```

`GITHUB_BRANCH` y `DATA_FILE_PATH` son opcionales si usas esos valores.

4. Deploy.

## Instalar como app

En el celular, abrir la URL de Netlify.

En iPhone:

1. Abrir en Safari.
2. Compartir.
3. Agregar a pantalla de inicio.

En Android:

1. Abrir en Chrome.
2. Menu.
3. Instalar app o Agregar a pantalla principal.

## Notas

- Si Netlify muestra `Modo local`, falta configurar alguna variable de GitHub o el token no tiene permiso de escritura.
- Cada salida se guarda con `id`, `date`, `distanceKm`, `durationMinutes`, `circuit`, `note` y `createdAt`.
- Cada salida de la bitacora puede editarse desde el boton `Editar`.
- Si dos personas guardan exactamente al mismo tiempo, GitHub puede rechazar una escritura por conflicto. En ese caso, alcanza con volver a guardar.
