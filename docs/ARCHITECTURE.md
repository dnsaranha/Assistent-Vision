# Arquitetura técnica — AssistEnt Vision

## Visão geral

O projeto mantém uma arquitetura de aplicação única: frontend React/Vite e backend Express/WebSocket publicados no mesmo projeto Vercel. Firebase fornece autenticação; Gemini fornece análise de tela, resumo e conversa multimodal ao vivo.

Não há serviço Render nem dependência de backend externo adicional.

## Componentes e responsabilidades

### Frontend

- `App.tsx`: estado da sessão, autenticação, captura de tela/câmera, conversa, configurações e coordenação dos hooks.
- `components/AppWorkspace.tsx`: composição visual da área autenticada, cabeçalho, painéis, controles, publicidade e modal de configurações.
- `components/ScreenPreview.tsx`: visualização da tela/câmera, upload/cola de imagens e renderização das orientações visuais.
- `components/StepRoadmapDrawer.tsx`: lista acessível de passos produzidos pela IA e estado de conclusão.
- `components/VisualGuideOverlay.tsx`: desenho SVG isolado de anotações, setas, círculos, retângulos e etapas.
- `hooks/useScreenCapture.ts`: captura e encerramento de mídia.
- `hooks/useLiveConversation.ts`: ciclo de vida da conversa de voz, áudio, reprodução, transcrição e WebSocket.
- `services/geminiService.ts`: chamadas autenticadas à API do mesmo domínio e compactação do histórico antes do envio.

### Backend

- `server.ts`: inicialização HTTP, CORS, parser, rate limit, Vite em desenvolvimento e exportação do servidor para Vercel.
- `server/config.ts`: carregamento local de variáveis, seleção da chave Gemini e schema de resposta.
- `server/firebaseAdmin.ts`: inicialização única do Firebase Admin.
- `server/routes.ts`: health check, autenticação Bearer, análise de tela e resumo.
- `server/liveWebSocket.ts`: upgrade WebSocket, validação de origem, autenticação Firebase e proxy da Gemini Live API.
- `server/conversationContext.ts`: orçamento de mensagens/caracteres e montagem cronológica do contexto enviado ao modelo.
- `api/[...path].ts`: entrada da Vercel Function que exporta o servidor HTTP.

## Fluxo de segurança

1. O frontend obtém o ID token do usuário autenticado pelo Firebase.
2. Requisições REST enviam o token em `Authorization: Bearer`.
3. O backend valida o token com Firebase Admin antes de executar análise ou resumo.
4. A conexão WebSocket autentica o token antes de aceitar mensagens de sessão.
5. A chave Gemini e a credencial Firebase Admin ficam somente em variáveis de ambiente do servidor. Não usar prefixo `VITE_` para segredos.
6. CORS aceita a origem do próprio host e origens explicitamente listadas em `CORS_ORIGINS`.

## Variáveis de ambiente

- `GEMINI_API_KEY` (ou `API_KEY`): chave da API Gemini.
- `FIREBASE_PROJECT_ID`: ID do projeto Firebase.
- `FIREBASE_SERVICE_ACCOUNT_JSON`: JSON da conta de serviço Firebase Admin, em segredo no ambiente Vercel.
- `CORS_ORIGINS`: origens adicionais separadas por vírgula, quando realmente necessárias.
- `PORT`: porta local; definida pela plataforma em produção.

## Endpoints

- `GET /api/health`: estado básico da API e indicação booleana de chave configurada; não retorna credenciais.
- `POST /api/screen/ask`: análise de conversa e quadro de tela.
- `POST /api/screen/summary`: resumo da conversa.
- `WS /api/live-ws`: sessão Gemini Live autenticada.

## Desenvolvimento e publicação

- `npm run dev`: servidor Express com middleware Vite.
- `npm run build`: build de produção do frontend.
- Vercel publica frontend e funções no mesmo projeto.
- Firebase Authentication deve ter o domínio Vercel autorizado.
- Configurar segredos nos ambientes Vercel necessários (Production, Preview e Development) sem copiar valores para o repositório.
- A duração máxima da Function deve respeitar o plano Vercel ativo; sessões Live podem precisar reconectar quando a plataforma encerra uma execução.

## Arquivos vazios removidos

Foram removidos cinco placeholders sem conteúdo e sem referências no código: `FloatingWindow.tsx`, `MinimizedView.tsx`, `useDraggable.ts`, `useTextToSpeech.ts` e `useVoiceRecognition.ts`. As funções de voz efetivamente usadas pelo produto permanecem concentradas no fluxo Gemini Live em `useLiveConversation.ts`; os stubs não eram implementações ativas.

## Validação antes de produção

- Build Vite/TypeScript sem erros.
- `/api/health` retorna HTTP 200.
- Login Google/Firebase funciona nos domínios de Preview e Production.
- Análise de tela e geração de resumo funcionam com e sem imagem.
- WebSocket autentica, inicia sessão, transmite áudio, recebe áudio e encerra sem deixar microfone ativo.
- PWA instala, atualiza e abre a interface offline sem armazenar respostas privadas ou endpoints autenticados em cache.
- Anúncios reais só são exibidos quando IDs válidos do provedor estiverem configurados e aprovados.
