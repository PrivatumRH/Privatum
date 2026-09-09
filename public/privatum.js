document.addEventListener('DOMContentLoaded', function () {
  var form = document.getElementById('wf-form-Contact-form');
  if (!form) return;

  var walletInput = document.getElementById('First-Name');
  var recipientInput = document.getElementById('Last-Name');
  var assetInput = document.getElementById('Company');
  var amountInput = document.getElementById('Phone-Number');
  var sessionInput = document.getElementById('Email-Address');
  var memoInput = document.getElementById('field');
  var submit = form.querySelector('input[type="submit"]');
  var success = form.parentElement.querySelector('.w-form-done');
  var failure = form.parentElement.querySelector('.w-form-fail');
  var modes = Array.prototype.slice.call(form.querySelectorAll('input[name="type"]'));

  function hideMessages() {
    if (success) success.style.display = 'none';
    if (failure) failure.style.display = 'none';
  }

  function show(target, message) {
    hideMessages();
    if (!target) return;
    target.innerHTML = '<div>' + message + '</div>';
    target.style.display = 'block';
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function selectedMode() {
    var checked = form.querySelector('input[name="type"]:checked');
    if (!checked) return 'Private Send';
    var label = form.querySelector('span[for="' + checked.id + '"]');
    return label ? label.textContent : 'Private Send';
  }

  function updateSubmit() {
    if (submit) submit.value = 'Run ' + selectedMode();
  }

  modes.forEach(function (mode) {
    mode.addEventListener('change', updateSubmit);
  });
  updateSubmit();
  hideMessages();

  async function connectMetaMask() {
    if (!window.ethereum) {
      var isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      if (isMobile) {
        var handoff = 'https://metamask.app.link/dapp/' + window.location.host + window.location.pathname;
        window.open(handoff, '_blank', 'noopener,noreferrer');
        return { account: '', note: 'MetaMask mobile handoff opened. Demo signing continued locally.' };
      }
      return { account: '', note: 'MetaMask was not detected. Demo signing continued locally.' };
    }

    var chain = {
      chainId: '0x1237',
      chainName: 'Robinhood Chain',
      nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      rpcUrls: ['https://rpc.mainnet.chain.robinhood.com'],
      blockExplorerUrls: ['https://robinhoodchain.blockscout.com']
    };

    var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
    try {
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chain.chainId }] });
    } catch (error) {
      if (error && error.code === 4902) {
        await window.ethereum.request({ method: 'wallet_addEthereumChain', params: [chain] });
      } else {
        throw error;
      }
    }
    return { account: accounts && accounts[0] ? accounts[0] : '', note: 'MetaMask connected to Robinhood Chain.' };
  }

  form.addEventListener('submit', async function (event) {
    event.preventDefault();
    hideMessages();

    var mode = selectedMode();
    var recipient = recipientInput.value.trim();
    var asset = assetInput.value.trim() || 'USDC';
    var amount = Number(amountInput.value);
    var policy = document.getElementById('Newsletter').checked;

    if (!recipient || !Number.isFinite(amount) || amount <= 0) {
      show(failure, 'Enter a recipient and a valid amount before running the threshold flow.');
      return;
    }

    if (submit) {
      submit.disabled = true;
      submit.value = 'Connecting wallet...';
    }

    try {
      var connection = await connectMetaMask();
      if (connection.account) walletInput.value = connection.account;
      if (!walletInput.value) walletInput.value = 'Demo account';

      if (submit) submit.value = 'Signing with 2-of-3 quorum...';
      await new Promise(function (resolve) { window.setTimeout(resolve, 850); });

      var shortWallet = walletInput.value.length > 12 ? walletInput.value.slice(0, 6) + '...' + walletInput.value.slice(-4) : walletInput.value;
      var policyText = policy ? 'Policy checks passed.' : 'Policy checks were skipped for this rehearsal.';
      show(success, mode + ' complete for ' + amount.toFixed(2) + ' ' + asset + ' to ' + recipient + '. ' + connection.note + ' ' + policyText + ' Wallet: ' + shortWallet + '. Memo: ' + (memoInput.value || 'none') + '. Session: ' + (sessionInput.value || 'demo passkey') + '.');
      form.reset();
      walletInput.value = connection.account || '';
      updateSubmit();
    } catch (error) {
      show(failure, error && error.message ? error.message : 'Wallet connection was rejected or could not be completed.');
    } finally {
      if (submit) {
        submit.disabled = false;
        updateSubmit();
      }
    }
  });
});
