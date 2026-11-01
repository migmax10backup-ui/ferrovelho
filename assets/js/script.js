/* =========================
   DADOS / CONFIGURAÇÃO
   ========================= */
const PRODUTOS_DEFAULT = {
  micha:   { nome: 'Micha (Lockpick)', img: 'assets/imgs/micha.png', receita: { aluminio: 6, cobre: 2, borracha: 3 }, preco: 1000 },
  c4:      { nome: 'C4 / Bomba Caseira', img: 'assets/imgs/c4.png', receita: { aluminio: 19, cobre: 2, plastico: 9 }, preco: 1500, faixa: { limite: 50, baixo: 1500, alto: 1300 } },
  placa:   { nome: 'Placa Veicular', img: 'assets/imgs/placa.png', receita: { aluminio: 20, plastico: 5 }, preco: 1200, faixa: { limite: 30, baixo: 1200, alto: 1000 } },
  pneu:    { nome: 'Pneu', img: 'assets/imgs/pneu.png', receita: { borracha: 12, aluminio: 2 }, preco: 500 },
  lataria: { nome: 'Reparo de Lataria', img: 'assets/imgs/kit-lataria.png', receita: { plastico: 5, vidro: 5, aluminio: 16 }, preco: 1000 },
  motor:   { nome: 'Reparo de Motor', img: 'assets/imgs/kit-motor.png', receita: { borracha: 6, cobre: 6, aluminio: 8 }, preco: 1000 },
  ticket:  { nome: 'Ticket', img: 'assets/imgs/ticket.png', receita: { plastico: 3, cobre: 1 }, preco: 1200 },
  tablet:  { nome: 'Tablet Descartável Lacrado', img: 'assets/imgs/tablet.png', receita: { aluminio: 10, vidro: 20, cobre: 12, plastico: 15 }, preco: 1200 }
};

const DESMANCHANDO = { plastico: 40, vidro: 40, borracha: 40, aluminio: 50, cobre: 90 };
const MATERIAIS = [
  { chave: 'plastico', label: 'Plástico' },
  { chave: 'vidro', label: 'Vidro' },
  { chave: 'borracha', label: 'Borracha' },
  { chave: 'aluminio', label: 'Alumínio' },
  { chave: 'cobre', label: 'Cobre' }
];
const MATERIAL_LABEL = {
  plastico: 'Plástico', vidro: 'Vidro', borracha: 'Borracha',
  aluminio: 'Alumínio', cobre: 'Cobre'
};

let PRODUTOS = JSON.parse(JSON.stringify(PRODUTOS_DEFAULT));
let produtoSelecionado = null;
let craftQtds = {}; // armazena quantidade por produto (chave -> qtd)
let craftCarrinho = []; // carrinho de fabricação: [{produto, qtd}]
let craftMateriaisCalculados = false; // se já calculou materiais
let modoDescontado = false;
let vendaItens = {};
let comprarItens = {};

/* =========================
   FORMATAÇÃO
   ========================= */
function fmt(v) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 }).format(Math.max(0, v));
}
function fmtInt(v) {
  return new Intl.NumberFormat('pt-BR').format(Math.max(0, Math.round(v)));
}
function validQtd(v) {
  const n = parseInt(v, 10);
  return isNaN(n) || n < 0 ? 0 : n;
}

/* =========================
   PREÇO UNITÁRIO (faixas)
   ========================= */
function getPrecoUnitario(produto, qtd) {
  const p = PRODUTOS[produto];
  if (!p) return 0;
  if (p.faixa) {
    return qtd <= p.faixa.limite ? p.faixa.baixo : p.faixa.alto;
  }
  return p.preco;
}

function precoDescontado(material) {
  return DESMANCHANDO[material] * 0.70;
}

/* =========================
   UTILITÁRIOS UI
   ========================= */
const $ = (id) => document.getElementById(id);
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

/* =========================
   ABA CRAFT
   ========================= */
