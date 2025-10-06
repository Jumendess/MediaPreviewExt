// BUI carrega a extensão num iframe. Vamos usar ambos os caminhos:
// 1) O serviço de Chat do SDK (quando disponível)
// 2) Um observer no DOM do transcript (fallback) para pegar links colados nas mensagens

(function () {
  // heurística simples para mídia
  const isImage = u => /\.(png|jpe?g|gif|webp|bmp|svg)(\?|$)/i.test(u) || /^image\//i.test(u.mimetype || '');
  const isAudio = u => /\.(mp3|m4a|aac|ogg|oga|wav|flac)(\?|$)/i.test(u) || /^audio\//i.test(u.mimetype || '');
  const isVideo = u => /\.(mp4|m4v|mov|webm|ogv)(\?|$)/i.test(u) || /^video\//i.test(u.mimetype || '');

  const mediaList = document.getElementById('mediaList');

  function addMediaPreview({ url, title }) {
    if (!url) return;
    const item = document.createElement('div');
    item.className = 'media-item';

    // decide tipo
    if (isImage(url)) {
      item.innerHTML = `${title ? `<div class="media-title">${title}</div>` : ''}<img src="${url}" loading="lazy" />`;
    } else if (isAudio(url)) {
      item.innerHTML = `${title ? `<div class="media-title">${title}</div>` : ''}<audio controls preload="metadata" src="${url}"></audio>`;
    } else if (isVideo(url)) {
      item.innerHTML = `${title ? `<div class="media-title">${title}</div>` : ''}<video controls preload="metadata" src="${url}"></video>`;
    } else {
      // arquivo genérico
      item.innerHTML = `${title ? `<div class="media-title">${title}</div>` : ''}<a href="${url}" target="_blank" rel="noopener">Abrir arquivo</a>`;
    }

    mediaList.appendChild(item);
    mediaList.parentElement.scrollTop = mediaList.parentElement.scrollHeight;
  }

  // 1) Tentativa com o SDK oficial do BUI
  const loader = window.ORACLE_SERVICE_CLOUD && window.ORACLE_SERVICE_CLOUD.extension_loader;
  if (loader && loader.load) {
    loader.load('MediaPreviewExt', '1.0.0').then(function (sdk) {
      // Chat provider (quando o workspace for o de Chat)
      let chat = null;
      try { chat = sdk.getServiceProvider('Chat'); } catch(e) {}

      if (chat) {
        const EVT = chat.Constants.EVENTS;
        // mensagens novas (do cliente/bot)
        chat.registerListener(EVT.NEW_MESSAGE, function (m) {
          // m.text pode conter a URL que seu conector manda (ex.: "📷 ...: https://...").
          if (m && m.text) {
            // captura todas as URLs do texto
            const urls = (m.text.match(/https?:\/\/\S+/g) || []);
            urls.forEach(u => addMediaPreview({ url: u }));
          }
        });

        // histórico ao carregar o chat (útil ao abrir uma sessão já em andamento)
        chat.getMessages().then(list => {
          (list || []).forEach(m => {
            const urls = (m.text && m.text.match(/https?:\/\/\S+/g)) || [];
            urls.forEach(u => addMediaPreview({ url: u }));
          });
        });
      } else {
        // 2) Fallback: observar o transcript do chat e procurar <a href="...">
        startDomObserver();
      }
    });
  } else {
    // se não tiver loader (varia por versão), usa o observer
    startDomObserver();
  }

  function startDomObserver() {
    // procura o painel do chat no DOM
    const ro = new MutationObserver(() => {
      const transcript = findTranscript();
      if (transcript && !transcript._mediaHooked) {
        transcript._mediaHooked = true;
        observeTranscript(transcript);
      }
    });
    ro.observe(document.documentElement, { childList: true, subtree: true });
  }

  function findTranscript() {
    // o seletor pode variar por tema/versão; pegue o container de mensagens
    // tente algo genérico: a região do chat costuma ter role="log" ou rolagem própria
    const candidates = Array.from(document.querySelectorAll('[role="log"], .chat, .transcript, .rn_ChatTranscript')).filter(e => e.querySelector('a[href]'));
    return candidates[0] || null;
  }

  function observeTranscript(node) {
    // processa os links já existentes
    node.querySelectorAll('a[href]').forEach(a => addMediaPreview({ url: a.href }));

    // observa novas mensagens/links
    const mo = new MutationObserver(muts => {
      muts.forEach(m => {
        m.addedNodes && m.addedNodes.forEach(n => {
          if (n.nodeType === 1) {
            n.querySelectorAll && n.querySelectorAll('a[href]').forEach(a => addMediaPreview({ url: a.href }));
          }
        });
      });
    });
    mo.observe(node, { childList: true, subtree: true });
  }
})();
