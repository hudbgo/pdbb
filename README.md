# Planner

Planner es una web privada para dos usuarios con calendario mensual, tareas por día, sincronización real con Supabase y una interfaz limpia inspirada en Apple.

## Funcionalidades
- Login con Supabase Auth.
- Datos privados por usuario con RLS.
- Calendario mensual con navegación entre meses.
- Tareas por día con crear, editar, completar y eliminar.
- Estado visual del día: verde, amarillo, rojo o neutro.
- Sincronización entre dispositivos con Supabase Realtime.
- Diseño responsive para móvil y escritorio.

## Requisitos
- Node.js 18 o superior.
- Un proyecto de Supabase.

## Instalación local
1. Instala dependencias:
   ```bash
   npm install
   ```
2. Copia `.env.example` a `.env` y rellena:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Ejecuta:
   ```bash
   npm run dev
   ```

## Supabase
1. Crea un proyecto en Supabase.
2. Ejecuta el SQL del archivo `supabase.sql` en el editor SQL.
3. Crea dos usuarios desde Authentication > Users, o usa el formulario de registro de la app.
4. Verifica que RLS está activo en las tablas.

## Despliegue en GitHub Pages
Este proyecto está preparado para GitHub Pages mediante GitHub Actions.

1. Sube el repositorio a GitHub.
2. En Settings > Secrets and variables > Actions, añade:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. En Settings > Pages, selecciona Source: GitHub Actions.
4. Al hacer push a `main`, se generará y publicará la web.

## Estructura
- `src/App.jsx`: lógica principal.
- `src/styles.css`: diseño visual.
- `supabase.sql`: esquema y políticas.
- `.github/workflows/deploy.yml`: despliegue automático.
