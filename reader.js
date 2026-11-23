(() => {
  const $ = id => document.getElementById(id);
  const storage = {
    get(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch {} }
  };
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  let chapters = [];
  let current = 0;
  let restoring = false;
  let timer;
  let size = clamp(Number(storage.get('voyage-size', 19)) || 19, 16, 26);

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  function setSize() {
    document.documentElement.style.setProperty('--reader-size', size + 'px');
    $('font-size').textContent = size;
    $('smaller').disabled = size === 16;
    $('larger').disabled = size === 26;
    storage.set('voyage-size', size);
  }

  function setTheme(dark) {
    document.body.classList.toggle('dark', dark);
    $('theme-toggle').setAttribute('aria-pressed', String(dark));
    $('theme-toggle').textContent = dark ? '☀ 日间模式' : '☾ 夜间模式';
    document.querySelector('meta[name="theme-color"]').setAttribute('content', dark ? '#1f3037' : '#fbfcfb');
    storage.set('voyage-theme', dark ? 'dark' : 'light');
  }

  setSize();
  setTheme(storage.get('voyage-theme', 'light') === 'dark');
  $('smaller').onclick = () => { size = clamp(size - 1, 16, 26); setSize(); };
  $('larger').onclick = () => { size = clamp(size + 1, 16, 26); setSize(); };
  $('theme-toggle').onclick = () => setTheme(!document.body.classList.contains('dark'));

  function closePanels() {
    $('contents').hidden = true;
    $('read-settings').hidden = true;
    $('contents-toggle').setAttribute('aria-expanded', 'false');
    $('settings-toggle').setAttribute('aria-expanded', 'false');
  }

  function togglePanel(panel, button) {
    const open = panel.hidden;
    closePanels();
    panel.hidden = !open;
    button.setAttribute('aria-expanded', String(open));
  }

  $('contents-toggle').onclick = () => togglePanel($('contents'), $('contents-toggle'));
  $('settings-toggle').onclick = () => togglePanel($('read-settings'), $('settings-toggle'));
  document.addEventListener('click', event => {
    if (!event.target.closest('.masthead')) closePanels();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const activeButton = !$('contents').hidden ? $('contents-toggle') : !$('read-settings').hidden ? $('settings-toggle') : null;
    if (activeButton) { closePanels(); activeButton.focus(); }
  });

  const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const inline = text => escape(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\*(.+?)\*/g, '<em>$1</em>');
  const storyTop = () => $('story').getBoundingClientRect().top + scrollY;

  function updateProgress() {
    const length = Math.max(1, $('story').offsetHeight - innerHeight);
    const progress = clamp((scrollY - storyTop()) / length, 0, 1);
    $('progress-bar').style.width = (progress * 100) + '%';
  }

  function savePosition() {
    if (!restoring && chapters.length) storage.set('voyage-offset', Math.max(0, scrollY - storyTop()));
  }

  function render(index, moveToChapter = true) {
    if (!chapters.length) return;
    current = clamp(index, 0, chapters.length - 1);
    const chapter = chapters[current];
    const blocks = chapter.body.trim().split(/\r?\n\s*\r?\n/);
    const title = chapter.title.match(/^(第[一二三四五六七八九十百零〇0-9]+章)[\s：:　]*(.*)$/);
    const heading = title && title[2] ? '<span class="chapter-label">' + inline(title[1]) + '</span>' + inline(title[2]) : inline(chapter.title);
    $('story').innerHTML = '<h2 tabindex="-1">' + heading + '</h2>' + blocks.map(block =>
      /^\s*(---|\*\*\*)\s*$/.test(block) ? '<hr>' : '<p>' + inline(block).replace(/\r?\n/g, '<br>') + '</p>'
    ).join('');
    $('chapter-count').textContent = '第 ' + String(current + 1).padStart(2, '0') + ' / ' + String(chapters.length).padStart(2, '0') + ' 章';
    $('previous').disabled = current === 0;
    $('next').disabled = current === chapters.length - 1;
    document.querySelectorAll('.chapter-link').forEach((button, i) => button.setAttribute('aria-current', String(i === current)));
    storage.set('voyage-chapter', current);

    if (moveToChapter) {
      clearTimeout(timer);
      restoring = true;
      storage.set('voyage-offset', 0);
      window.scrollTo({ top: Math.max(0, storyTop() - document.querySelector('.masthead').offsetHeight - 12), behavior: 'instant' });
      $('story').querySelector('h2').focus({ preventScroll: true });
      setTimeout(() => { restoring = false; }, 200);
    }
    updateProgress();
  }

  addEventListener('scroll', () => {
    updateProgress();
    if (!restoring && chapters.length) {
      clearTimeout(timer);
      timer = setTimeout(savePosition, 150);
    }
  }, { passive: true });
  addEventListener('resize', updateProgress);
  addEventListener('pagehide', savePosition);
  $('previous').onclick = () => render(current - 1);
  $('next').onclick = () => render(current + 1);

  fetch('航向以外.md').then(response => {
    if (!response.ok) throw new Error(response.status);
    return response.text();
  }).then(text => {
    const pieces = text.split(/^##\s+(.+)\s*$/m);
    for (let i = 1; i < pieces.length; i += 2) chapters.push({ title: pieces[i].trim(), body: pieces[i + 1].replace(/\s*---\s*$/, '') });
    if (!chapters.length) throw new Error('没有找到章节');

    $('intro-count').textContent = '故事连载中 · 已更新 ' + chapters.length + ' 章';
    $('chapter-list').replaceChildren();
    chapters.forEach((chapter, i) => {
      const button = document.createElement('button');
      button.className = 'chapter-link';
      button.type = 'button';
      button.textContent = chapter.title;
      button.onclick = () => { closePanels(); render(i); };
      $('chapter-list').append(button);
    });

    const savedChapter = Number(storage.get('voyage-chapter', 0)) || 0;
    const savedOffset = Number(storage.get('voyage-offset', 0)) || 0;
    restoring = true;
    render(savedChapter, false);
    if (savedOffset > 0 && Number.isFinite(savedOffset)) {
      requestAnimationFrame(() => {
        window.scrollTo({ top: storyTop() + savedOffset, behavior: 'instant' });
        setTimeout(() => { restoring = false; }, 250);
      });
    } else {
      restoring = false;
    }
  }).catch(() => {
    $('story').innerHTML = '<p>故事暂时无法载入，请刷新页面重试。</p>';
    $('chapter-count').textContent = '载入失败';
    $('chapter-list').innerHTML = '<p class="loading-text">章节暂时无法载入，请刷新页面重试。</p>';
  });
})();
