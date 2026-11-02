# Desempenho e evolução

## Histórico enviado à IA

O frontend reduz o payload antes da chamada de rede. O backend aplica um segundo limite antes de montar o prompt:

| Operação | Mensagens de contexto | Orçamento de texto |
|---|---:|---:|
| Pergunta sobre a tela | 16 turnos anteriores | 22.000 caracteres |
| Resumo | 24 turnos anteriores | 32.000 caracteres |

Mensagens individuais são limitadas e os turnos mais recentes têm prioridade. O quadro de imagem continua sendo enviado separadamente, quando existe. Isso reduz tráfego e tokens sem alterar o histórico exibido ao usuário.

## Captura de áudio

- O caminho principal usa AudioWorklet em `public/audio/pcm-capture-processor.js`.
- O processador acumula blocos de 2.048 amostras antes de transferi-los para a thread principal.
- O hook converte PCM Float32 em PCM16 para a Gemini Live API.
- ScriptProcessor permanece como fallback para navegadores sem AudioWorklet.
- Cancelamento de eco, supressão de ruído e controle de ganho continuam habilitados no microfone.

## Backpressure e fila WebSocket

- A fila do cliente é limitada a 24 mensagens.
- Mensagens antigas de mídia são descartadas quando a fila atinge o limite, evitando crescimento ilimitado de memória e atraso de áudio.
- O consumidor envia uma mensagem por ciclo de 20 ms apenas quando `bufferedAmount` está abaixo de 256 KiB.
- Quadros de câmera/tela são ignorados enquanto o buffer está congestionado.
- A fila e o temporizador são limpos ao encerrar a sessão.

O descarte controlado é preferível a reproduzir áudio atrasado. Métricas de latência e taxa de descarte podem ser adicionadas posteriormente, sem registrar conteúdo de áudio ou imagem.

## PWA

A estratégia deve priorizar carregamento rápido do shell e atualização segura. Não armazenar em cache respostas de `/api/*`, tokens Firebase, conteúdo de conversas ou mídia capturada. A disponibilidade offline deve limitar-se aos arquivos estáticos da aplicação e a uma tela de fallback.

## Publicidade

O banner não deve simular campanhas de terceiros. Em desenvolvimento ou sem IDs válidos, deve mostrar somente um espaço publicitário identificado como tal. A integração AdSense/AdMob precisa respeitar consentimento, políticas do provedor e configuração por ambiente. Nunca exibir IDs de publisher na interface nem carregar scripts repetidamente.

## Próximas medições

- Lighthouse mobile: LCP, INP, CLS e peso do bundle.
- Tempo até primeira resposta da IA e tamanho do contexto enviado.
- Latência de áudio e tamanho médio de `WebSocket.bufferedAmount`.
- Taxa de reconexão e duração das sessões Live.
- Instalação PWA em Chrome Android e Safari iOS.
