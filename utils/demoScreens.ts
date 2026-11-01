// High-resolution canvas renderers for demonstration screens
// Used when native screen sharing is unavailable (e.g. mobile, iframes, sandboxed browsers)
// or for instant interactive testing of screen assistant capabilities.

export interface DemoScreenInfo {
  id: string;
  name: string;
  description: string;
  category: string;
}

export const DEMO_SCREENS: DemoScreenInfo[] = [
  {
    id: 'code-editor',
    name: 'Editor de Código (IDE)',
    description: 'Interface de desenvolvimento com código TypeScript e erro no terminal',
    category: 'Programação',
  },
  {
    id: 'analytics-dashboard',
    name: 'Painel de Métricas (Dashboard)',
    description: 'Relatório financeiro com gráficos de receita e indicadores em alerta',
    category: 'Negócios',
  },
  {
    id: 'ecommerce-checkout',
    name: 'Loja Virtual & Checkout',
    description: 'Carrinho de compras com campo de cupom e botão de pagamento',
    category: 'E-commerce',
  },
];

export function renderDemoScreen(canvas: HTMLCanvasElement, demoId: string): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  if (demoId === 'analytics-dashboard') {
    renderAnalyticsDashboard(ctx, w, h);
  } else if (demoId === 'ecommerce-checkout') {
    renderEcommerceCheckout(ctx, w, h);
  } else {
    renderCodeEditor(ctx, w, h);
  }
}

