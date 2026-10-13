# Las Dos Doncellas · Frontend

Tienda online y panel CMS en React 19 + Tailwind + Shadcn UI.

```bash
yarn install
echo "REACT_APP_BACKEND_URL=http://localhost:8001" > .env
yarn start      # desarrollo
yarn build      # producción (carpeta build/)
```

Desarrollado por **[WhiteCastle.dev](https://whitecastle.dev)**.

Despliegue: cada push a `main` que toque `frontend/` publica automáticamente en https://www.lasdosdoncellasibericos.es (GitHub Actions → FTPS).
