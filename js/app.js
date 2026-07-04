const FONT_PACKS = {
  moderno:  {label:'Moderno',  display:"'Poppins',sans-serif",         body:"'Inter',sans-serif",       previewDisplay:'Poppins',      previewBody:'Inter'},
  editorial:{label:'Editorial',display:"'Playfair Display',serif",     body:"'Source Sans 3',sans-serif",previewDisplay:'Playfair Display',previewBody:'Source Sans 3'},
  tech:     {label:'Tech',     display:"'Space Grotesk',sans-serif",   body:"'IBM Plex Sans',sans-serif",previewDisplay:'Space Grotesk',previewBody:'IBM Plex Sans'},
  classico: {label:'Clássico', display:"'Merriweather',serif",         body:"'Lato',sans-serif",         previewDisplay:'Merriweather', previewBody:'Lato'},
};

const DEFAULT_SETTINGS = {
  businessName:'Sabor Express',
  primaryColor:'#0B5D52',
  accentColor:'#F2A93B',
  fontPack:'moderno',
  deliveryMin:35,
  deliveryMax:55,
  responseTimeoutMinutes:10,
  paymentTimeoutMinutes:5,
  storeOpen:true,
  openTime:'18:00',
  closeTime:'23:00',
};

const DEFAULT_MENU = [
  {id:'m1', name:'X-Burger Clássico', price:22.90, available:true},
  {id:'m2', name:'X-Bacon Duplo', price:26.90, available:true},
  {id:'m3', name:'Batata Frita G', price:14.90, available:true},
  {id:'m4', name:'Refrigerante Lata', price:6.00, available:true},
  {id:'m5', name:'Combo Duplo + Batata + Refri', price:39.90, available:true},
];

const STEP_LABELS = {
  start:'Novo contato', menu:'Vendo cardápio', collecting_items:'Escolhendo itens',
  ask_name:'Informando nome', ask_phone:'Informando telefone', ask_address:'Informando endereço',
  pre_payment:'Antes do pagamento', with_agent:'Com atendente', awaiting_payment:'Aguardando pagamento',
  received:'Pedido recebido pela loja', preparing:'Em preparo', out_for_delivery:'Saiu para entrega', delivered:'Entregue',
  expired:'Expirada', cancelled:'Cancelada'
};

const ORDER_BADGE = {
  'Aguardando pagamento':'amber', 'Pedido recebido':'blue', 'Em preparo':'teal', 'Saiu para entrega':'purple',
  'Entregue':'green', 'Cancelado':'gray', 'Expirado':'red'
};

const WAITING_ON_CUSTOMER_STEPS = ['menu','collecting_items','ask_name','ask_phone','ask_address','pre_payment','with_agent'];
const NO_GENERIC_TIMEOUT_STEPS = ['delivered','expired','cancelled','start','received','preparing','out_for_delivery','awaiting_payment'];

let state = {
  settings: {...DEFAULT_SETTINGS},
  menuItems: [...DEFAULT_MENU],
  orders: [],
  orderHistory: [],
  conversations: {},
  appMode: 'admin',
  activeTab:'orders',
  activeConvId:null,
  clientPhone:null,
  historyFilter:'all',
  historyExpanded:{},
};

const TABS = [
  {id:'orders', label:'Pedidos', icon:'🧾'},
  {id:'menu', label:'Cardápio', icon:'🍔'},
  {id:'attendance', label:'Atendimento', icon:'🎧'},
  {id:'history', label:'Histórico', icon:'📜'},
  {id:'appearance', label:'Aparência', icon:'🎨'},
];

async function loadKey(key, fallback){
  try{
    const r = await window.storage.get(key);
    if(r && r.value) return JSON.parse(r.value);
    return fallback;
  }catch(e){ return fallback; }
}
async function saveKey(key, value){
  try{ await window.storage.set(key, JSON.stringify(value)); }catch(e){ console.error('storage save failed', key, e); }
}
async function loadAll(){
  state.settings = {...DEFAULT_SETTINGS, ...(await loadKey('settings', {}))};
  state.menuItems = await loadKey('menu-items', [...DEFAULT_MENU]);
  state.orders = await loadKey('orders', []);
  state.orderHistory = await loadKey('order-history', []);
  state.conversations = await loadKey('conversations', {});
  state.clientPhone = await loadKey('client-phone', null);
  render();
}
function saveSettings(){ saveKey('settings', state.settings); }
function saveMenu(){ saveKey('menu-items', state.menuItems); }
function saveOrders(){ saveKey('orders', state.orders); }
function saveConversations(){ saveKey('conversations', state.conversations); }
function saveHistory(){ saveKey('order-history', state.orderHistory); }

function uid(prefix){ return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function formatMoney(v){ return 'R$ ' + (Number(v)||0).toFixed(2).replace('.',','); }
function formatTime(ts){ const d = new Date(ts); return d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}); }
function formatDate(ts){ const d = new Date(ts); return d.toLocaleDateString('pt-BR'); }
function escapeHtml(str){
  return String(str==null?'':str).replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[s]));
}
function renderMsgText(text){
  let t = escapeHtml(text);
  t = t.replace(/\*(.+?)\*/g, '<strong>$1</strong>');
  t = t.replace(/\n/g, '<br>');
  return t;
}
function applyTheme(){
  const r = document.documentElement.style;
  r.setProperty('--primary', state.settings.primaryColor);
  r.setProperty('--primary-light', state.settings.primaryColor + '1f');
  r.setProperty('--accent', state.settings.accentColor);
  r.setProperty('--accent-light', state.settings.accentColor + '26');
  const pack = FONT_PACKS[state.settings.fontPack] || FONT_PACKS.moderno;
  r.setProperty('--font-display', pack.display);
  r.setProperty('--font-body', pack.body);
  document.querySelectorAll('.js-brand-name').forEach(el => el.textContent = state.settings.businessName);
  document.querySelectorAll('.js-brand-logo').forEach(el => el.textContent = (state.settings.businessName||'?').trim().charAt(0).toUpperCase());
}

