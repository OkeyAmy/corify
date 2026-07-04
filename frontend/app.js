const form = document.querySelector('#want-form');
const questionType = document.querySelector('#question-type');
const targetAddress = document.querySelector('#target-address');
const budget = document.querySelector('#budget');
const runButton = document.querySelector('#run-button');
const catalog = document.querySelector('#catalog');
const catalogCount = document.querySelector('#catalog-count');
const feed = document.querySelector('#feed');
const feedState = document.querySelector('#feed-state');
const answerOutput = document.querySelector('#answer-output');
const summary = document.querySelector('#consumer-summary');
const winnerBadge = document.querySelector('#winner-badge');
const settlementBadge = document.querySelector('#settlement-badge');
const depositLink = document.querySelector('#deposit-link');
const ledgerCheck = document.querySelector('#ledger-check');
const settlementLink = document.querySelector('#settlement-link');
const dataMode = document.querySelector('#data-mode');
const settlementMode = document.querySelector('#settlement-mode');

const defaults = {
  wallet_activity: 'Vote111111111111111111111111111111111111111',
  token_depth: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  holder_momentum: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
};

const labels = {
  whaletrace: 'WhaleTrace',
  depthscan: 'DepthScan',
  pulsecheck: 'PulseCheck',
  wallet_activity: 'Wallet activity',
  token_depth: 'Token market depth',
  holder_momentum: 'Holder momentum',
};

let catalogEntries = [];

questionType.addEventListener('change', () => {
  targetAddress.value = defaults[questionType.value] ?? '';
  highlightCatalog(questionType.value);
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  runButton.disabled = true;
  feedState.textContent = 'running';
  renderFeed([{ label: 'WANT', text: 'Submitting request to Corify market.' }]);
  try {
    const response = await fetch('/want', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        targetAddress: targetAddress.value.trim(),
        questionType: questionType.value,
        budgetLamports: Number(budget.value),
      }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? 'Request failed');
    renderResult(payload);
  } catch (error) {
    renderError(error);
  } finally {
    runButton.disabled = false;
  }
});

await boot();

async function boot() {
  const [healthResponse, catalogResponse] = await Promise.all([
    fetch('/health'),
    fetch('/catalog'),
  ]);
  const health = await healthResponse.json();
  catalogEntries = await catalogResponse.json();
  dataMode.textContent = `data: ${health.dataMode}`;
  settlementMode.textContent = `settlement: ${health.settlementMode}`;
  renderCatalog(catalogEntries);
  resetResult();
}

function renderCatalog(entries) {
  catalogCount.textContent = `${entries.length} online`;
  catalog.innerHTML = entries
    .map(
      (entry) => `
        <article class="seller" data-question-type="${entry.questionType}">
          <h3>${labels[entry.sellerId]}</h3>
          <dl>
            <div><dt>Product</dt><dd>${labels[entry.questionType]}</dd></div>
            <div><dt>Price</dt><dd>${formatLamports(entry.basePriceLamports)}${entry.maxPriceLamports ? `-${formatLamports(entry.maxPriceLamports)}` : ''}</dd></div>
            <div><dt>Confidence</dt><dd>${Math.round(entry.confidence * 100)}%</dd></div>
          </dl>
        </article>
      `
    )
    .join('');
  highlightCatalog(questionType.value);
}

function highlightCatalog(type) {
  document.querySelectorAll('.seller').forEach((seller) => {
    seller.classList.toggle('active', seller.dataset.questionType === type);
  });
}

function renderResult(result) {
  feedState.textContent = result.verification.action;
  winnerBadge.textContent =
    labels[result.award.winnerSellerId] ?? result.award.winnerSellerId;
  settlementBadge.textContent = result.verification.action;
  answerOutput.textContent = JSON.stringify(result.delivery.answer, null, 2);
  summary.textContent =
    result.consumerSummary?.text ??
    `${labels[result.award.winnerSellerId]} won at ${formatLamports(result.award.priceLamports)} lamports. Ledger checked ${result.verification.checked.field} and chose ${result.verification.action}.`;
  depositLink.innerHTML = link(
    result.deposit.explorerUrl,
    result.deposit.signature
  );
  ledgerCheck.textContent = `${result.verification.checked.field}: delivered ${result.verification.checked.delivered}, rechecked ${result.verification.checked.reChecked}`;
  settlementLink.innerHTML = link(
    result.settlement.explorerUrl,
    result.settlement.signature
  );
  renderFeed([
    {
      label: 'WANT',
      text: `${labels[result.want.questionType]} for ${shortAddress(result.want.targetAddress)}`,
    },
    ...result.bids.map((bid) => ({
      label: 'BID',
      text: `${labels[bid.sellerId]} offered ${formatLamports(bid.priceLamports)} at ${Math.round(bid.confidence * 100)}% confidence.`,
    })),
    {
      label: 'AWARD',
      text: `${labels[result.award.winnerSellerId]} scored ${result.award.scoring[0]?.score ?? 0}. ${result.competitionNote}`,
    },
    {
      label: 'DELIVERED',
      text: `${labels[result.delivery.sellerId]} returned sourced data.`,
    },
    {
      label: 'VERIFIED',
      text: `Ledger chose ${result.verification.action}: ${result.verification.reason ?? 'check passed'}.`,
    },
  ]);
}

function resetResult() {
  feedState.textContent = 'idle';
  winnerBadge.textContent = 'no winner';
  settlementBadge.textContent = 'not started';
  answerOutput.textContent = '{}';
  depositLink.textContent = '-';
  ledgerCheck.textContent = '-';
  settlementLink.textContent = '-';
}

function renderFeed(items) {
  feed.innerHTML = items
    .map((item) => `<li><b>${item.label}</b><span>${item.text}</span></li>`)
    .join('');
}

function renderError(error) {
  feedState.textContent = 'error';
  settlementBadge.textContent = 'failed';
  renderFeed([
    {
      label: 'ERROR',
      text: error instanceof Error ? error.message : String(error),
    },
  ]);
  summary.innerHTML = `<span class="error">${error instanceof Error ? error.message : String(error)}</span>`;
}

function formatLamports(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function shortAddress(value) {
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function link(href, text) {
  return `<a href="${href}" target="_blank" rel="noreferrer">${text}</a>`;
}