function renderCodeEditor(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Background
  ctx.fillStyle = '#181824';
  ctx.fillRect(0, 0, w, h);

  // Top window header
  ctx.fillStyle = '#12121a';
  ctx.fillRect(0, 0, w, 40);

  // Window dots
  ctx.fillStyle = '#ef4444';
  ctx.beginPath();
  ctx.arc(20, 20, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#eab308';
  ctx.beginPath();
  ctx.arc(38, 20, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#22c55e';
  ctx.beginPath();
  ctx.arc(56, 20, 6, 0, Math.PI * 2);
  ctx.fill();

  // Window title
  ctx.fillStyle = '#9ca3af';
  ctx.font = '13px Inter, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Visual Studio Code — projeto-assistente [src/services/auth.ts]', w / 2, 25);

  // Sidebar
  const sidebarW = 220;
  ctx.fillStyle = '#1e1e2d';
  ctx.fillRect(0, 40, sidebarW, h - 40);

  ctx.fillStyle = '#9ca3af';
  ctx.font = 'bold 11px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('EXPLORER: PROJETO', 16, 64);

  const files = [
    { name: '📁 src', indent: 16, color: '#93c5fd' },
    { name: '📁 components', indent: 28, color: '#93c5fd' },
    { name: '📁 services', indent: 28, color: '#93c5fd' },
    { name: '📄 auth.ts (Ativo)', indent: 40, color: '#38bdf8', active: true },
    { name: '📄 geminiService.ts', indent: 40, color: '#9ca3af' },
    { name: '📄 package.json', indent: 16, color: '#fbbf24' },
    { name: '📄 tsconfig.json', indent: 16, color: '#a78bfa' },
  ];

  let fileY = 92;
  files.forEach(f => {
    if (f.active) {
      ctx.fillStyle = '#2b2b40';
      ctx.fillRect(8, fileY - 14, sidebarW - 16, 22);
    }
    ctx.fillStyle = f.color;
    ctx.font = '12px "JetBrains Mono", monospace, sans-serif';
    ctx.fillText(f.name, f.indent, fileY);
    fileY += 26;
  });

  // Editor Tabs
  const editorX = sidebarW;
  ctx.fillStyle = '#151520';
  ctx.fillRect(editorX, 40, w - editorX, 34);

  ctx.fillStyle = '#181824';
  ctx.fillRect(editorX, 40, 160, 34);
  ctx.fillStyle = '#38bdf8';
  ctx.fillRect(editorX, 40, 160, 2);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '12px "JetBrains Mono", monospace, sans-serif';
  ctx.fillText('auth.ts ✕', editorX + 16, 62);

  // Code Area
  const codeLines = [
    { num: '1', text: "import { User, Session } from '../types';", color: '#94a3b8' },
    { num: '2', text: '', color: '' },
    { num: '3', text: 'export interface UserProfile {', color: '#c084fc' },
    { num: '4', text: '  id: string;', color: '#e2e8f0' },
    { num: '5', text: '  name: string;', color: '#e2e8f0' },
    { num: '6', text: '  roles?: string[]; // Campo opcional!', color: '#4ade80' },
    { num: '7', text: '}', color: '#c084fc' },
    { num: '8', text: '', color: '' },
    { num: '9', text: 'export function getUserPermissions(user: UserProfile): string[] {', color: '#60a5fa' },
    { num: '10', text: '  // ATENÇÃO: Erro de execução detectado nesta linha:', color: '#f87171' },
    { num: '11', text: '  return user.roles.map(role => role.toUpperCase());', color: '#fbbf24', highlight: true },
    { num: '12', text: '  // Correção recomendada: return (user.roles || []).map(...)', color: '#4ade80' },
    { num: '13', text: '}', color: '#60a5fa' },
  ];

  let codeY = 100;
  codeLines.forEach(line => {
    if (line.highlight) {
      ctx.fillStyle = 'rgba(239, 68, 68, 0.18)';
      ctx.fillRect(editorX, codeY - 15, w - editorX, 22);

      ctx.fillStyle = '#ef4444';
      ctx.fillRect(editorX, codeY - 15, 3, 22);
    }

    ctx.fillStyle = '#64748b';
    ctx.font = '13px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.fillText(line.num, editorX + 35, codeY);

    ctx.textAlign = 'left';
    ctx.fillStyle = line.color || '#e2e8f0';
    ctx.fillText(line.text, editorX + 50, codeY);
    codeY += 24;
  });

  // Terminal Area
  const terminalH = 190;
  const terminalY = h - terminalH;
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(editorX, terminalY, w - editorX, terminalH);

  // Terminal Header
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(editorX, terminalY, w - editorX, 28);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 11px Inter, sans-serif';
  ctx.fillText('TERMINAL — node index.js', editorX + 16, terminalY + 18);

  ctx.fillStyle = '#e2e8f0';
  ctx.font = '12px "JetBrains Mono", monospace';
  const termLines = [
    { text: '$ npm run test:auth', color: '#38bdf8' },
    { text: '[FAIL] tests/auth.test.ts > getUserPermissions', color: '#ef4444' },
    { text: 'TypeError: Cannot read properties of undefined (reading \'map\')', color: '#f87171' },
    { text: '   at getUserPermissions (src/services/auth.ts:11:21)', color: '#94a3b8' },
    { text: '   at Object.<anonymous> (tests/auth.test.ts:42:15)', color: '#94a3b8' },
    { text: 'Test Suites: 1 failed, 1 total | Tests: 1 failed, 4 passed', color: '#fca5a5' },
  ];

  let termY = terminalY + 50;
  termLines.forEach(tl => {
    ctx.fillStyle = tl.color;
    ctx.fillText(tl.text, editorX + 16, termY);
    termY += 20;
  });
}

function renderAnalyticsDashboard(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Background
  ctx.fillStyle = '#0b0f19';
  ctx.fillRect(0, 0, w, h);

  // Top Navigation Bar
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, w, 56);
  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 16px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('⚡ Nexus Analytics — Painel Executivo', 24, 34);

  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Período: Últimos 30 dias | Atualizado há 2 min', w - 24, 34);

  // KPI Cards
  const cards = [
    { title: 'Faturamento Total', value: 'R$ 142.850', badge: '+18.4%', badgeColor: '#22c55e', note: 'vs. mês anterior' },
    { title: 'Usuários Ativos (MAU)', value: '18.420', badge: '-6.2% ⚠️', badgeColor: '#ef4444', note: 'Alerta de queda' },
    { title: 'Taxa de Conversão', value: '4.82%', badge: '+1.1%', badgeColor: '#22c55e', note: 'Meta: 4.50%' },
    { title: 'Ticket Médio', value: 'R$ 286,40', badge: '+4.3%', badgeColor: '#22c55e', note: 'Em alta' },
  ];

  const cardW = (w - 48 - (cards.length - 1) * 16) / cards.length;
  const cardY = 76;
  const cardH = 110;

  cards.forEach((c, idx) => {
    const cx = 24 + idx * (cardW + 16);
    ctx.fillStyle = '#1f2937';
    ctx.beginPath();
    ctx.roundRect(cx, cardY, cardW, cardH, 8);
    ctx.fill();

    ctx.fillStyle = '#9ca3af';
    ctx.font = '12px Inter, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(c.title, cx + 16, cardY + 28);

    ctx.fillStyle = '#f9fafb';
    ctx.font = 'bold 22px Inter, sans-serif';
    ctx.fillText(c.value, cx + 16, cardY + 62);

    ctx.fillStyle = c.badgeColor;
    ctx.font = 'bold 12px Inter, sans-serif';
    ctx.fillText(c.badge, cx + 16, cardY + 90);

    ctx.fillStyle = '#6b7280';
    ctx.font = '11px Inter, sans-serif';
    ctx.fillText(c.note, cx + 80, cardY + 90);
  });

  // Chart Section
  const chartY = 206;
  const chartW = w * 0.62;
  const chartH = h - chartY - 24;

  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.roundRect(24, chartY, chartW, chartH, 8);
  ctx.fill();

  ctx.fillStyle = '#f9fafb';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Evolução de Vendas Diárias (R$)', 44, chartY + 32);

  // Draw simulated line chart
  const points = [
    { x: 50, y: 320 }, { x: 120, y: 290 }, { x: 190, y: 310 },
    { x: 260, y: 260 }, { x: 330, y: 270 }, { x: 400, y: 240 },
    { x: 470, y: 220 }, { x: 540, y: 250 }, { x: 610, y: 190 },
    { x: 680, y: 170 }, { x: 740, y: 180 },
  ];

  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((p, i) => {
    const px = 44 + (p.x / 760) * (chartW - 60);
    const py = chartY + 70 + (p.y / 360) * (chartH - 120);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();

  // Highlight highest sales point
  const highPoint = points[9];
  const hx = 44 + (highPoint.x / 760) * (chartW - 60);
  const hy = chartY + 70 + (highPoint.y / 360) * (chartH - 120);
  ctx.fillStyle = '#38bdf8';
  ctx.beginPath();
  ctx.arc(hx, hy, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#38bdf8';
  ctx.font = 'bold 11px Inter, sans-serif';
  ctx.fillText('Pico: R$ 8.920', hx - 30, hy - 14);

  // Right Side Table: Top Products
  const tableX = 24 + chartW + 16;
  const tableW = w - tableX - 24;
  const tableH = chartH;

  ctx.fillStyle = '#1f2937';
  ctx.beginPath();
  ctx.roundRect(tableX, chartY, tableW, tableH, 8);
  ctx.fill();

  ctx.fillStyle = '#f9fafb';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.fillText('Top Categorias', tableX + 20, chartY + 32);

  const categories = [
    { name: 'Hardware & Peças', share: '42%', color: '#38bdf8' },
    { name: 'Acessórios & Fones', share: '28%', color: '#818cf8' },
    { name: 'Monitores 4K', share: '18%', color: '#34d399' },
    { name: 'Software & Licenças', share: '12%', color: '#f472b6' },
  ];

  let catY = chartY + 70;
  categories.forEach(cat => {
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText(cat.name, tableX + 20, catY);

    ctx.fillStyle = cat.color;
    ctx.font = 'bold 13px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(cat.share, tableX + tableW - 20, catY);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#374151';
    ctx.fillRect(tableX + 20, catY + 8, tableW - 40, 6);

    ctx.fillStyle = cat.color;
    ctx.fillRect(tableX + 20, catY + 8, (tableW - 40) * (parseInt(cat.share) / 100), 6);

    catY += 50;
  });
}

function renderEcommerceCheckout(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, w, h);

  // Top Header
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, 60);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px Inter, system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('🛍️ TechStore — Finalização de Compra', 32, 38);

  ctx.fillStyle = '#64748b';
  ctx.font = '13px Inter, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('Etapa 2 de 3: Pagamento & Entrega', w - 32, 38);

  // Left Column: Items in Cart
  const leftW = w * 0.58;
  const startY = 84;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(32, startY, leftW, h - startY - 32, 8);
  ctx.fill();

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 15px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('Itens no Carrinho (2 produtos)', 52, startY + 36);

  const items = [
    { title: 'Monitor Gamer 27" Curvo 165Hz QHD', qty: '1 un.', price: 'R$ 1.299,00' },
    { title: 'Headset Sem Fio Noise Cancelling Pro', qty: '1 un.', price: 'R$ 499,00' },
  ];

  let itemY = startY + 70;
  items.forEach(it => {
    ctx.fillStyle = '#f1f5f9';
    ctx.fillRect(52, itemY, 60, 60);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.fillText(it.title, 126, itemY + 26);

    ctx.fillStyle = '#64748b';
    ctx.font = '12px Inter, sans-serif';
    ctx.fillText(`Quantidade: ${it.qty}`, 126, itemY + 48);

    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 14px Inter, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(it.price, 32 + leftW - 32, itemY + 36);
    ctx.textAlign = 'left';

    itemY += 80;
  });

  // Right Column: Order Summary & Coupon
  const rightX = 32 + leftW + 24;
  const rightW = w - rightX - 32;

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(rightX, startY, rightW, h - startY - 32, 8);
  ctx.fill();

  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 16px Inter, sans-serif';
  ctx.fillText('Resumo do Pedido', rightX + 24, startY + 36);

  // Pricing lines
  const priceRows = [
    { label: 'Subtotal dos produtos', val: 'R$ 1.798,00' },
    { label: 'Frete Expresso', val: 'Grátis' },
    { label: 'Desconto (Cupom)', val: '- R$ 0,00' },
  ];

  let rowY = startY + 80;
  priceRows.forEach(pr => {
    ctx.fillStyle = '#475569';
    ctx.font = '13px Inter, sans-serif';
    ctx.fillText(pr.label, rightX + 24, rowY);

    ctx.textAlign = 'right';
    ctx.fillStyle = pr.val === 'Grátis' ? '#16a34a' : '#1e293b';
    ctx.fillText(pr.val, rightX + rightW - 24, rowY);
    ctx.textAlign = 'left';

    rowY += 28;
  });

  // Total
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(rightX + 24, rowY + 6);
  ctx.lineTo(rightX + rightW - 24, rowY + 6);
  ctx.stroke();

  rowY += 34;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 17px Inter, sans-serif';
  ctx.fillText('Total', rightX + 24, rowY);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#2563eb';
  ctx.font = 'bold 18px Inter, sans-serif';
  ctx.fillText('R$ 1.798,00', rightX + rightW - 24, rowY);
  ctx.textAlign = 'left';

  // Coupon Section (IMPORTANT for visual assistant guidance!)
  rowY += 46;
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 13px Inter, sans-serif';
  ctx.fillText('Possui um Cupom de Desconto?', rightX + 24, rowY);

  rowY += 12;
  // Coupon Input Box
  const inputW = rightW - 48 - 90;
  ctx.fillStyle = '#f8fafc';
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(rightX + 24, rowY, inputW, 38, 6);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = '#94a3b8';
  ctx.font = '13px Inter, sans-serif';
  ctx.fillText('Ex: TECHPROMO10', rightX + 36, rowY + 24);

  // Apply Coupon Button
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.roundRect(rightX + 24 + inputW + 8, rowY, 82, 38, 6);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Aplicar', rightX + 24 + inputW + 8 + 41, rowY + 24);
  ctx.textAlign = 'left';

  // Checkout Button
  rowY += 60;
  ctx.fillStyle = '#2563eb';
  ctx.beginPath();
  ctx.roundRect(rightX + 24, rowY, rightW - 48, 44, 8);
  ctx.fill();

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Prosseguir para o Pagamento ➜', rightX + rightW / 2, rowY + 27);
  ctx.textAlign = 'left';
}
