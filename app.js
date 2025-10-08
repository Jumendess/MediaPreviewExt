/* MediaPreviewExt - app.js
 * Observa anexos do chat via IAttachment e renderiza image/audio/video inline.
 */
(function () {
  const root = document.getElementById('root');

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v);
    });
    children.forEach(c => n.appendChild(c));
    return n;
  }

  function isImage(ct) { return /^image\//i.test(ct); }
  function isAudio(ct) { return /^audio\//i.test(ct); }
  function isVideo(ct) { return /^video\//i.test(ct); }

  function renderAttachment(att) {
    // att esperado: { id, fileName, contentType, url }  (url pode vir do seu conector)
    const { fileName, contentType, url } = att;
    const wrap = el('div', { class: 'media-item' });

    // Se houver URL explícita (seu conector WhatsApp → ODA manda), tentamos usá-la.
    if (url && contentType) {
      if (isImage(contentType)) {
        wrap.appendChild(el('img', { src: url, alt: fileName || 'imagem' }));
      } else if (isAudio(contentType)) {
        const a = el('audio', { controls: true });
        a.src = url;
        wrap.appendChild(a);
      } else if (isVideo(contentType)) {
        const v = el('video', { controls: true });
        v.src = url;
        wrap.appendChild(v);
      } else {
        // Qualquer outro arquivo vira link clicável
        wrap.appendChild(el('a', { href: url, target: '_blank', rel: 'noopener' , text: fileName || 'arquivo' }));
      }
    } else {
      // Fallback (se sua instância expõe método de download por IAttachment)
      wrap.appendChild(el('div', { class: 'error', text: 'Anexo sem URL direta ou content-type não identificado.' }));
    }

    // legenda
    const legend = fileName ? ` (${fileName})` : '';
    wrap.appendChild(el('div', { class: 'muted', text: `${contentType || 'desconhecido'}${legend}`}));

    root.appendChild(wrap);
  }

  function renderList(attachments) {
    root.innerHTML = '';
    if (!attachments || attachments.length === 0) {
      root.appendChild(el('div', { class: 'muted', text: 'Nenhum anexo no chat ainda.' }));
      return;
    }
    attachments.forEach(renderAttachment);
  }

  function boot(bus) {
    try {
      const iAttachment = bus.getInterface('IAttachment');

      // 1) Renderiza anexos já presentes quando a extensão sobe
      if (iAttachment && typeof iAttachment.getAttachments === 'function') {
        const current = iAttachment.getAttachments();   // ← Lista atual
        renderList(current);
      }

      // 2) Observa anexos adicionados
      // (o nome exato do evento pode variar conforme versão; em geral algo como 'attachmentAdded' / 'added')
      iAttachment.on('attachmentAdded', function (evt) {
        // evt.detail/evt.data — depende da versão. Normalmente vem o attachment/array de attachments.
        const att = (evt && (evt.detail || evt.data)) || evt;
        if (Array.isArray(att)) att.forEach(renderAttachment);
        else renderAttachment(att);
      });

      // 3) Observa anexos removidos/limpeza
      iAttachment.on('attachmentsCleared', function () {
        renderList([]);
      });

    } catch (e) {
      console.error('Falha ao inicializar IAttachment:', e);
      root.appendChild(el('div', { class: 'error', text: 'Não foi possível inicializar o módulo de anexos.' }));
    }
  }

  // Aguarda o CXBus do BUI
  function waitBus(retries = 50) {
    if (window && window.CXBus && typeof window.CXBus.registerPlugin === 'function') {
      // Registra um plugin simples
      window.CXBus.registerPlugin('MediaPreviewExt', function (bus) {
        boot(bus);
      });
    } else if (retries > 0) {
      setTimeout(() => waitBus(retries - 1), 200);
    } else {
      root.appendChild(el('div', { class: 'error', text: 'CXBus não disponível.' }));
    }
  }

  waitBus();
})();