function countNeedsAgent(){ return Object.values(state.conversations).filter(c=>c.needsAgent).length; }

function render(){
  const app = document.getElementById('app');
  if(state.appMode === 'client'){
    app.innerHTML = clientShellHTML();
    applyTheme();
    if(state.settings.storeOpen) renderClientChat();
  } else {
    app.innerHTML = adminShellHTML();
    applyTheme();
    renderOrders();
    renderMenu();
    renderAttendance();
    renderHistory();
    renderAppearance();
  }
}
function goToClient(){
  state.appMode = 'client';
  ensureClientSession();
  render();
}
function goToAdmin(){
  state.appMode = 'admin';
  render();
}
function toggleStore(){
  state.settings.storeOpen = !state.settings.storeOpen;
  saveSettings();
  render();
}
function goToFirstPendingAttendance(){
  const c = Object.values(state.conversations).find(c=>c.needsAgent);
  state.activeTab = 'attendance';
  if(c) state.activeConvId = c.phone;
  render();
}

function adminShellHTML(){
  const pendingCount = countNeedsAgent();
  const storeOpen = state.settings.storeOpen;
  return `
    <header class="topbar">
      <div class="brand">
        <div class="logo">
          <img src="logo.png" alt="Logo">
        </div>
        <div>
          <div class="name js-brand-name">${escapeHtml(state.settings.businessName)}</div>
          <div class="sub">Painel administrativo</div>
        </div>
      </div>
      <div class="topbar-right">
        <button class="btn store ${storeOpen?'open':'closed'}" onclick="toggleStore()">${storeOpen ? '🔴 Fechar Loja / Finalizar Operações' : '🟢 Reabrir Loja'}</button>
        <button class="link-btn" onclick="goToClient()">🛍️ Ver como cliente (Fazer Pedido)</button>
        <nav class="tabs" id="tabs-nav">${TABS.map(t => `<button class="${state.activeTab===t.id?'active':''}" onclick="switchTab('${t.id}')">${t.icon} ${t.label} ${t.id==='attendance' && pendingCount>0 ? `<span class="nav-badge">${pendingCount}</span>` : ''}</button>`).join('')}</nav>
      </div>
    </header>
    <main id="main">
      ${pendingCount>0 ? `<div class="alert-bar"><span>🔔 ${pendingCount} cliente(s) aguardando atendimento</span><button class="btn primary sm" onclick="goToFirstPendingAttendance()">Ver</button></div>` : ''}
      <section class="tab-content ${state.activeTab==='orders'?'active':''}" id="tab-orders"></section>
      <section class="tab-content ${state.activeTab==='menu'?'active':''}" id="tab-menu"></section>
      <section class="tab-content ${state.activeTab==='attendance'?'active':''}" id="tab-attendance"></section>
      <section class="tab-content ${state.activeTab==='history'?'active':''}" id="tab-history"></section>
      <section class="tab-content ${state.activeTab==='appearance'?'active':''}" id="tab-appearance"></section>
    </main>
  `;
}
function switchTab(id){ state.activeTab = id; render(); }