function renderProductsGrid() {
  const grid = $('productsGrid');
  grid.innerHTML = '';
  Object.entries(PRODUTOS).forEach(([key, p]) => {
    const card = document.createElement('div');
    card.className = `product-card ${key === produtoSelecionado ? 'selected' : ''}`;

    const precoExemplo = getPrecoUnitario(key, 1);
    const receitaHtml = Object.entries(p.receita)
      .map(([m, q]) => `${MATERIAL_LABEL[m]}: ${q}`)
      .join(' • ');

    const qtdAtual = craftQtds[key] !== undefined ? craftQtds[key] : 1;

    card.innerHTML = `
      <img src="${p.img}" alt="${p.nome}" onerror="this.style.display='none'; this.parentElement.querySelector('.img-fallback').style.display='flex';">
      <div class="img-fallback" style="display:none;">📦</div>
      <h3>${p.nome}</h3>
      <div class="price">${fmt(precoExemplo)}</div>
      <div class="recipe">${receitaHtml}</div>
      <div class="qty-control">
        <input type="number" id="qtd_${key}" value="${qtdAtual}" min="0" step="1">
      </div>
      <div class="select-badge">${key === produtoSelecionado ? 'Selecionado' : 'Selecionar'}</div>
    `;

    card.onclick = (e) => {
      if (e.target.tagName === 'INPUT') return;
      produtoSelecionado = key;
      renderProductsGrid();
      renderCraftDetails();
    };

    const input = card.querySelector('input');
    input.addEventListener('click', (e) => {
      e.stopPropagation();
      e.target.select();
    });
    input.addEventListener('input', (e) => {
      e.stopPropagation();
      const val = validQtd(e.target.value);
      craftQtds[key] = val;
      produtoSelecionado = key;
      renderProductsGrid();
      renderCraftDetails();
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') e.preventDefault();
    });
    grid.appendChild(card);
  });
}

