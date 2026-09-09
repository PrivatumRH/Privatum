(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const chain = {
    chainId: '0x1237',
    chainName: 'Robinhood Chain',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://rpc.mainnet.chain.robinhood.com'],
    blockExplorerUrls: ['https://robinhoodchain.blockscout.com']
  };

  const initialActivity = [
    { id: 'PV-9042', type: 'Receive', asset: 'USDC', amount: '+4,200.00', counterparty: 'stealth:8fa2...91bd', time: '09:42', status: 'Settled' },
    { id: 'PV-9038', type: 'Swap', asset: 'USDT → USDC', amount: '1,850.00', counterparty: 'Route: DEX aggregate', time: '08:17', status: 'Settled' },
    { id: 'PV-9031', type: 'Send', asset: 'USDC', amount: '-620.00', counterparty: 'ops.privatum', time: 'Yesterday', status: 'Settled' },
    { id: 'PV-9027', type: 'Recovery', asset: 'Shard C', amount: 'Rotation', counterparty: 'Passkey verified', time: 'Yesterday', status: 'Settled' },
    { id: 'PV-9021', type: 'SDK', asset: 'Integration', amount: 'Copied', counterparty: '@privatum/robinhood-chain-sdk', time: 'Yesterday', status: 'Settled' }
  ];

  const state = {
    module: 'overview',
    balances: { USDC: 18420.42, USDT: 6386.00 },
    activity: [...initialActivity],
    filter: 'All',
    wallet: { account: null, chainId: null, status: 'Ready to connect on desktop or mobile.' },
    policy: { daily: 2500, velocity: 6, anomaly: true, stealth: true },
    recoveryStep: 0,
    receiveCount: 1,
    tourTimer: null
  };

  const moduleMeta = {
    overview: ['Threshold custody', 'Overview'],
    send: ['Private payments', 'Private Send'],
    receive: ['Receiver privacy', 'Stealth Receive'],
    swap: ['Stablecoin routing', 'Swap'],
    shards: ['Quorum operations', 'Shards'],
    activity: ['Settlement ledger', 'Activity'],
    recovery: ['Passkey recovery', 'Recovery'],
    sdk: ['Developer toolkit', 'Open SDK'],
    settings: ['Co-signer controls', 'Settings']
  };

  const flowSteps = [
    ['Build payload', 'Desktop environment'],
    ['Client signature', 'Shard A signs locally'],
    ['Policy check', 'Co-signer validates limits'],
    ['Co-signature', 'Shard B signs'],
    ['Aggregate', 'Partial signatures combine'],
    ['Settle', 'Robinhood Chain finality']
  ];

  const recoverySteps = [
    ['Verify passkey', 'Authenticate the recovery shard using the device passkey flow.'],
    ['Request co-signer', 'Shard B validates the recovery request, account policy, and session state.'],
    ['Rotate client shard', 'A fresh Shard A is generated without assembling the full private key.'],
    ['Resume quorum', 'Desktop and co-signer resume normal 2-of-3 signing.']
  ];

  function money(value, asset = '') {
    return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${asset ? ` ${asset}` : ''}`;
  }

  function nowTime() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function randomHex(length) {
    const chars = 'abcdef0123456789';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  }

  function shortAddress(value) {
    if (!value) return 'Connect Wallet';
    return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
  }

  async function copyText(value, title = 'Copied', body = 'The value is on your clipboard.') {
    try {
      await navigator.clipboard.writeText(value);
      notify(title, body);
      return true;
    } catch (error) {
      notify('Copy failed', 'Clipboard access was not available in this browser.', 'error');
      return false;
    }
  }

  function notify(title, body, type = 'success') {
    const stack = $('#toast-stack');
    if (!stack) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'error' : ''}`;
    toast.innerHTML = `<div class="toast-icon">${type === 'error' ? '!' : '✓'}</div><div><strong></strong><span></span></div><button type="button" aria-label="Dismiss">×</button>`;
    toast.querySelector('strong').textContent = title;
    toast.querySelector('span').textContent = body;
    toast.querySelector('button').addEventListener('click', () => toast.remove());
    stack.appendChild(toast);
    if (window.gsap) gsap.fromTo(toast, { x: 30, opacity: 0 }, { x: 0, opacity: 1, duration: .35, ease: 'power3.out' });
    window.setTimeout(() => {
      if (!toast.isConnected) return;
      if (window.gsap) gsap.to(toast, { x: 30, opacity: 0, duration: .25, onComplete: () => toast.remove() });
      else toast.remove();
    }, 4200);
  }

  function addActivity(item, status = 'Settled') {
    state.activity.unshift({
      ...item,
      id: `PV-${Math.floor(1000 + Math.random() * 9000)}`,
      time: nowTime(),
      status
    });
    renderActivity();
    renderOverviewActivity();
  }

  function renderBalances() {
    const total = state.balances.USDC + state.balances.USDT;
    $('#total-balance').textContent = money(total);
    $('#usdc-stat').textContent = money(state.balances.USDC);
    $('#usdt-stat').textContent = money(state.balances.USDT);
    const asset = $('#send-asset')?.value || 'USDC';
    $('#send-available').textContent = money(state.balances[asset], asset);
    $('#policy-stat').textContent = state.policy.anomaly ? 'Armed' : 'Manual';
  }

  function renderChart() {
    const chart = $('#balance-chart');
    if (!chart) return;
    chart.innerHTML = '';
    const values = [42, 58, 38, 72, 64, 86, 78, 92, 66, 81, 74, 96, 69, 88];
    values.forEach((height, index) => {
      const bar = document.createElement('span');
      bar.style.height = `${height}%`;
      bar.dataset.value = `$${(18 + index * 1.7).toFixed(1)}k`;
      chart.appendChild(bar);
    });
    if (window.gsap) gsap.fromTo(chart.children, { scaleY: 0 }, { scaleY: 1, duration: .8, stagger: .035, ease: 'power3.out' });
  }

  function renderFlowSteps(active = -1) {
    const wrap = $('#send-flow-steps');
    if (!wrap) return;
    wrap.innerHTML = flowSteps.map(([title, detail], index) => `
      <div class="flow-step ${active >= index ? 'active' : ''}">
        <span>${index + 1}</span>
        <div><strong>${title}</strong><small>${detail}</small></div>
        <small>${active > index ? 'Done' : active === index ? 'Live' : 'Queued'}</small>
      </div>`).join('');
  }

  function activityIcon(type) {
    return { Send: 'S', Receive: 'R', Swap: '↔', Recovery: 'C', SDK: '{}' }[type] || 'P';
  }

  function renderActivity() {
    const list = $('#activity-list');
    if (!list) return;
    const items = state.filter === 'All' ? state.activity : state.activity.filter(item => item.type === state.filter);
    list.innerHTML = items.length ? items.map(item => `
      <article class="activity-item">
        <div class="activity-icon">${activityIcon(item.type)}</div>
        <div><strong>${item.type}</strong><span>${item.counterparty}</span></div>
        <div><strong>${item.amount}</strong><span>${item.asset}</span></div>
        <div><span>${item.time}</span><small>${item.status}</small></div>
      </article>`).join('') : '<div class="activity-item"><div class="activity-icon">0</div><div><strong>No activity</strong><span>No ledger entries match this filter.</span></div></div>';
    if (window.gsap) gsap.fromTo(list.children, { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: .35, stagger: .035, ease: 'power2.out' });
  }

  function renderOverviewActivity() {
    const list = $('#overview-activity');
    if (!list) return;
    list.innerHTML = state.activity.slice(0, 4).map(item => `
      <article class="activity-item">
        <div class="activity-icon">${activityIcon(item.type)}</div>
        <div><strong>${item.type}</strong><span>${item.counterparty}</span></div>
        <div><strong>${item.amount}</strong><span>${item.asset}</span></div>
        <div><span>${item.time}</span><small>${item.status}</small></div>
      </article>`).join('');
  }

  function setModule(module, updateHash = true) {
    if (!moduleMeta[module]) module = 'overview';
    state.module = module;
    $$('.module-page').forEach(page => page.classList.toggle('active', page.dataset.module === module));
    $$('[data-module-link]').forEach(button => button.classList.toggle('active', button.dataset.moduleLink === module));
    $('#module-eyebrow').textContent = moduleMeta[module][0];
    $('#module-title').textContent = moduleMeta[module][1];
    if (updateHash) history.replaceState(null, '', `#${module}`);
    closeSidebar();
    if (window.gsap) {
      const cards = $$(`.module-page[data-module="${module}"] .reveal-card`);
      gsap.fromTo(cards, { y: 28, opacity: 0 }, { y: 0, opacity: 1, duration: .65, stagger: .06, ease: 'power3.out', overwrite: true });
    }
    if (module === 'overview') renderChart();
    if (module === 'swap') drawRouteCanvas();
    if (module === 'receive') drawQrPattern($('#stealth-address').textContent);
  }

  function closeSidebar() {
    $('#app-sidebar')?.classList.remove('open');
    $('#sidebar-scrim')?.classList.remove('open');
  }

  function openSidebar() {
    $('#app-sidebar')?.classList.add('open');
    $('#sidebar-scrim')?.classList.add('open');
  }

  function validateSend() {
    const recipient = $('#send-recipient').value.trim();
    const asset = $('#send-asset').value;
    const amount = Number($('#send-amount').value);
    const valid = recipient.length > 3 && Number.isFinite(amount) && amount > 0 && amount <= state.balances[asset];
    $('#send-policy').textContent = valid ? 'Ready for quorum' : 'Needs review';
    return valid;
  }

  function handleSend(event) {
    event.preventDefault();
    if (!validateSend()) {
      notify('Check transfer details', 'Enter a valid recipient and an amount within the available balance.', 'error');
      return;
    }
    const recipient = $('#send-recipient').value.trim();
    const asset = $('#send-asset').value;
    const amount = Number($('#send-amount').value);
    const memo = $('#send-memo').value.trim() || 'none';
    const button = $('#send-submit');
    button.disabled = true;
    button.textContent = 'Building payload...';
    let step = 0;
    renderFlowSteps(0);
    const timer = window.setInterval(() => {
      step += 1;
      if (step >= flowSteps.length) {
        window.clearInterval(timer);
        state.balances[asset] -= amount;
        renderBalances();
        addActivity({ type: 'Send', asset, amount: `-${amount.toFixed(2)}`, counterparty: recipient });
        notify('Private transfer settled', `${amount.toFixed(2)} ${asset} was signed by two shards and settled in the demo ledger. Memo: ${memo}.`);
        button.disabled = false;
        button.textContent = 'Sign and send';
        window.setTimeout(() => renderFlowSteps(-1), 1000);
      } else {
        renderFlowSteps(step);
        button.textContent = flowSteps[step][0] + '...';
      }
    }, 620);
  }

  function drawQrPattern(seed) {
    const canvas = $('#qr-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;
    const cells = 21;
    const cell = size / cells;
    ctx.clearRect(0, 0, size, size);
    const gradient = ctx.createLinearGradient(0, 0, size, size);
    gradient.addColorStop(0, '#38b6ff');
    gradient.addColorStop(.5, '#f64b43');
    gradient.addColorStop(1, '#f5c43d');
    ctx.fillStyle = 'rgba(255,255,255,.035)';
    ctx.fillRect(0, 0, size, size);
    let hash = 0;
    for (let i = 0; i < seed.length; i++) hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
    ctx.fillStyle = gradient;
    for (let y = 0; y < cells; y++) {
      for (let x = 0; x < cells; x++) {
        const bit = Math.abs(Math.sin(hash + x * 31 + y * 17) * 10000) % 1;
        const finder = (x < 6 && y < 6) || (x > 14 && y < 6) || (x < 6 && y > 14);
        if (finder || bit > .56) {
          const inset = finder ? 1 : 2;
          ctx.fillRect(x * cell + inset, y * cell + inset, cell - inset * 2, cell - inset * 2);
        }
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,.22)';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, size - 4, size - 4);
  }

  function handleReceive(event) {
    event.preventDefault();
    const address = `0x${randomHex(40)}`;
    state.receiveCount += 1;
    $('#stealth-address').textContent = address;
    $('#receive-count').textContent = `Generated address #${state.receiveCount}`;
    drawQrPattern(address);
    addActivity({ type: 'Receive', asset: 'USDC', amount: '+0.00', counterparty: `stealth:${address.slice(2, 8)}...${address.slice(-4)}` }, 'Policy check');
    notify('Stealth address generated', 'A fresh one-time receive address is ready to share.');
  }

  function updateSwap() {
    const from = $('#swap-from').value;
    const to = from === 'USDC' ? 'USDT' : 'USDC';
    const amount = Number($('#swap-amount').value);
    const output = Number.isFinite(amount) ? amount * 0.9987 : 0;
    $('#swap-output').textContent = `${output.toFixed(2)} ${to}`;
    $('#route-from').textContent = from;
    $('#route-to').textContent = to;
    $('#swap-route').textContent = `Rate 0.9987 · Fee 0.08% · Route: aggregate · Max slippage ${$('#swap-slippage').value}%`;
    $('#slippage-output').textContent = `${Number($('#swap-slippage').value).toFixed(1)}%`;
  }

  function handleSwap(event) {
    event.preventDefault();
    const from = $('#swap-from').value;
    const to = from === 'USDC' ? 'USDT' : 'USDC';
    const amount = Number($('#swap-amount').value);
    if (!Number.isFinite(amount) || amount <= 0 || amount > state.balances[from]) {
      notify('Swap unavailable', 'Enter an amount within the available source balance.', 'error');
      return;
    }
    const output = amount * 0.9987;
    const button = $('#swap-submit');
    button.disabled = true;
    button.textContent = 'Routing swap...';
    drawRouteCanvas(true);
    window.setTimeout(() => {
      state.balances[from] -= amount;
      state.balances[to] += output;
      renderBalances();
      addActivity({ type: 'Swap', asset: `${from} → ${to}`, amount: amount.toFixed(2), counterparty: `Route: aggregate · ${$('#swap-slippage').value}% max` });
      notify('Swap settled', `${amount.toFixed(2)} ${from} converted to ${output.toFixed(2)} ${to} in the demo ledger.`);
      button.disabled = false;
      button.textContent = 'Execute swap';
      updateSwap();
      drawRouteCanvas(false);
    }, 1100);
  }

  let routeProgress = 0;
  function drawRouteCanvas(animate = false) {
    const canvas = $('#route-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(255,255,255,.025)';
    ctx.fillRect(0, 0, w, h);
    const points = [
      [60, h * .68], [170, h * .42], [280, h * .58], [390, h * .34], [500, h * .48], [660, h * .24]
    ];
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    const gradient = ctx.createLinearGradient(0, 0, w, 0);
    gradient.addColorStop(0, '#38b6ff');
    gradient.addColorStop(.55, '#f64b43');
    gradient.addColorStop(1, '#f5c43d');
    ctx.strokeStyle = gradient;
    ctx.beginPath();
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
    ctx.stroke();
    points.forEach(([x, y], index) => {
      ctx.fillStyle = index === points.length - 1 ? '#4ade80' : '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, index === points.length - 1 ? 9 : 6, 0, Math.PI * 2);
      ctx.fill();
    });
    if (animate) {
      routeProgress = (routeProgress + 1) % points.length;
      const [x, y] = points[routeProgress];
      ctx.fillStyle = '#38b6ff';
      ctx.shadowColor = '#38b6ff';
      ctx.shadowBlur = 24;
      ctx.beginPath();
      ctx.arc(x, y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  function handleShardCheck(card) {
    const shard = card.dataset.shard;
    const status = card.querySelector('[data-shard-status]');
    const button = card.querySelector('button');
    button.disabled = true;
    button.textContent = 'Checking...';
    window.setTimeout(() => {
      status.textContent = `Checked ${nowTime()}`;
      button.disabled = false;
      button.textContent = 'Run check';
      notify(`Shard ${shard} check complete`, 'Health, backup state, and quorum readiness are green in the demo environment.');
      addActivity({ type: 'Recovery', asset: `Shard ${shard}`, amount: 'Health check', counterparty: 'Quorum readiness verified' });
    }, 700);
  }

  function exportActivity() {
    const rows = ['id,type,asset,amount,counterparty,time,status', ...state.activity.map(item => [item.id, item.type, item.asset, item.amount, item.counterparty, item.time, item.status].map(value => `"${String(value).replaceAll('"', '""')}"`).join(','))];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'privatum-activity.csv';
    link.click();
    URL.revokeObjectURL(url);
    notify('Activity exported', 'A CSV copy of the demo ledger was downloaded.');
  }

  function renderRecovery() {
    const index = state.recoveryStep;
    $('#recovery-progress-bar').style.width = `${((index + 1) / recoverySteps.length) * 100}%`;
    $('#recovery-step-card').innerHTML = `<span>${String(index + 1).padStart(2, '0')}</span><h2>${recoverySteps[index][0]}</h2><p>${recoverySteps[index][1]}</p>`;
    $('#recovery-next').textContent = index === recoverySteps.length - 1 ? 'Finish recovery' : 'Continue';
    $('#recovery-back').disabled = index === 0;
  }

  function handleRecoveryNext() {
    if (state.recoveryStep < recoverySteps.length - 1) {
      state.recoveryStep += 1;
      renderRecovery();
      notify(recoverySteps[state.recoveryStep][0], recoverySteps[state.recoveryStep][1]);
    } else {
      addActivity({ type: 'Recovery', asset: 'Shard A', amount: 'Rotated', counterparty: 'Passkey plus co-signer' });
      notify('Recovery complete', 'A fresh client shard was generated and quorum signing is active.');
      state.recoveryStep = 0;
      renderRecovery();
    }
  }

  function downloadGuide() {
    const guide = [
      'PRIVATUM SDK Integration Guide',
      '',
      'Install:',
      'npm install @privatum/robinhood-chain-sdk viem',
      '',
      'Network:',
      'Robinhood Chain mainnet, chain ID 4663, ETH gas, ERC-4337 support.',
      '',
      'Shard model:',
      'Shard A desktop client, Shard B co-signer, Shard C recovery passkey.',
      '',
      'Signing flow:',
      'Build payload, sign with Shard A, validate policy, sign with Shard B, combine partial signatures, settle through ERC-4337.',
      '',
      'Status:',
      'Proposed package target from PRD version 0.4. Production endpoint is not specified.'
    ].join('\n');
    const blob = new Blob([guide], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'privatum-integration-guide.txt';
    link.click();
    URL.revokeObjectURL(url);
    addActivity({ type: 'SDK', asset: 'Guide', amount: 'Downloaded', counterparty: 'privatum-integration-guide.txt' });
    notify('Guide downloaded', 'The SDK integration guide was saved as a text file.');
  }

  function openWalletModal() {
    $('#wallet-modal').classList.add('open');
    renderWallet();
  }

  function closeWalletModal() {
    $('#wallet-modal').classList.remove('open');
  }

  function renderWallet() {
    $('#wallet-status').textContent = state.wallet.status;
    $('#wallet-network').textContent = state.wallet.chainId || 'Not connected';
    $('#wallet-account').textContent = state.wallet.account ? shortAddress(state.wallet.account) : 'Not connected';
    $('#wallet-button-text').textContent = shortAddress(state.wallet.account);
  }

  async function connectWallet() {
    const button = $('#wallet-connect');
    button.disabled = true;
    button.textContent = 'Connecting...';
    state.wallet.status = 'Checking for MetaMask.';
    renderWallet();
    try {
      if (!window.ethereum) {
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile) {
          const handoff = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}${window.location.hash}`;
          window.open(handoff, '_blank', 'noopener,noreferrer');
          state.wallet.status = 'MetaMask mobile handoff opened.';
          notify('MetaMask handoff opened', 'Continue in the MetaMask mobile app. Demo mode remains available here.');
        } else {
          window.open('https://metamask.io/download/', '_blank', 'noopener,noreferrer');
          state.wallet.status = 'MetaMask was not detected. Install the Chrome extension, then retry.';
          notify('MetaMask not detected', 'The download page was opened. Demo mode remains available.', 'error');
        }
        return;
      }
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      try {
        await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chain.chainId }] });
      } catch (error) {
        if (error && error.code === 4902) {
          await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [chain] });
        } else {
          throw error;
        }
      }
      const currentChain = await window.ethereum.request({ method: 'eth_chainId' });
      state.wallet.account = accounts && accounts[0] ? accounts[0] : null;
      state.wallet.chainId = currentChain;
      state.wallet.status = currentChain === chain.chainId ? 'Connected to Robinhood Chain.' : 'Connected. Please switch to Robinhood Chain.';
      notify('Wallet connected', `${shortAddress(state.wallet.account)} is connected to Robinhood Chain.`);
    } catch (error) {
      state.wallet.status = error && error.message ? error.message : 'Connection was rejected or could not be completed.';
      notify('Wallet connection failed', state.wallet.status, 'error');
    } finally {
      button.disabled = false;
      button.textContent = state.wallet.account ? 'Reconnect' : 'Connect';
      renderWallet();
    }
  }

  function disconnectWallet() {
    state.wallet.account = null;
    state.wallet.chainId = null;
    state.wallet.status = 'Wallet disconnected locally. MetaMask permissions can be revoked in the extension.';
    renderWallet();
    notify('Wallet disconnected', 'The local dashboard session was cleared.');
  }

  function saveSettings(event) {
    event.preventDefault();
    notify('Policy saved', `Daily limit ${money(state.policy.daily).replace('$', '$')}, ${state.policy.velocity} transfers per hour, anomaly checks ${state.policy.anomaly ? 'on' : 'off'}.`);
    addActivity({ type: 'Recovery', asset: 'Policy', amount: 'Saved', counterparty: `Limit ${money(state.policy.daily)} · Velocity ${state.policy.velocity}` });
    renderBalances();
  }

  function resetDemo() {
    state.balances = { USDC: 18420.42, USDT: 6386.00 };
    state.activity = [...initialActivity];
    state.filter = 'All';
    state.receiveCount = 1;
    state.recoveryStep = 0;
    $('#stealth-address').textContent = '0x5564f9a1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7';
    $('#receive-count').textContent = 'Generated address #1';
    $$('#activity-filters button').forEach(button => button.classList.toggle('active', button.dataset.filter === 'All'));
    renderBalances();
    renderActivity();
    renderOverviewActivity();
    renderRecovery();
    updateSwap();
    drawQrPattern($('#stealth-address').textContent);
    notify('Demo reset', 'Balances, activity, receive state, and recovery progress were restored.');
  }

  function initParticles() {
    const canvas = $('#particle-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let width = 0;
    let height = 0;
    let particles = [];
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function resize() {
      width = canvas.width = window.innerWidth * window.devicePixelRatio;
      height = canvas.height = window.innerHeight * window.devicePixelRatio;
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      const count = Math.min(110, Math.floor(window.innerWidth / 12));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: (Math.random() * 1.8 + .6) * window.devicePixelRatio,
        vx: (Math.random() - .5) * .18 * window.devicePixelRatio,
        vy: (Math.random() - .5) * .18 * window.devicePixelRatio,
        a: Math.random() * .45 + .12
      }));
    }
    function frame() {
      ctx.clearRect(0, 0, width, height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;
        ctx.fillStyle = `rgba(184, 216, 247, ${p.a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      if (!reduced) requestAnimationFrame(frame);
    }
    resize();
    window.addEventListener('resize', resize);
    frame();
  }

  function initCursor() {
    if (!window.matchMedia('(pointer: fine)').matches || !window.gsap) return;
    const dot = $('.cursor-dot');
    const ring = $('.cursor-ring');
    const dotX = gsap.quickTo(dot, 'x', { duration: .12, ease: 'power3.out' });
    const dotY = gsap.quickTo(dot, 'y', { duration: .12, ease: 'power3.out' });
    const ringX = gsap.quickTo(ring, 'x', { duration: .38, ease: 'power3.out' });
    const ringY = gsap.quickTo(ring, 'y', { duration: .38, ease: 'power3.out' });
    window.addEventListener('pointermove', event => {
      dotX(event.clientX);
      dotY(event.clientY);
      ringX(event.clientX);
      ringY(event.clientY);
    });
    $$('a, button, input, select, textarea, .magnetic').forEach(element => {
      element.addEventListener('pointerenter', () => document.body.classList.add('cursor-hover'));
      element.addEventListener('pointerleave', () => document.body.classList.remove('cursor-hover'));
    });
  }

  function runTour() {
    if (state.tourTimer) {
      window.clearInterval(state.tourTimer);
      state.tourTimer = null;
      $('#demo-tour').textContent = 'Run tour';
      return;
    }
    const modules = ['overview', 'send', 'receive', 'swap', 'shards', 'activity', 'recovery', 'sdk', 'settings'];
    let index = modules.indexOf(state.module);
    $('#demo-tour').textContent = 'Stop tour';
    notify('Dashboard tour started', 'The demo will move through every operational module.');
    state.tourTimer = window.setInterval(() => {
      index += 1;
      if (index >= modules.length) {
        window.clearInterval(state.tourTimer);
        state.tourTimer = null;
        $('#demo-tour').textContent = 'Run tour';
        notify('Dashboard tour complete', 'Every module has been visited.');
        return;
      }
      setModule(modules[index]);
    }, 1450);
  }

  function bindEvents() {
    document.addEventListener('click', event => {
      const link = event.target.closest('[data-module-link]');
      if (link) setModule(link.dataset.moduleLink);
    });
    $('#mobile-menu')?.addEventListener('click', openSidebar);
    $('#sidebar-scrim')?.addEventListener('click', closeSidebar);
    $('#demo-tour')?.addEventListener('click', runTour);
    $('#send-form')?.addEventListener('submit', handleSend);
    $('#send-asset')?.addEventListener('change', () => { renderBalances(); validateSend(); });
    $('#send-amount')?.addEventListener('input', validateSend);
    $('#send-recipient')?.addEventListener('input', validateSend);
    $('#receive-form')?.addEventListener('submit', handleReceive);
    $('#copy-stealth')?.addEventListener('click', () => copyText($('#stealth-address').textContent, 'Address copied', 'The one-time receive address is on your clipboard.'));
    $('#swap-form')?.addEventListener('submit', handleSwap);
    $('#swap-from')?.addEventListener('change', updateSwap);
    $('#swap-amount')?.addEventListener('input', updateSwap);
    $('#swap-slippage')?.addEventListener('input', updateSwap);
    $('#swap-flip')?.addEventListener('click', () => {
      const from = $('#swap-from');
      from.value = from.value === 'USDC' ? 'USDT' : 'USDC';
      updateSwap();
      notify('Pair reversed', `${from.value} is now the source asset.`);
    });
    $$('.shard-card').forEach(card => card.querySelector('button')?.addEventListener('click', () => handleShardCheck(card)));
    $('#rotate-client')?.addEventListener('click', () => {
      addActivity({ type: 'Recovery', asset: 'Shard A', amount: 'Rotated', counterparty: 'Manual client shard rotation' });
      notify('Client shard rotated', 'A fresh Shard A was generated in the demo environment.');
    });
    $('#export-activity')?.addEventListener('click', exportActivity);
    $('#clear-activity')?.addEventListener('click', () => {
      state.activity = [...initialActivity];
      renderActivity();
      renderOverviewActivity();
      notify('Ledger reset', 'The demo activity ledger was restored.');
    });
    $$('#activity-filters button').forEach(button => button.addEventListener('click', () => {
      state.filter = button.dataset.filter;
      $$('#activity-filters button').forEach(item => item.classList.toggle('active', item === button));
      renderActivity();
    }));
    $('#recovery-next')?.addEventListener('click', handleRecoveryNext);
    $('#recovery-back')?.addEventListener('click', () => {
      if (state.recoveryStep > 0) {
        state.recoveryStep -= 1;
        renderRecovery();
      }
    });
    $('#copy-install')?.addEventListener('click', () => {
      copyText('npm install @privatum/robinhood-chain-sdk viem', 'Install command copied', 'The SDK install command is on your clipboard.');
      addActivity({ type: 'SDK', asset: 'Install', amount: 'Copied', counterparty: '@privatum/robinhood-chain-sdk' });
    });
    $('#copy-sdk')?.addEventListener('click', () => copyText($('#sdk-code').textContent, 'SDK code copied', 'The integration example is on your clipboard.'));
    $('#download-guide')?.addEventListener('click', downloadGuide);
    $('#daily-limit')?.addEventListener('input', event => {
      state.policy.daily = Number(event.target.value);
      $('#daily-output').textContent = money(state.policy.daily).replace('.00', '');
    });
    $('#velocity-limit')?.addEventListener('input', event => {
      state.policy.velocity = Number(event.target.value);
      $('#velocity-output').textContent = `${state.policy.velocity} transfers per hour`;
    });
    $('#anomaly-toggle')?.addEventListener('click', event => {
      state.policy.anomaly = !state.policy.anomaly;
      event.currentTarget.classList.toggle('active', state.policy.anomaly);
      renderBalances();
    });
    $('#stealth-toggle')?.addEventListener('click', event => {
      state.policy.stealth = !state.policy.stealth;
      event.currentTarget.classList.toggle('active', state.policy.stealth);
    });
    $('#settings-form')?.addEventListener('submit', saveSettings);
    $('#reset-demo')?.addEventListener('click', resetDemo);
    $('#wallet-button')?.addEventListener('click', openWalletModal);
    $('#wallet-close')?.addEventListener('click', closeWalletModal);
    $('#wallet-modal')?.addEventListener('click', event => {
      if (event.target === event.currentTarget) closeWalletModal();
    });
    $('#wallet-connect')?.addEventListener('click', connectWallet);
    $('#wallet-disconnect')?.addEventListener('click', disconnectWallet);
    $('#wallet-copy')?.addEventListener('click', () => {
      if (!state.wallet.account) {
        notify('No wallet connected', 'Connect MetaMask before copying an address.', 'error');
        return;
      }
      copyText(state.wallet.account, 'Wallet address copied', 'The connected account is on your clipboard.');
    });
    window.addEventListener('hashchange', () => setModule(location.hash.replace('#', '') || 'overview', false));
    window.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        closeWalletModal();
        closeSidebar();
      }
    });
  }

  function initGsap() {
    if (!window.gsap) return;
    if (window.matchMedia('(min-width: 821px)').matches) {
      gsap.fromTo('.app-sidebar', { x: -40, opacity: 0 }, { x: 0, opacity: 1, duration: .7, ease: 'power3.out' });
    }
    gsap.fromTo('.topbar', { y: -24, opacity: 0 }, { y: 0, opacity: 1, duration: .7, ease: 'power3.out' });
  }

  function init() {
    renderBalances();
    renderFlowSteps(-1);
    renderActivity();
    renderOverviewActivity();
    renderChart();
    renderRecovery();
    updateSwap();
    drawQrPattern($('#stealth-address').textContent);
    drawRouteCanvas(false);
    bindEvents();
    initParticles();
    initCursor();
    initGsap();
    setModule(location.hash.replace('#', '') || 'overview', false);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