function renderOrders(){
  const el = document.getElementById('tab-orders'); if(!el) return;
  const orders = [...state.orders].sort((a,b)=>b.createdAt-a.createdAt);
  el.innerHTML = `
    <h2 class="section-title">Pedidos</h2>
    <p class="section-sub">Acompanhe e avance o status de cada pedido recebido pelo bot.</p>
    <div class="card">
      ${orders.length===0 ? `<div class="empty">Nenhum pedido ainda. Clique em <strong>Ver como cliente</strong> para simular um pedido pelo chat.</div>` : `
      <table class="orders">
        <thead><tr>
          <th>Cliente</th><th>Itens</th><th>Total</th><th>Status</th><th>Criado</th><th>Ações</th>
        </tr></thead>
        <tbody>
          ${orders.map(o => `
            <tr>
              <td><strong>${escapeHtml(o.name||'—')}</strong><br><span style="color:var(--ink-soft);font-size:12px">${escapeHtml(o.phone)}</span></td>
              <td>${o.items.map(i=>`${i.qty}x ${escapeHtml(i.name)}`).join('<br>')}</td>
              <td><strong>${formatMoney(o.total)}</strong></td>
              <td><span class="badge ${ORDER_BADGE[o.status]||'gray'}">${escapeHtml(o.status)}</span></td>
              <td style="font-size:12px;color:var(--ink-soft)">${formatTime(o.createdAt)}</td>
              <td>
                <div class="btn-row">
                  <button class="btn ghost sm" onclick="openConversationFromOrder('${o.phone}')">Ver conversa</button>
                  ${o.status==='Aguardando pagamento' ? `<button class="btn primary sm" onclick="confirmPaymentManually('${o.id}')">Confirmar pagamento</button>` : ''}
                  ${['Pedido recebido','Em preparo','Saiu para entrega'].includes(o.status) ? `<button class="btn ghost sm" onclick="printOrder('${o.id}')">🖨️ Imprimir</button>` : ''}
                  ${o.status==='Pedido recebido' ? `<button class="btn primary sm" onclick="startPreparing('${o.id}')">Iniciar preparo</button>` : ''}
                  ${o.status==='Em preparo' ? `<button class="btn primary sm" onclick="releaseOrder('${o.id}')">Liberar / saiu p/ entrega</button>` : ''}
                  ${o.status==='Saiu para entrega' ? `<button class="btn primary sm" onclick="markDelivered('${o.id}')">Marcar entregue</button>` : ''}
                  ${['Aguardando pagamento','Pedido recebido','Em preparo','Saiu para entrega'].includes(o.status) ? `<button class="btn danger sm" onclick="cancelOrder('${o.id}')">Cancelar</button>` : ''}
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>`}
    </div>
  `;
}
function findConvByPhone(phone){ return state.conversations[phone]; }
function openConversationFromOrder(phone){
  state.activeConvId = phone;
  state.activeTab = 'attendance';
  render();
}
function confirmPaymentManually(orderId){
  const order = state.orders.find(o=>o.id===orderId); if(!order) return;
  order.status = 'Pedido recebido'; order.paidAt = Date.now();
  const conv = findConvByPhone(order.phone);
  if(conv && conv.step==='awaiting_payment'){
    conv.step = 'received';
    conv.paymentDeadline = null;
    pushBotMessage(conv, `Pagamento confirmado! ✅\nSeu pedido foi recebido pela loja. Em breve começaremos o preparo! 🙌`);
  }
  saveOrders(); saveConversations(); render();
}
function startPreparing(orderId){
  const order = state.orders.find(o=>o.id===orderId); if(!order) return;
  order.status = 'Em preparo';
  const conv = findConvByPhone(order.phone);
  if(conv){
    conv.step = 'preparing';
    pushBotMessage(conv, `Seu pedido está sendo preparado com carinho 👨‍🍳\n⏱️ Tempo estimado de entrega: ${state.settings.deliveryMin}–${state.settings.deliveryMax} minutos.`);
  }
  saveOrders(); saveConversations(); render();
}
function releaseOrder(orderId){
  const order = state.orders.find(o=>o.id===orderId); if(!order) return;
  order.status = 'Saiu para entrega';
  const conv = findConvByPhone(order.phone);
  if(conv){ conv.step = 'out_for_delivery'; pushBotMessage(conv, 'Seu pedido saiu para entrega! 🛵 Chega em breve.'); }
  saveOrders(); saveConversations(); render();
}
function markDelivered(orderId){
  const order = state.orders.find(o=>o.id===orderId); if(!order) return;
  order.status = 'Entregue'; order.deliveredAt = Date.now();
  const conv = findConvByPhone(order.phone);
  if(conv){ conv.step = 'delivered'; pushBotMessage(conv, 'Pedido entregue! Obrigado pela preferência 😊'); }
  state.orderHistory.push({
    id: order.id, name: order.name, phone: order.phone, contactPhone: order.contactPhone,
    address: order.address, items: order.items, total: order.total,
    createdAt: order.createdAt, deliveredAt: Date.now(),
    conversationLog: conv ? [...conv.log] : []
  });
  saveHistory();
  saveOrders(); saveConversations(); render();
}
function cancelOrder(orderId){
  const order = state.orders.find(o=>o.id===orderId); if(!order) return;
  order.status = 'Cancelado';
  const conv = findConvByPhone(order.phone);
  if(conv){ conv.step = 'cancelled'; conv.paymentDeadline = null; pushBotMessage(conv, 'Seu pedido foi cancelado. Qualquer dúvida, estamos à disposição.'); }
  saveOrders(); saveConversations(); render();
}
function pushBotMessage(conv, text){
  conv.log.push({from:'bot', text, time:Date.now()});
  conv.lastBotMessageAt = Date.now();
}

function printOrder(orderId){
  const order = state.orders.find(o=>o.id===orderId); if(!order) return;
  const area = document.getElementById('print-area');
  area.innerHTML = `
    <div style="max-width:380px;font-family:Arial,sans-serif;font-size:13px;color:#000;">
      <h2 style="margin:0 0 2px;">${escapeHtml(state.settings.businessName)}</h2>
      <div style="font-size:11px;color:#444;margin-bottom:8px;">Pedido #${order.id.slice(-6).toUpperCase()}</div>
      <hr>
      <div><strong>Cliente:</strong> ${escapeHtml(order.name||'-')}</div>
      <div><strong>Telefone:</strong> ${escapeHtml(order.contactPhone||order.phone||'-')}</div>
      <div><strong>Endereço:</strong> ${escapeHtml(order.address||'-')}</div>
      <hr>
      ${order.items.map(i=>`<div>${i.qty}x ${escapeHtml(i.name)} — ${formatMoney(i.price*i.qty)}</div>`).join('')}
      <hr>
      <div style="font-weight:bold;">Total: ${formatMoney(order.total)}</div>
      <div style="margin-top:8px;font-size:11px;">${formatDate(order.createdAt)} às ${formatTime(order.createdAt)}</div>
    </div>
  `;
  setTimeout(()=>window.print(), 80);
}

function renderMenu(){
  const el = document.getElementById('tab-menu'); if(!el) return;
  const available = state.menuItems.filter(m=>m.available);
  el.innerHTML = `
    <h2 class="section-title">Cardápio</h2>
    <p class="section-sub">Os números usados pelo bot seguem a ordem dos itens disponíveis abaixo.</p>
    <div class="card menu-grid">
      ${state.menuItems.map((m)=>`
        <div class="menu-item" style="border-bottom:1px solid var(--line)">
          <div class="num">${m.available ? (available.indexOf(m)+1) : '–'}</div>
          <input type="text" value="${escapeHtml(m.name)}" oninput="updateMenuItemText('${m.id}','name',this.value)">
          <div class="price-wrap">R$ <input type="number" step="0.10" min="0" value="${m.price}" oninput="updateMenuItemText('${m.id}','price',this.value)"></div>
          <label class="toggle" title="Disponível">
            <input type="checkbox" ${m.available?'checked':''} onchange="toggleMenuItemAvailable('${m.id}',this.checked)">
            <span class="slider"></span>
          </label>
          <button class="btn danger sm" onclick="removeMenuItem('${m.id}')">Remover</button>
        </div>
      `).join('')}
      <div class="add-item-row">
        <input type="text" name="name" placeholder="Nome do novo item" id="new-item-name">
        <input type="number" name="price" placeholder="Preço" step="0.10" min="0" id="new-item-price">
        <button class="btn primary" onclick="addMenuItem()">+ Adicionar item</button>
      </div>
    </div>
  `;
}
function updateMenuItemText(id, field, value){
  const item = state.menuItems.find(m=>m.id===id); if(!item) return;
  item[field] = field==='price' ? (parseFloat(value)||0) : value;
  saveMenu();
}
function toggleMenuItemAvailable(id, checked){
  const item = state.menuItems.find(m=>m.id===id); if(!item) return;
  item.available = checked;
  saveMenu(); renderMenu();
}
function removeMenuItem(id){
  state.menuItems = state.menuItems.filter(m=>m.id!==id);
  saveMenu(); renderMenu();
}
function addMenuItem(){
  const nameEl = document.getElementById('new-item-name');
  const priceEl = document.getElementById('new-item-price');
  const name = nameEl.value.trim(); const price = parseFloat(priceEl.value)||0;
  if(!name) return;
  state.menuItems.push({id:uid('m'), name, price, available:true});
  saveMenu(); renderMenu();
}

function renderAppearance(){
  const el = document.getElementById('tab-appearance'); if(!el) return;
  const s = state.settings;
  el.innerHTML = `
    <h2 class="section-title">Aparência</h2>
    <p class="section-sub">Personalize cores, tipografia e regras de tempo. Tudo é salvo automaticamente.</p>
    <div class="appearance-grid">
      <div class="card" style="padding:18px">
        <div class="field">
          <label>Nome do negócio</label>
          <input type="text" id="input-business-name" value="${escapeHtml(s.businessName)}" oninput="updateBusinessName(this.value)">
        </div>
        <div class="field">
          <label>Cores</label>
          <div class="color-row">
            <div class="color-pick"><input type="color" value="${s.primaryColor}" oninput="updateSetting('primaryColor', this.value)"><span>Primária</span></div>
            <div class="color-pick"><input type="color" value="${s.accentColor}" oninput="updateSetting('accentColor', this.value)"><span>Destaque</span></div>
          </div>
        </div>
        <div class="field">
          <label>Combinação de fontes</label>
          <div class="font-cards">
            ${Object.entries(FONT_PACKS).map(([key,p])=>`
              <div class="font-card ${s.fontPack===key?'active':''}" onclick="selectFontPack('${key}')">
                <div class="fc-title" style="font-family:'${p.previewDisplay}',sans-serif">${p.label}</div>
                <div class="fc-sub" style="font-family:'${p.previewBody}',sans-serif">${p.previewDisplay} + ${p.previewBody}</div>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="field">
          <label>Horário de funcionamento</label>
          <div class="two-col">
            <input type="text" value="${escapeHtml(s.openTime)}" oninput="updateSetting('openTime', this.value)" placeholder="Abre (ex: 18:00)">
            <input type="text" value="${escapeHtml(s.closeTime)}" oninput="updateSetting('closeTime', this.value)" placeholder="Fecha (ex: 23:00)">
          </div>
          <div style="font-size:11.5px;color:var(--ink-soft);margin-top:4px">Exibido no site do cliente quando a loja estiver fechada.</div>
        </div>
        <div class="field">
          <label>Tempo estimado de entrega (minutos)</label>
          <div class="two-col">
            <input type="number" min="1" value="${s.deliveryMin}" oninput="updateSetting('deliveryMin', parseInt(this.value)||0)" placeholder="Mínimo">
            <input type="number" min="1" value="${s.deliveryMax}" oninput="updateSetting('deliveryMax', parseInt(this.value)||0)" placeholder="Máximo">
          </div>
        </div>
        <div class="field">
          <label>Tempo limite de resposta do cliente no chat (minutos)</label>
          <input type="number" min="0.5" step="0.5" value="${s.responseTimeoutMinutes}" oninput="updateSetting('responseTimeoutMinutes', parseFloat(this.value)||0)">
          <div style="font-size:11.5px;color:var(--ink-soft);margin-top:4px">Padrão: 10 min. Diminua apenas para testar a expiração mais rápido.</div>
        </div>
        <div class="field">
          <label>Prazo para pagamento após enviar o Pix (minutos)</label>
          <input type="number" min="0.5" step="0.5" value="${s.paymentTimeoutMinutes}" oninput="updateSetting('paymentTimeoutMinutes', parseFloat(this.value)||0)">
          <div style="font-size:11.5px;color:var(--ink-soft);margin-top:4px">Padrão: 5 min. Se o cliente não pagar a tempo, o pedido é cancelado automaticamente.</div>
        </div>
      </div>
      <div>
        <div class="phone-mock">
          <div class="pm-head">
            <div class="pm-name js-brand-name">${escapeHtml(s.businessName)}</div>
            <div class="pm-status">online</div>
          </div>
          <div class="pm-body">
            <div class="bubble bot">Olá! 👋 Seja bem-vindo(a) à <strong class="js-brand-name">${escapeHtml(s.businessName)}</strong>!<br>1 - X-Burger Clássico — R$ 22,90</div>
            <div class="bubble cliente">1</div>
            <div class="bubble bot">Perfeito! Qual é o seu nome completo?</div>
          </div>
        </div>
      </div>
    </div>
  `;
}
function updateSetting(key, value){
  state.settings[key] = value;
  applyTheme();
  saveSettings();
}
function updateBusinessName(value){
  state.settings.businessName = value;
  applyTheme();
  saveSettings();
}
function selectFontPack(key){
  state.settings.fontPack = key;
  applyTheme();
  saveSettings();
  renderAppearance();
}

function buildMenuText(){
  const available = state.menuItems.filter(m=>m.available);
  const lines = available.map((m,i)=> `*${i+1}* - ${m.name} — ${formatMoney(m.price)}`);
  return `Olá! 👋 Seja bem-vindo(a) à *${state.settings.businessName}*!\n\nEscolha os itens do seu pedido pelo número (pode enviar mais de um separado por vírgula, ex: 1,3):\n\n${lines.join('\n')}\n\nQuando terminar, digite *Sim* para finalizar.`;
}
function cartTotal(conv){
  return conv.cart.reduce((sum,c)=>{ const item = state.menuItems.find(m=>m.id===c.id); return sum + (item?item.price*c.qty:0); }, 0);
}
function cartToText(conv){
  if(!conv.cart.length) return 'Carrinho vazio.';
  const lines = conv.cart.map(c=>{
    const item = state.menuItems.find(m=>m.id===c.id);
    return `${c.qty}x ${item?item.name:'Item removido'} — ${formatMoney((item?item.price:0)*c.qty)}`;
  });
  return lines.join('\n') + `\n*Total: ${formatMoney(cartTotal(conv))}*`;
}
function parseItemSelection(text){
  const available = state.menuItems.filter(m=>m.available);
  const nums = text.split(/[,\s]+/).map(s=>s.trim()).filter(Boolean);
  const added=[]; const invalid=[];
  nums.forEach(n=>{
    const idx = parseInt(n,10);
    if(!isNaN(idx) && idx>=1 && idx<=available.length) added.push(available[idx-1]);
    else invalid.push(n);
  });
  return {added, invalid};
}
function buildPaymentText(conv){
  const total = cartTotal(conv);
  const key = ('contato@' + (state.settings.businessName||'loja').toLowerCase().replace(/[^a-z0-9]+/g,'') + '.com');
  return `Para concluir, realize o pagamento via Pix:\n🔑 Chave Pix: ${key}\n💰 Valor: ${formatMoney(total)}\n\nVocê tem *${state.settings.paymentTimeoutMinutes} minutos* para pagar. Quando finalizar, digite *paguei* para confirmarmos.`;
}
function createOrderFromConversation(conv){
  const items = conv.cart.map(c=>{ const item = state.menuItems.find(m=>m.id===c.id); return {id:c.id, name:item?item.name:'Item', price:item?item.price:0, qty:c.qty}; });
  const order = {
    id: uid('ped_'), phone: conv.phone, name: conv.name, contactPhone: conv.contactPhone,
    address: conv.address, items, total: cartTotal(conv), status:'Aguardando pagamento', createdAt: Date.now()
  };
  state.orders.push(order);
  conv.orderId = order.id;
  saveOrders();
}
function markOrderReceived(conv){
  const order = state.orders.find(o=>o.id===conv.orderId);
  if(order){ order.status='Pedido recebido'; order.paidAt=Date.now(); saveOrders(); }
}
function enterAwaitingPayment(conv){
  conv.step = 'awaiting_payment';
  if(!conv.orderId) createOrderFromConversation(conv);
  conv.paymentDeadline = Date.now() + (state.settings.paymentTimeoutMinutes||5) * 60000;
  return buildPaymentText(conv);
}
function handleCustomerMessage(conv, rawText){
  const text = rawText.trim();
  const lower = text.toLowerCase();
  let reply = '';
  switch(conv.step){
    case 'start': {
      conv.cart = [];
      conv.step = 'menu';
      reply = buildMenuText();
      break;
    }
    case 'menu':
    case 'collecting_items': {
      if(lower === 'sim'){
        if(!conv.cart.length){ reply = 'Seu carrinho ainda está vazio. Escolha ao menos um item pelo número.'; break; }
        conv.step = 'ask_name';
        reply = `Resumo do pedido:\n${cartToText(conv)}\n\nPara continuar, qual é o seu nome completo?`;
      } else {
        const {added, invalid} = parseItemSelection(text);
        added.forEach(item=>{
          const existing = conv.cart.find(c=>c.id===item.id);
          if(existing) existing.qty++; else conv.cart.push({id:item.id, qty:1});
        });
        conv.step = 'collecting_items';
        reply = '';
        if(added.length) reply += `Adicionado: ${added.map(a=>a.name).join(', ')}.\n`;
        if(invalid.length) reply += 'Item não disponível no momento.\n';
        reply += 'Digite mais números para adicionar ou *Sim* para finalizar.';
      }
      break;
    }
    case 'ask_name': {
      conv.name = text;
      conv.step = 'ask_phone';
      reply = `Obrigado, ${conv.name}! Agora, me informe um número de telefone para contato.`;
      break;
    }
    case 'ask_phone': {
      conv.contactPhone = text;
      conv.step = 'ask_address';
      reply = 'Perfeito. Qual o endereço completo para entrega?';
      break;
    }
    case 'ask_address': {
      conv.address = text;
      conv.step = 'pre_payment';
      reply = `Aqui está o resumo do seu pedido:\n\n${cartToText(conv)}\n\n*Cliente:* ${conv.name}\n*Telefone:* ${conv.contactPhone}\n*Endereço:* ${conv.address}\n\nAntes de prosseguir com o pagamento, você tem alguma dúvida?\n*1* - Falar com um atendente\n*2* - Continuar para o pagamento`;
      break;
    }
    case 'pre_payment': {
      if(text==='1'){
        conv.step = 'with_agent';
        conv.needsAgent = true;
        reply = 'Certo! Vou te conectar com um atendente, só um instante 👤';
      } else if(text==='2'){
        reply = enterAwaitingPayment(conv);
      } else {
        reply = 'Não entendi 🙏 Digite *1* para falar com um atendente ou *2* para continuar para o pagamento.';
      }
      break;
    }
    case 'with_agent': {
      return null;
    }
    case 'awaiting_payment': {
      if(lower.includes('paguei') || lower.includes('pago')){
        conv.step = 'received';
        conv.paymentDeadline = null;
        markOrderReceived(conv);
        reply = `Pagamento confirmado! ✅\nSeu pedido foi recebido pela loja. Em breve começaremos o preparo! 🙌`;
      } else {
        reply = 'Ainda estou aguardando a confirmação do pagamento. Assim que pagar, digite *paguei* 🙂';
      }
      break;
    }
    case 'received': {
      reply = 'Seu pedido já foi recebido pela loja e logo entrará em preparo. Aguarde só um instantinho! 😊';
      break;
    }
    case 'preparing': {
      reply = `Seu pedido está sendo preparado com carinho 👨‍🍳 Tempo estimado: ${state.settings.deliveryMin}–${state.settings.deliveryMax} min.`;
      break;
    }
    case 'out_for_delivery': {
      reply = 'Seu pedido já saiu para entrega e chega em breve! 🛵';
      break;
    }
    case 'delivered':
    case 'expired':
    case 'cancelled': {
      conv.cart=[]; conv.name=null; conv.contactPhone=null; conv.address=null; conv.orderId=null; conv.needsAgent=false; conv.paymentDeadline=null;
      conv.step = 'menu';
      reply = buildMenuText();
      break;
    }
    default: {
      conv.step='menu'; conv.cart=[];
      reply = buildMenuText();
    }
  }
  return reply;
}

function renderAttendance(){
  const el = document.getElementById('tab-attendance'); if(!el) return;
  const convs = Object.values(state.conversations).sort((a,b)=>(b.lastCustomerMessageAt||b.createdAt)-(a.lastCustomerMessageAt||a.createdAt));
  const active = state.activeConvId ? state.conversations[state.activeConvId] : null;
  el.innerHTML = `
    <h2 class="section-title">Atendimento</h2>
    <p class="section-sub">Veja o histórico das conversas do bot com os clientes e responda quando um cliente pedir para falar com um atendente.</p>
    <div class="bot-layout">
      <div class="card conv-list">
        <div class="conv-list-head"><strong style="font-size:13px">Conversas</strong></div>
        ${convs.length===0 ? `<div class="empty">Nenhuma conversa ainda. Elas aparecem aqui quando um cliente usa o "Fazer Pedido".</div>` : convs.map(c=>`
          <div class="conv-item ${state.activeConvId===c.phone?'active':''}" onclick="selectAttendanceConversation('${c.phone}')">
            <div class="ci-top">
              <span>${escapeHtml(c.name || c.phone)}</span>
              ${c.needsAgent ? '<span class="dot orange"></span>' : (c.step==='expired' ? '<span class="dot red"></span>' : '')}
            </div>
            <div class="ci-step">${STEP_LABELS[c.step]||c.step}</div>
          </div>
        `).join('')}
      </div>
      <div class="card chat-wrap">
        ${active ? renderAttendanceChatPanel(active) : `<div class="chat-empty"><div style="font-size:26px">🎧</div>Selecione uma conversa para ver o histórico ou responder como atendente</div>`}
      </div>
    </div>
  `;
  if(active){ const body = document.getElementById('chat-body'); if(body) body.scrollTop = body.scrollHeight; }
}
function selectAttendanceConversation(phone){ state.activeConvId = phone; render(); }
function renderAttendanceChatPanel(conv){
  return `
    <div class="chat-head">
      <div>
        <div class="ch-name">${escapeHtml(conv.name || conv.phone)}</div>
        <div class="ch-step">${escapeHtml(conv.phone)} · ${STEP_LABELS[conv.step]||conv.step}</div>
      </div>
      ${conv.needsAgent ? `<button class="btn sm" style="background:#fff;color:var(--primary)" onclick="resumeBot('${conv.phone}')">Retomar bot ▶</button>` : ''}
    </div>
    ${conv.needsAgent ? `<div class="agent-banner"><span>👤 Cliente pediu para falar com um atendente</span></div>` : ''}
    <div class="chat-body" id="chat-body">
      ${conv.log.length===0 ? '<div class="chat-empty">Sem mensagens ainda.</div>' : conv.log.map(m=>`
        <div class="msg ${m.from}">
          ${m.from==='atendente' ? '<span class="tag">Atendente</span>' : ''}
          ${renderMsgText(m.text)}
          <span class="time">${formatTime(m.time)}</span>
        </div>
      `).join('')}
    </div>
    ${conv.needsAgent ? `
      <div class="chat-input-row">
        <input type="text" id="attendant-input" placeholder="Responder como atendente..." onkeydown="if(event.key==='Enter') sendAttendantMessage()">
        <button class="btn primary" onclick="sendAttendantMessage()">Enviar</button>
      </div>
    ` : `<div class="readonly-hint">O bot está cuidando desta conversa automaticamente. Você só pode responder quando o cliente pedir para falar com um atendente.</div>`}
  `;
}
function sendAttendantMessage(){
  const conv = state.activeConvId ? state.conversations[state.activeConvId] : null; if(!conv) return;
  const input = document.getElementById('attendant-input'); const text = input.value.trim(); if(!text) return;
  input.value = '';
  conv.log.push({from:'atendente', text, time:Date.now()});
  saveConversations(); render();
  const el = document.getElementById('attendant-input'); if(el) el.focus();
}
function resumeBot(phone){
  const conv = state.conversations[phone]; if(!conv) return;
  conv.needsAgent = false;
  const text = enterAwaitingPayment(conv);
  pushBotMessage(conv, text);
  saveConversations(); saveOrders(); render();
}

function filterHistoryList(list, filter){
  const now = new Date();
  return list.filter(h=>{
    const d = new Date(h.deliveredAt || h.createdAt);
    if(filter==='day') return d.toDateString()===now.toDateString();
    if(filter==='week'){ const diffDays=(now-d)/(1000*60*60*24); return diffDays<=7; }
    if(filter==='month') return d.getFullYear()===now.getFullYear() && d.getMonth()===now.getMonth();
    if(filter==='year') return d.getFullYear()===now.getFullYear();
    return true;
  });
}
function setHistoryFilter(f){ state.historyFilter = f; renderHistory(); }
function toggleHistoryAddress(id){
  state.historyExpanded[id] = state.historyExpanded[id] || {};
  state.historyExpanded[id].address = !state.historyExpanded[id].address;
  renderHistory();
}
function toggleHistoryConv(id){
  state.historyExpanded[id] = state.historyExpanded[id] || {};
  state.historyExpanded[id].conv = !state.historyExpanded[id].conv;
  renderHistory();
}
function renderHistory(){
  const el = document.getElementById('tab-history'); if(!el) return;
  const filtered = filterHistoryList(state.orderHistory, state.historyFilter).sort((a,b)=>(b.deliveredAt||b.createdAt)-(a.deliveredAt||a.createdAt));
  const filters = [['all','Tudo'],['day','Dias'],['week','Semanas'],['month','Meses'],['year','Anos']];
  el.innerHTML = `
    <h2 class="section-title">Histórico de Pedidos</h2>
    <p class="section-sub">Pedidos entregues, com endereço, telefone, valor, data e a conversa completa.</p>
    <div class="history-toolbar">
      ${filters.map(([key,label])=>`<button class="${state.historyFilter===key?'active':''}" onclick="setHistoryFilter('${key}')">${label}</button>`).join('')}
    </div>
    <div class="card">
      ${filtered.length===0 ? `<div class="empty">Nenhum pedido entregue neste período.</div>` : filtered.map(h=>{
        const exp = state.historyExpanded[h.id] || {};
        return `
        <div class="history-row">
          <div class="history-top">
            <div><strong>${escapeHtml(h.name||'—')}</strong> <span style="color:var(--ink-soft);font-size:12px">${escapeHtml(h.phone)}</span></div>
            <div style="font-weight:700">${formatMoney(h.total)}</div>
            <div style="font-size:12px;color:var(--ink-soft)">${formatDate(h.deliveredAt||h.createdAt)} · ${formatTime(h.deliveredAt||h.createdAt)}</div>
            <div class="btn-row">
              <button class="btn ghost sm" onclick="toggleHistoryAddress('${h.id}')">Endereço</button>
              <button class="btn ghost sm" onclick="toggleHistoryConv('${h.id}')">Ver conversa</button>
            </div>
          </div>
          ${exp.address ? `<div class="history-detail">📍 ${escapeHtml(h.address||'Endereço não informado')}</div>` : ''}
          ${exp.conv ? `<div class="history-detail">${h.conversationLog.map(m=>`<div class="history-conv-msg"><strong>${m.from}:</strong> ${renderMsgText(m.text)}</div>`).join('') || 'Sem mensagens registradas.'}</div>` : ''}
        </div>
      `;}).join('')}
    </div>
  `;
}

function ensureClientSession(){
  if(!state.clientPhone){
    state.clientPhone = '+55 91 9' + Math.floor(1000000 + Math.random()*8999999);
    saveKey('client-phone', state.clientPhone);
  }
  if(!state.conversations[state.clientPhone]){
    state.conversations[state.clientPhone] = {
      phone: state.clientPhone, step:'start', cart:[], name:null, contactPhone:null, address:null,
      orderId:null, needsAgent:false, paymentDeadline:null, log:[], createdAt:Date.now(), lastCustomerMessageAt:Date.now()
    };
    saveConversations();
  }
}
function newClientSession(){
  state.clientPhone = null;
  ensureClientSession();
  render();
}
function clientShellHTML(){
  if(!state.settings.storeOpen){
    return `
      <div class="client-shell">
        <div class="client-topbar">
          <div class="client-brand">
            <div class="logo js-brand-logo">S</div>
            <div class="name js-brand-name">${escapeHtml(state.settings.businessName)}</div>
          </div>
          <button class="link-btn" onclick="goToAdmin()">🛠️ painel administrativo</button>
        </div>
        <div class="client-card">
          <div class="closed-box">
            <div>
              <div style="font-size:40px;margin-bottom:10px;">🌙</div>
              <h3 style="font-family:var(--font-display);margin:0 0 6px;">Loja fechada no momento.</h3>
              <p style="color:var(--ink-soft);margin:0;">Abriremos novamente das ${escapeHtml(state.settings.openTime)} às ${escapeHtml(state.settings.closeTime)}.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }
  return `
    <div class="client-shell">
      <div class="client-topbar">
        <div class="client-brand">
          <div class="logo js-brand-logo">S</div>
          <div class="name js-brand-name">${escapeHtml(state.settings.businessName)}</div>
        </div>
        <div style="display:flex;gap:12px;align-items:center">
          <button class="link-btn" onclick="newClientSession()">novo cliente</button>
          <button class="link-btn" onclick="goToAdmin()">🛠️ painel administrativo</button>
        </div>
      </div>
      <div class="client-card">
        <div class="chat-head">
          <div>
            <div class="ch-name js-brand-name">${escapeHtml(state.settings.businessName)}</div>
            <div class="ch-step" id="client-step-label"></div>
          </div>
        </div>
        <div id="client-agent-banner"></div>
        <div class="chat-body" id="client-chat-body"></div>
        <div id="client-countdown" class="countdown"></div>
        <div class="chat-input-row">
          <input type="text" id="client-input" placeholder="Digite sua mensagem..." onkeydown="if(event.key==='Enter') sendClientMessage()">
          <button class="btn primary" onclick="sendClientMessage()">Enviar</button>
        </div>
      </div>
      <div class="client-footnote">Simulação do chat de WhatsApp — isso é o que o seu cliente vê e usa para fazer pedidos.</div>
    </div>
  `;
}
function renderClientChat(){
  const conv = state.conversations[state.clientPhone]; if(!conv) return;
  document.getElementById('client-step-label').textContent = STEP_LABELS[conv.step] || conv.step;
  document.getElementById('client-agent-banner').innerHTML = conv.needsAgent ? `<div class="agent-banner"><span>👤 Aguardando um atendente humano...</span></div>` : '';
  const body = document.getElementById('client-chat-body');
  body.innerHTML = conv.log.length===0
    ? '<div class="chat-empty">Diga "oi" para começar seu pedido 🙂</div>'
    : conv.log.map(m=>`
        <div class="msg ${m.from}">
          ${m.from==='atendente' ? '<span class="tag">Atendente</span>' : ''}
          ${renderMsgText(m.text)}
          <span class="time">${formatTime(m.time)}</span>
        </div>
      `).join('');
  body.scrollTop = body.scrollHeight;
  updateClientCountdown();
}
function updateClientCountdown(){
  const conv = state.conversations[state.clientPhone]; if(!conv) return;
  const cd = document.getElementById('client-countdown'); if(!cd) return;
  if(conv.step === 'awaiting_payment' && conv.paymentDeadline){
    const remaining = Math.max(0, conv.paymentDeadline - Date.now());
    const mm = Math.floor(remaining/60000); const ss = Math.floor((remaining%60000)/1000);
    cd.textContent = `⏱️ pagamento expira em ${mm}:${String(ss).padStart(2,'0')}`;
    return;
  }
  if(!WAITING_ON_CUSTOMER_STEPS.includes(conv.step)){ cd.textContent=''; return; }
  const timeoutMs = (state.settings.responseTimeoutMinutes||10) * 60000;
  const elapsed = Date.now() - (conv.lastCustomerMessageAt || conv.createdAt);
  const remaining = Math.max(0, timeoutMs - elapsed);
  const mm = Math.floor(remaining/60000); const ss = Math.floor((remaining%60000)/1000);
  cd.textContent = `⏱️ ${mm}:${String(ss).padStart(2,'0')}`;
}
function sendClientMessage(){
  const conv = state.conversations[state.clientPhone]; if(!conv) return;
  const input = document.getElementById('client-input'); const text = input.value.trim(); if(!text) return;
  input.value = '';
  conv.log.push({from:'cliente', text, time:Date.now()});
  conv.lastCustomerMessageAt = Date.now();
  const reply = handleCustomerMessage(conv, text);
  if(reply) pushBotMessage(conv, reply);
  saveConversations();
  renderClientChat();
  const el = document.getElementById('client-input'); if(el) el.focus();
}

function checkTimeouts(){
  const timeoutMs = (state.settings.responseTimeoutMinutes||10) * 60000;
  let changed = false;
  Object.values(state.conversations).forEach(conv=>{
    if(conv.step === 'awaiting_payment' && conv.paymentDeadline && Date.now() > conv.paymentDeadline){
      conv.step = 'expired';
      conv.needsAgent = false;
      conv.paymentDeadline = null;
      conv.log.push({from:'system', text:`⏰ Tempo para pagamento esgotado (${state.settings.paymentTimeoutMinutes} min). Pedido cancelado.`, time:Date.now()});
      if(conv.orderId){
        const order = state.orders.find(o=>o.id===conv.orderId);
        if(order && order.status==='Aguardando pagamento'){ order.status = 'Cancelado'; }
      }
      changed = true;
      return;
    }
    if(NO_GENERIC_TIMEOUT_STEPS.includes(conv.step)) return;
    const last = conv.lastCustomerMessageAt || conv.createdAt;
    if(Date.now() - last > timeoutMs){
      conv.step = 'expired';
      conv.needsAgent = false;
      conv.log.push({from:'system', text:`⏰ Conversa expirada — sem resposta do cliente por mais de ${state.settings.responseTimeoutMinutes} min.`, time:Date.now()});
      if(conv.orderId){
        const order = state.orders.find(o=>o.id===conv.orderId);
        if(order && !['Entregue','Cancelado','Saiu para entrega'].includes(order.status)){ order.status = 'Expirado'; }
      }
      changed = true;
    }
  });
  if(changed){ saveConversations(); saveOrders(); render(); }
  else if(state.appMode==='client'){ updateClientCountdown(); }
}
setInterval(checkTimeouts, 1000);

loadAll();
