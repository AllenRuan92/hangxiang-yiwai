(() => {
  const $ = id => document.getElementById(id);
  const storage = {
    get(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch { return fallback; } },
    set(key, value) { try { localStorage.setItem(key, value); } catch {} }
  };
  let chapters = [], current = 0, restoring = false;
  let size = Math.max(16, Math.min(26, Number(storage.get('voyage-size', 19)) || 19));
  const setSize = () => { document.documentElement.style.setProperty('--reader-size', `${size}px`); storage.set('voyage-size', size); };
  const setTheme = dark => { document.body.classList.toggle('dark', dark); $('theme-toggle').setAttribute('aria-pressed', String(dark)); $('theme-toggle').textContent = dark ? '☀' : '☾'; storage.set('voyage-theme', dark ? 'dark' : 'light'); };
  setSize(); setTheme(storage.get('voyage-theme', 'light') === 'dark');
  $('smaller').onclick = () => { size = Math.max(16, size - 1); setSize(); };
  $('larger').onclick = () => { size = Math.min(26, size + 1); setSize(); };
  $('theme-toggle').onclick = () => setTheme(!document.body.classList.contains('dark'));
  $('contents-toggle').onclick = () => { const open = $('contents').hidden; $('contents').hidden = !open; $('contents-toggle').setAttribute('aria-expanded', String(open)); if (open) $('contents').scrollIntoView({block:'nearest'}); };
  const escape = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const inline = s => escape(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>');
  function render(index, scroll = true) {
    current = Math.max(0, Math.min(chapters.length - 1, index));
    const chapter = chapters[current];
    const blocks = chapter.body.trim().split(/\r?\n\s*\r?\n/);
    $('story').innerHTML = `<h2>${inline(chapter.title)}</h2>` + blocks.map(block => /^\s*(---|\*\*\*)\s*$/.test(block) ? '<hr>' : `<p>${inline(block).replace(/\r?\n/g, '<br>')}</p>`).join('');
    $('chapter-count').textContent = `第 ${current + 1} / ${chapters.length} 章`;
    $('previous').disabled = current === 0; $('next').disabled = current === chapters.length - 1;
    document.querySelectorAll('.chapter-link').forEach((button, i) => button.setAttribute('aria-current', String(i === current)));
    storage.set('voyage-chapter', current);
    if (scroll) { storage.set('voyage-offset', 0); $('story').scrollIntoView(); }
    updateProgress();
  }
  function updateProgress() { const story = $('story'); const length = Math.max(1, story.offsetHeight - innerHeight); const value = Math.max(0, Math.min(1, (scrollY - story.offsetTop) / length)); $('progress-bar').style.width = `${value * 100}%`; }
  let timer;
  addEventListener('scroll', () => { updateProgress(); if (!restoring && chapters.length) { clearTimeout(timer); timer = setTimeout(() => storage.set('voyage-offset', Math.max(0, scrollY - $('story').offsetTop)), 150); } }, {passive:true});
  $('previous').onclick = () => render(current - 1); $('next').onclick = () => render(current + 1);
  fetch('航向以外.md').then(response => { if (!response.ok) throw new Error(response.status); return response.text(); }).then(text => {
    const pieces = text.split(/^##\s+(.+)\s*$/m);
    for (let i = 1; i < pieces.length; i += 2) chapters.push({title: pieces[i].trim(), body: pieces[i + 1].replace(/\s*---\s*$/, '')});
    if (!chapters.length) throw new Error('没有找到章节');
    chapters.forEach((chapter, i) => { const button = document.createElement('button'); button.className = 'chapter-link'; button.type = 'button'; button.textContent = chapter.title; button.onclick = () => { $('contents').hidden = true; $('contents-toggle').setAttribute('aria-expanded', 'false'); render(i); }; $('chapter-list').append(button); });
    const savedChapter = Number(storage.get('voyage-chapter', 0)) || 0;
    const savedOffset = Number(storage.get('voyage-offset', 0)) || 0;
    restoring = true; render(savedChapter, false);
    if (savedOffset > 0) requestAnimationFrame(() => { window.scrollTo({top: $('story').offsetTop + savedOffset, behavior: 'instant'}); setTimeout(() => { restoring = false; }, 250); }); else restoring = false;
  }).catch(() => { $('story').innerHTML = '<p>故事暂时无法载入，请刷新页面重试。</p>'; $('chapter-count').textContent = '载入失败'; });
})();
