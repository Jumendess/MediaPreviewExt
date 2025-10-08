(function () {
  const root = document.getElementById('root');

  const log = (...a) => console.log('[MediaPreviewExt]', ...a);
  const err = (...a) => console.error('[MediaPreviewExt]', ...a);

  function el(tag, attrs = {}, kids = []) {
    const n = document.createElement(tag);
    Object.entries(attrs).forEach(([k,v]) => {
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else n.setAttribute(k, v);
    });
    kids.forEach(k => n.appendChild(k));
    return n;
  }

  const isImage = ct => /^image\//i.test(ct || '');
  const isAudio = ct => /^audio\//i.test(ct || '');
  const isVideo = ct => /^video\//i.test(ct || '');

  function renderAttachment(att) {
    // Estrutura típica esperada: { fileName, contentType, url, id }
    const { fileName, contentType, url, id } = att || {};
    const wrap = el('div', { class: 'media-item' });

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
        wrap.appendChild(el('a', { href: url, target: '_blank', rel: 'noopener', text: fileName || 'arquivo' }));
      }
    } else {
      wrap.appendChild(el('div', { class: 'error', text: 'Anexo sem URL ou content-type.' }));
      log('Attachment sem URL/CT', att);
    }

    const legend = `${contentType || 'desconhecido'}${fileName ? ' ('+fileName+')' : ''}${id ? '  •  id:'+id : ''}`;
    wrap.appendChild(el('div', { class: 'muted', text: legend }));

    root.appendChild(wrap);
  }

  function renderList(list) {
    root.innerHTML = '';
    if (!list || list.length === 0) {
      root.appendChild(el('div', { class: 'muted', text: 'Nenhum anexo no chat ainda.' }));
      return;
    }
    list.forEach(renderAttachment);
  }

  function boot(bus) {
    try {
      const ia = bus.getInterface('IAttachment');
      log('IAttachment =', ia);

      // lista inicial
      if (ia && typeof ia.getAttachments === 'function') {
        const current = ia.getAttachments();
        log('getAttachments()', current);
        renderList(current);
      } else {
        log('getAttachments() não disponível nesta versão.');
      }

      // eventos: o nome pode variar conforme a release; tente estas variações:
      const tryOn = (ev) => {
        try {
          ia.on(ev, (evt) => {
            const payload = evt?.detail || evt?.data || evt;
            log(`Evento ${ev}`, payload);
            if (Array.isArray(payload)) payload.forEach(renderAttachment);
            else renderAttachment(payload);
          });
          log(`Registrado listener em ${ev}`);
        } catch (e) {
          log(`Evento ${ev} não existe nesta versão.`);
        }
      };

      // Tente as opções comuns
      tryOn('attachmentAdded');
      tryOn('added');
      tryOn('onAdded');

      // Limpeza
      tryOn('attachmentsCleared');
      tryOn('cleared');

    } catch (e) {
      err('Falha ao inicializar:', e);
      root.appendChild(el('div', { class: 'error', text: 'Não foi possível inicializar o módulo de anexos.' }));
    }
  }

  function waitBus(tries = 60) {
    if (window?.CXBus?.registerPlugin) {
      window.CXBus.registerPlugin('MediaPreviewExt', (bus) => {
        log('Plugin registrado, iniciando…');
        boot(bus);
      });
    } else if (tries > 0) {
      setTimeout(() => waitBus(tries - 1), 250);
    } else {
      err('CXBus não disponível.');
      root.appendChild(el('div', { class: 'error', text: 'CXBus não disponível.' }));
    }
  }

  waitBus();
})();
