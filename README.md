<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# AssistEnt Vision

Assistente visual e de voz com análise de tela, Firebase Authentication e Gemini.

## Executar localmente

**Pré-requisito:** Node.js 22 ou superior.

1. Instale as dependências: `npm install`.
2. Crie `.env.local` com `GEMINI_API_KEY`, `FIREBASE_PROJECT_ID` e `FIREBASE_SERVICE_ACCOUNT_JSON`.
3. Execute `npm run dev`.
4. Abra `http://localhost:3000`.

## Publicação: somente Vercel + Firebase + Gemini

O frontend e o backend Express/WebSocket são publicados no mesmo projeto Vercel. O Firebase Authentication autentica os usuários e o backend valida os ID tokens com Firebase Admin. O Gemini processa as análises de tela e a conversa por voz. Não é necessário Render, outro servidor ou banco de dados adicional para esta arquitetura.

### Variáveis na Vercel

Em **Project → Settings → Environment Variables**, configure no ambiente Production:

- `GEMINI_API_KEY` ou a variável `API_KEY` já existente no projeto.
- `FIREBASE_PROJECT_ID`: `gen-lang-client-0421027303`.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: JSON completo da conta de serviço Firebase, marcado como Sensitive/Secret.

Nunca coloque a chave Gemini ou a conta de serviço em variáveis `VITE_*`: elas seriam expostas no bundle do navegador. A configuração Firebase usada pelo frontend é pública por projeto e deve continuar protegida pelas Firebase Security Rules.

### API e conversa ao vivo

A função `api/[...path].ts` exporta o servidor HTTP Express e habilita as rotas REST e o endpoint WebSocket `/api/live-ws` no próprio domínio Vercel. O projeto usa Node.js com Fluid Compute; WebSockets são suportados nativamente pela Vercel.

Em contas Hobby, as Functions têm duração máxima de 300 segundos. Portanto, uma conexão de voz ao vivo pode ser encerrada ao atingir esse limite; o usuário poderá iniciar uma nova sessão. O projeto não depende de estado compartilhado entre instâncias.

### Após configurar

1. Confira se as três variáveis estão cadastradas no ambiente Production.
2. Faça um novo deploy na Vercel.
3. Teste login, análise de tela, resumo e conversa por voz com microfone e câmera.

O endpoint `/api/health` informa o estado da API. Ele não revela nem retorna os segredos do servidor.


## Documentação técnica

- [Arquitetura e operação](docs/ARCHITECTURE.md)
- [Desempenho e evolução](docs/PERFORMANCE.md)
