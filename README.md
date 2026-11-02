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


## Deploy com frontend na Vercel e backend no Render

O projeto usa Express e WebSocket para a API de tela e a conversa ao vivo. A Vercel hospeda o frontend; o backend deve rodar como serviço Node persistente.

### 1. Criar o serviço no Render

1. No Render, crie um **New + → Blueprint** e selecione este repositório.
2. O arquivo `render.yaml` configura build, inicialização e health check.
3. Cadastre os segredos solicitados pelo Blueprint:
   - `GEMINI_API_KEY`: chave da API Gemini (não use a variável de frontend).
   - `FIREBASE_SERVICE_ACCOUNT_JSON`: JSON completo da conta de serviço Firebase.
4. Confirme `FIREBASE_PROJECT_ID` e `CORS_ORIGINS` para os domínios públicos da Vercel.
5. Após o primeiro deploy, copie a URL HTTPS do serviço Render.

Use um plano de instância que permaneça ativo para conversas WebSocket contínuas. Instâncias gratuitas podem entrar em suspensão e interromper sessões ao vivo.

### 2. Configurar a Vercel

Em Project → Settings → Environment Variables, cadastre em Production (e Preview se desejar testar previews):

- `VITE_API_BASE_URL`: URL HTTPS do serviço Render, sem barra final.
- `VITE_WS_BASE_URL`: URL WSS do mesmo serviço, por exemplo `wss://seu-servico.onrender.com`.

Depois, faça um novo deploy do frontend. Essas variáveis são incorporadas no build do Vite.

### 3. Verificar

- Abra `https://SUA-URL-RENDER/api/health`; deve retornar JSON com `status: "ok"`.
- Faça login no frontend e teste uma pergunta sobre a tela.
- Teste iniciar, falar, receber áudio e encerrar uma conversa ao vivo.

Nunca coloque `GEMINI_API_KEY` ou `FIREBASE_SERVICE_ACCOUNT_JSON` em variáveis `VITE_*`: variáveis Vite ficam públicas no bundle do navegador.