function renderCraftDetails() {
  const empty = $('craftEmpty');
  const content = $('craftContent');

  if (!produtoSelecionado) {
    empty.style.display = 'block';
    content.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  content.style.display = 'block';

  const p = PRODUTOS[produtoSelecionado];
  const qtd = craftQtds[produtoSelecionado] !== undefined ? craftQtds[produtoSelecionado] : 1;
  const precoUnit = getPrecoUnitario(produtoSelecionado, qtd);
  const faturamento = precoUnit * qtd;

  $('detailNome').textContent = p.nome;
  $('detailImg').src = p.img;
  $('detailPrice').textContent = fmt(precoUnit);
  $('detailPriceUnit').textContent = fmt(precoUnit);
  $('detailTotalRev').textContent = fmt(faturamento);

  const faixaEl = $('detailFaixa');
  if (p.faixa) {
    const texto = qtd <= p.faixa.limite
      ? `Faixa aplicada: até ${p.faixa.limite} un = ${fmt(p.faixa.baixo)} cada`
      : `Faixa aplicada: acima de ${p.faixa.limite} un = ${fmt(p.faixa.alto)} cada`;
    faixaEl.textContent = texto;
    faixaEl.style.display = 'block';
  } else {
    faixaEl.style.display = 'none';
  }

  // Atualizar qty input no painel direito
  const qtyInput = $('detailQtyInput');
  if (qtyInput) {
    qtyInput.value = qtd;
    // Remover event listeners antigos clonando o elemento
    const newInput = qtyInput.cloneNode(true);
    qtyInput.parentNode.replaceChild(newInput, qtyInput);
    newInput.value = qtd;
    newInput.addEventListener('click', (e) => {
      e.stopPropagation();
      e.target.select();
    });
    newInput.addEventListener('input', (e) => {
      e.stopPropagation();
      const val = validQtd(e.target.value);
      craftQtds[produtoSelecionado] = val;
      renderProductsGrid();
      renderCraftDetails();
    });
  }

  const grid = $('craftMaterials');
  grid.innerHTML = '';
  let totalMats = 0;
  for (const [m, qPorUn] of Object.entries(p.receita)) {
    const total = qPorUn * qtd;
    totalMats += total;
    const el = document.createElement('div');
    el.className = 'mat-item';
    el.innerHTML = `
      <div class="mat-name">${MATERIAL_LABEL[m]}</div>
      <div class="mat-val">${fmtInt(total)}</div>
      <div class="mat-val per">${fmtInt(qPorUn)} / unid.</div>
    `;
    grid.appendChild(el);
  }
  $('detailTotalMats').textContent = fmtInt(totalMats);
}

// Funções de quantidade
window.appQtyChange = function(delta) {
  if (!produtoSelecionado) return;
  const atual = craftQtds[produtoSelecionado] !== undefined ? craftQtds[produtoSelecionado] : 1;
  const novo = validQtd(atual + delta);
  craftQtds[produtoSelecionado] = novo;
  renderProductsGrid();
  renderCraftDetails();
};

window.appQtyQuick = function(add) {
  if (!produtoSelecionado) return;
  const atual = craftQtds[produtoSelecionado] !== undefined ? craftQtds[produtoSelecionado] : 1;
  const novo = validQtd(atual + add);
  craftQtds[produtoSelecionado] = novo;
  renderProductsGrid();
  renderCraftDetails();
};

window.appQtyMax = function() {
  if (!produtoSelecionado) return;
  const p = PRODUTOS[produtoSelecionado];
  const avail = {
    plastico: validQtd($('avail_plastico').value),
    vidro: validQtd($('avail_vidro').value),
    borracha: validQtd($('avail_borracha').value),
    aluminio: validQtd($('avail_aluminio').value),
    cobre: validQtd($('avail_cobre').value)
  };

  let max = Infinity;
  for (const [m, qPorUn] of Object.entries(p.receita)) {
    const disponivel = avail[m] || 0;
    const qtdPossivel = Math.floor(disponivel / qPorUn);
    if (qtdPossivel < max) max = qtdPossivel;
  }

  if (max === Infinity || max < 0) max = 0;
  craftQtds[produtoSelecionado] = max;
  renderProductsGrid();
  renderCraftDetails();
};

/* =========================
   FILA DE FABRICAÇÃO
   ========================= */
function renderCarrinho() {
  const list = $('cartList');
  const empty = $('cartEmpty');
  list.innerHTML = '';

  if (craftCarrinho.length === 0) {
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';

  craftCarrinho.forEach((item, idx) => {
    const p = PRODUTOS[item.produto];
    const el = document.createElement('div');
    el.className = 'cart-item';
    el.innerHTML = `
      <div class="cart-item-info">
        <div class="cart-item-name">${p.nome}</div>
        <div class="cart-item-qtd">${fmtInt(item.qtd)} un</div>
      </div>
      <div class="cart-item-actions">
        <button onclick="appEditCarrinho(${idx})">Editar</button>
        <button class="btn-remove" onclick="appRemoveCarrinho(${idx})">Remover</button>
      </div>
    `;
    list.appendChild(el);
  });
}

window.appEditCarrinho = function(idx) {
  const item = craftCarrinho[idx];
  const novaQtd = prompt(`Nova quantidade para ${PRODUTOS[item.produto].nome}:`, item.qtd);
  if (novaQtd !== null) {
    const val = validQtd(novaQtd);
    if (val > 0) {
      craftCarrinho[idx].qtd = val;
      renderCarrinho();
      toast('Quantidade atualizada');
    }
  }
};

window.appRemoveCarrinho = function(idx) {
  craftCarrinho.splice(idx, 1);
  renderCarrinho();
  toast('Item removido do carrinho');
};

function appAddCarrinho() {
  if (!produtoSelecionado) {
    toast('Selecione um produto primeiro.');
    return;
  }
  const qtd = craftQtds[produtoSelecionado] !== undefined ? craftQtds[produtoSelecionado] : 1;
  if (qtd <= 0) {
    toast('Informe uma quantidade válida.');
    return;
  }

  // Verifica se já existe no carrinho
  const existente = craftCarrinho.find(item => item.produto === produtoSelecionado);
  if (existente) {
    existente.qtd += qtd;
    toast(`${PRODUTOS[produtoSelecionado].nome} adicionado (total: ${existente.qtd})`);
  } else {
    craftCarrinho.push({ produto: produtoSelecionado, qtd: qtd });
    toast(`${PRODUTOS[produtoSelecionado].nome} adicionado ao carrinho`);
  }
  renderCarrinho();
  craftMateriaisCalculados = false;
}

function appCalcularMateriais() {
  if (craftCarrinho.length === 0) {
    toast('Adicione itens ao carrinho primeiro.');
    return;
  }

  // Soma todos os materiais
  const totais = {};
  let faturamentoTotal = 0;

  craftCarrinho.forEach(item => {
    const p = PRODUTOS[item.produto];
    const precoUnit = getPrecoUnitario(item.produto, item.qtd);
    faturamentoTotal += precoUnit * item.qtd;

    for (const [m, qPorUn] of Object.entries(p.receita)) {
      if (!totais[m]) totais[m] = 0;
      totais[m] += qPorUn * item.qtd;
    }
  });

  const totalMats = Object.values(totais).reduce((s, v) => s + v, 0);

  // Renderiza materiais
  const grid = $('craftMaterials');
  grid.innerHTML = '';
  for (const [m, total] of Object.entries(totais)) {
    const el = document.createElement('div');
    el.className = 'mat-item';
    el.innerHTML = `
      <div class="mat-name">${MATERIAL_LABEL[m]}</div>
      <div class="mat-val">${fmtInt(total)}</div>
      <div class="mat-val per">total</div>
    `;
    grid.appendChild(el);
  }

  $('detailTotalMats').textContent = fmtInt(totalMats);
  $('detailTotalRev').textContent = fmt(faturamentoTotal);

  // Mostra o resumo
  $('craftSummary').style.display = 'block';
  craftMateriaisCalculados = true;
  toast('Materiais calculados');
}

/* =========================
   ABA VENDA
   ========================= */
function initVenda() {
  const sel = $('vendaMat');
  sel.innerHTML = '';
  MATERIAIS.forEach(m => {
    const o = document.createElement('option');
    o.value = m.chave;
    o.textContent = m.label;
    sel.appendChild(o);
  });
  renderVenda();
}

function addVendaItem() {
  const sel = $('vendaMat');
  const chave = sel.value;
  const qtd = validQtd($('vendaQtd').value);
  if (qtd <= 0) {
    toast('Informe uma quantidade válida.');
    return;
  }
  if (vendaItens[chave]) {
    vendaItens[chave].qtd += qtd;
  } else {
    vendaItens[chave] = { chave, qtd };
  }
  $('vendaQtd').value = '';
  renderVenda();
}

function removeVendaItem(chave) {
  delete vendaItens[chave];
  renderVenda();
}

function renderVenda() {
  const tbody = $('vendaTbody');
  const empty = $('vendaEmpty');
  tbody.innerHTML = '';

  const chaves = Object.keys(vendaItens);
  if (chaves.length === 0) {
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    chaves.forEach(chave => {
      const item = vendaItens[chave];
      const unitRate = modoDescontado ? precoDescontado(chave) : DESMANCHANDO[chave];
      const subtotal = item.qtd * unitRate;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${MATERIAL_LABEL[chave]}</strong></td>
        <td>${fmtInt(item.qtd)}</td>
        <td>${fmt(unitRate)}</td>
        <td>${fmt(subtotal)}</td>
        <td><button type="button" class="btn-sm btn-rem" onclick="appRemoveVendaItem('${chave}')">Remover</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  const bruto = chaves.reduce((s, c) => s + vendaItens[c].qtd * DESMANCHANDO[c], 0);
  const desconto = modoDescontado ? bruto * 0.30 : 0;
  const lucro = desconto;
  const final = bruto - desconto;

  $('vBruto').textContent = fmt(bruto);
  $('vDesc').textContent = fmt(desconto);
  $('vLucro').textContent = fmt(lucro);
  $('vFinal').textContent = fmt(final);

  const lblDesc = document.querySelector('.total-item:nth-child(2) .lbl');
  if (lblDesc) lblDesc.textContent = modoDescontado ? 'Desconto (30% dinheiro sujo)' : 'Desconto';
  const noteDesc = document.querySelector('.total-item:nth-child(2) .note');
  if (noteDesc) noteDesc.textContent = modoDescontado ? 'Valor bruto − 30%' : 'Sem desconto';

  const lblLucro = document.querySelector('.total-item:nth-child(3) .lbl');
  if (lblLucro) lblLucro.textContent = modoDescontado ? 'LUCRO (dinheiro sujo)' : 'LUCRO (dinheiro sujo)';
  const noteLucro = document.querySelector('.total-item:nth-child(3) .note');
  if (noteLucro) noteLucro.textContent = modoDescontado ? 'Valor retido na operação' : 'Sem desconto aplicado';
}

/* =========================
   COPIAR RESUMO / LIMPAR
   ========================= */
function copyResumo() {
  const chaves = Object.keys(vendaItens);
  let texto = '💰 OPERAÇÃO — FERRO VELHO\n';
  texto += 'Modo: ' + (modoDescontado ? 'DESCONTADO' : 'DESMANCHANDO') + '\n';
  texto += '------------------------\n';
  if (chaves.length === 0) {
    texto += 'Nenhum material adicionado.\n';
  } else {
    chaves.forEach(c => {
      const item = vendaItens[c];
      const unitRate = modoDescontado ? precoDescontado(c) : DESMANCHANDO[c];
      const subtotal = item.qtd * unitRate;
      texto += `- ${MATERIAL_LABEL[c]}: ${item.qtd} × ${fmt(unitRate)} = ${fmt(subtotal)}\n`;
    });
  }
  const bruto = chaves.reduce((s, c) => s + vendaItens[c].qtd * DESMANCHANDO[c], 0);
  const desconto = modoDescontado ? bruto * 0.30 : 0;
  const lucro = desconto;
  const final = bruto - desconto;
  texto += '------------------------\n';
  texto += `Valor bruto: ${fmt(bruto)}\n`;
  texto += `Desconto: ${fmt(desconto)}\n`;
  texto += `Lucro (dinheiro sujo): ${fmt(lucro)}\n`;
  texto += `Total a pagar: ${fmt(final)}\n`;

  navigator.clipboard.writeText(texto).then(() => toast('Resumo copiado para a área de transferência')).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = texto;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('Resumo copiado');
  });
}

function limparVenda() {
  vendaItens = {};
  $('vendaQtd').value = '';
  renderVenda();
  toast('Operação limpa');
}

/* =========================
   ABA COMPRAR
   ========================= */
function initComprar() {
  const sel = $('comprarMat');
  sel.innerHTML = '';
  MATERIAIS.forEach(m => {
    const o = document.createElement('option');
    o.value = m.chave;
    o.textContent = m.label;
    sel.appendChild(o);
  });
  renderComprar();
}

function addComprarItem() {
  const sel = $('comprarMat');
  const chave = sel.value;
  const qtd = validQtd($('comprarQtd').value);
  if (qtd <= 0) {
    toast('Informe uma quantidade válida.');
    return;
  }
  if (comprarItens[chave]) {
    comprarItens[chave].qtd += qtd;
  } else {
    comprarItens[chave] = { chave, qtd };
  }
  $('comprarQtd').value = '';
  renderComprar();
}

function removeComprarItem(chave) {
  delete comprarItens[chave];
  renderComprar();
}

function renderComprar() {
  const tbody = $('comprarTbody');
  const empty = $('comprarEmpty');
  tbody.innerHTML = '';

  const chaves = Object.keys(comprarItens);
  if (chaves.length === 0) {
    empty.style.display = 'block';
  } else {
    empty.style.display = 'none';
    chaves.forEach(chave => {
      const item = comprarItens[chave];
      const unitRate = precoDescontado(chave);
      const subtotal = item.qtd * unitRate;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${MATERIAL_LABEL[chave]}</strong></td>
        <td>${fmtInt(item.qtd)}</td>
        <td>${fmt(unitRate)}</td>
        <td>${fmt(subtotal)}</td>
        <td><button type="button" class="btn-sm btn-rem" onclick="appRemoveComprarItem('${chave}')">Remover</button></td>
      `;
      tbody.appendChild(tr);
    });
  }

  const bruto = chaves.reduce((s, c) => s + comprarItens[c].qtd * DESMANCHANDO[c], 0);
  const desconto = bruto * 0.30;
  const lucro = desconto;
  const final = bruto - desconto;

  $('cBruto').textContent = fmt(bruto);
  $('cDesc').textContent = fmt(desconto);
  $('cLucro').textContent = fmt(lucro);
  $('cFinal').textContent = fmt(final);
}

function copyComprar() {
  const chaves = Object.keys(comprarItens);
  let texto = '💰 COMPRA — FERRO VELHO\n';
  texto += 'Modo: DESCONTADO\n';
  texto += '------------------------\n';
  if (chaves.length === 0) {
    texto += 'Nenhum material adicionado.\n';
  } else {
    chaves.forEach(c => {
      const item = comprarItens[c];
      const unitRate = precoDescontado(c);
      const subtotal = item.qtd * unitRate;
      texto += `- ${MATERIAL_LABEL[c]}: ${item.qtd} × ${fmt(unitRate)} = ${fmt(subtotal)}\n`;
    });
  }
  const bruto = chaves.reduce((s, c) => s + comprarItens[c].qtd * DESMANCHANDO[c], 0);
  const desconto = bruto * 0.30;
  const lucro = desconto;
  const final = bruto - desconto;
  texto += '------------------------\n';
  texto += `Valor bruto: ${fmt(bruto)}\n`;
  texto += `Desconto: ${fmt(desconto)}\n`;
  texto += `Lucro (dinheiro sujo): ${fmt(lucro)}\n`;
  texto += `Total a pagar: ${fmt(final)}\n`;

  navigator.clipboard.writeText(texto).then(() => toast('Resumo copiado para a área de transferência')).catch(() => {
    const ta = document.createElement('textarea');
    ta.value = texto;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    toast('Resumo copiado');
  });
}

function limparComprar() {
  comprarItens = {};
  $('comprarQtd').value = '';
  renderComprar();
  toast('Operação limpa');
}

/* =========================
   EDIÇÃO DE RECEITAS
   ========================= */
function openEditModal() {
  const content = $('editContent');
  content.innerHTML = '';
  Object.entries(PRODUTOS).forEach(([key, p]) => {
    const box = document.createElement('div');
    box.className = 'edit-group';
    box.style.border = '1px solid var(--border)';
    box.style.borderRadius = '16px';
    box.style.padding = '22px';
    box.style.background = 'var(--panel-2)';
    box.style.marginBottom = '20px';

    let html = `<div style="font-weight:800;font-size:16px;color:#fff;margin-bottom:14px;text-transform:uppercase;letter-spacing:0.5px;">${p.nome}</div>`;

    const inputs = [];
    for (const [m, q] of Object.entries(p.receita)) {
      inputs.push({ id: `edit_${key}_${m}`, label: MATERIAL_LABEL[m] || m, value: q });
    }
    inputs.forEach(inp => {
      html += `
        <div style="display:flex; gap:14px; align-items:center; margin-bottom:12px;">
          <label style="font-size:13px;color:var(--text-dim);width:150px;text-transform:uppercase;letter-spacing:0.5px;">${inp.label}</label>
          <input type="number" id="${inp.id}" value="${inp.value}" min="0" step="1" style="flex:1;padding:14px;border-radius:14px;border:1px solid var(--border);background:#0f0f0f;color:#fff; font-size:15px;">
        </div>`;
    });

    html += `
      <div style="display:flex; gap:14px; align-items:center; margin-bottom:12px;border-top:1px solid var(--border);padding-top:14px;">
        <label style="font-size:13px;color:var(--text-dim);width:150px;text-transform:uppercase;letter-spacing:0.5px;">Preço base</label>
        <input type="number" id="edit_${key}_preco" value="${p.preco}" min="0" step="1" style="flex:1;padding:14px;border-radius:14px;border:1px solid var(--border);background:#0f0f0f;color:#fff; font-size:15px;">
      </div>`;

    if (p.faixa) {
      html += `
        <div style="display:flex; gap:14px; align-items:center; margin-bottom:12px;">
          <label style="font-size:13px;color:var(--text-dim);width:150px;text-transform:uppercase;letter-spacing:0.5px;">Limite faixa</label>
          <input type="number" id="edit_${key}_faixaLimite" value="${p.faixa.limite}" min="0" step="1" style="flex:1;padding:14px;border-radius:14px;border:1px solid var(--border);background:#0f0f0f;color:#fff; font-size:15px;">
        </div>
        <div style="display:flex; gap:14px; align-items:center; margin-bottom:12px;">
          <label style="font-size:13px;color:var(--text-dim);width:150px;text-transform:uppercase;letter-spacing:0.5px;">Preço até limite</label>
          <input type="number" id="edit_${key}_faixaBaixo" value="${p.faixa.baixo}" min="0" step="1" style="flex:1;padding:14px;border-radius:14px;border:1px solid var(--border);background:#0f0f0f;color:#fff; font-size:15px;">
        </div>
        <div style="display:flex; gap:14px; align-items:center; margin-bottom:12px;">
          <label style="font-size:13px;color:var(--text-dim);width:150px;text-transform:uppercase;letter-spacing:0.5px;">Preço acima</label>
          <input type="number" id="edit_${key}_faixaAlto" value="${p.faixa.alto}" min="0" step="1" style="flex:1;padding:14px;border-radius:14px;border:1px solid var(--border);background:#0f0f0f;color:#fff; font-size:15px;">
        </div>`;
    }

    box.innerHTML = html;
    content.appendChild(box);
  });
  $('modalEdit').classList.add('open');
}

function closeEditModal() {
  $('modalEdit').classList.remove('open');
}

function saveEditRecipes() {
  let changed = false;
  Object.keys(PRODUTOS).forEach(key => {
    const p = PRODUTOS[key];
    for (const m of Object.keys(p.receita)) {
      const el = $(`edit_${key}_${m}`);
      if (el) {
        const nv = validQtd(el.value);
        if (p.receita[m] !== nv) { p.receita[m] = nv; changed = true; }
      }
    }
    const preEl = $(`edit_${key}_preco`);
    if (preEl) {
      const nv = validQtd(preEl.value);
      if (p.preco !== nv) { p.preco = nv; changed = true; }
    }
    if (p.faixa) {
      const lim = $(`edit_${key}_faixaLimite`);
      const bai = $(`edit_${key}_faixaBaixo`);
      const alt = $(`edit_${key}_faixaAlto`);
      if (lim) { const nv = validQtd(lim.value); if (p.faixa.limite !== nv) { p.faixa.limite = nv; changed = true; } }
      if (bai) { const nv = validQtd(bai.value); if (p.faixa.baixo !== nv) { p.faixa.baixo = nv; changed = true; } }
      if (alt) { const nv = validQtd(alt.value); if (p.faixa.alto !== nv) { p.faixa.alto = nv; changed = true; } }
    }
  });
  localStorage.setItem('fv_produtos', JSON.stringify(PRODUTOS));
  renderProductsGrid();
  renderCraftDetails();
  closeEditModal();
  toast(changed ? 'Receitas atualizadas' : 'Nenhuma alteração');
}

function resetRecipes() {
  PRODUTOS = JSON.parse(JSON.stringify(PRODUTOS_DEFAULT));
  localStorage.removeItem('fv_produtos');
  renderProductsGrid();
  renderCraftDetails();
  closeEditModal();
  toast('Receitas resetadas para o padrão');
}

/* =========================
   NAVEGAÇÃO ENTRE ABAS
   ========================= */
function showArea(id) {
  document.querySelectorAll('.area').forEach(a => a.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-pressed', 'false');
  });
  const area = $(id);
  let btn;
  if (id === 'areaCraft') btn = $('btnCraft');
  else if (id === 'areaVenda') btn = $('btnVenda');
  else btn = $('btnComprar');

  area.classList.add('active');
  btn.classList.add('active');
  btn.setAttribute('aria-pressed', 'true');

  if (id === 'areaCraft') {
    renderProductsGrid();
    renderCraftDetails();
    renderCarrinho();
  } else if (id === 'areaVenda') {
    renderVenda();
  } else {
    renderComprar();
  }
}

/* =========================
   INICIALIZAÇÃO
   ========================= */
function init() {
  const saved = localStorage.getItem('fv_produtos');
  if (saved) {
    try { PRODUTOS = JSON.parse(saved); } catch (e) {}
  }

  renderProductsGrid();
  renderCraftDetails();
  renderCarrinho();
  initVenda();
  initComprar();

  $('btnCraft').addEventListener('click', () => showArea('areaCraft'));
  $('btnVenda').addEventListener('click', () => showArea('areaVenda'));
  $('btnComprar').addEventListener('click', () => showArea('areaComprar'));

  $('btnAddCarrinho').addEventListener('click', appAddCarrinho);
  $('btnCalcularMateriais').addEventListener('click', appCalcularMateriais);

  // Inputs de materiais disponíveis (para Máximo)
  ['plastico', 'vidro', 'borracha', 'aluminio', 'cobre'].forEach(m => {
    const el = $('avail_' + m);
    if (el) {
      el.addEventListener('input', (e) => {
        e.stopPropagation();
      });
    }
  });

  $('btnAddMat').addEventListener('click', addVendaItem);
  $('vendaQtd').addEventListener('keydown', (e) => { if (e.key === 'Enter') addVendaItem(); });

  $('btnAddComprar').addEventListener('click', addComprarItem);
  $('comprarQtd').addEventListener('keydown', (e) => { if (e.key === 'Enter') addComprarItem(); });

  $('modeDesmanchando').addEventListener('click', () => {
    modoDescontado = false;
    $('modeDesmanchando').classList.add('active');
    $('modeDescontado').classList.remove('active');
    renderVenda();
  });
  $('modeDescontado').addEventListener('click', () => {
    modoDescontado = true;
    $('modeDescontado').classList.add('active');
    $('modeDesmanchando').classList.remove('active');
    renderVenda();
  });

  $('btnCopyResumo').addEventListener('click', copyResumo);
  $('btnLimparVenda').addEventListener('click', limparVenda);
  $('btnCopyComprar').addEventListener('click', copyComprar);
  $('btnLimparComprar').addEventListener('click', limparComprar);

  $('btnEditRecipes').addEventListener('click', openEditModal);
  $('btnCloseEdit').addEventListener('click', closeEditModal);
  $('btnSaveRecipes').addEventListener('click', saveEditRecipes);
  $('btnResetRecipes').addEventListener('click', resetRecipes);

  $('modalEdit').addEventListener('click', (e) => {
    if (e.target === $('modalEdit')) closeEditModal();
  });
}

window.appRemoveVendaItem = removeVendaItem;
window.appRemoveComprarItem = removeComprarItem;

init();