<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1CmlOzW8EQ6DI0mR_RoXqYpbBbgU6sYWp

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## Deploy

O frontend é publicado na Vercel. O Firebase é usado para autenticação e o Gemini para os recursos de IA. Não é necessário configurar um serviço externo no Render.

Configure as variáveis e credenciais necessárias diretamente nos painéis da Vercel e do Firebase. Nunca coloque chaves privadas ou credenciais administrativas em variáveis `VITE_*`, pois elas ficam expostas no navegador.

Para desenvolvimento local, use `npm run dev`.