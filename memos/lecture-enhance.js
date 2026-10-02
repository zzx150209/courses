// 本文件由 script.py polish 自动生成，请勿手改（改 script.py 里的 _ENHANCE_JS_TEMPLATE）
(function () {
  // 1. 阅读进度条
  const bar = document.createElement('div');
  bar.id = 'lec-progress';
  document.body.prepend(bar);
  window.addEventListener('scroll', function () {
    const pct = window.scrollY / (document.body.scrollHeight - innerHeight) * 100;
    bar.style.width = Math.min(pct, 100) + '%';
  });

  // 从开头的文本节点里删掉已变成标签/徽标的前缀，避免「注意」出现两次。
  // 前缀可能被 <span>/<strong>/<a> 拆成多个文本节点，所以要跨节点删。
  function stripPrefix(root, prefix) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let node, left = prefix.length, leading = true;
    while (left > 0 && (node = walker.nextNode())) {
      const raw = node.nodeValue;
      let from = 0;
      if (leading) {
        // prefix 来自 textContent.trim()，开头的空白只跳过一次，不计入 left
        from = raw.length - raw.trimStart().length;
        if (from >= raw.length) continue;   // 整个节点都是空白 → 原样保留
        leading = false;
      }
      const take = Math.min(left, raw.length - from);
      node.nodeValue = raw.slice(0, from) + raw.slice(from + take);
      left -= take;
    }
    // 清掉残留的空白 / 冒号
    const w2 = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n2;
    while ((n2 = w2.nextNode())) {
      const cleaned = n2.nodeValue.replace(/^[\s:：，]+/, '');
      n2.nodeValue = cleaned;
      if (cleaned) break;   // 命中第一个有内容的文本节点即停
    }
  }

  // 2. h4「例题：xxx」→ 自动编号徽标（编号由 CSS counter 生成）
  //    必须在 blockquote 之前跑：有些例题 h4 被包在引用里，
  //    否则前缀会先被 callout 吃掉，h4 就认不出来了
  const EG_RE = /^(?:例题|例)\s*[:：]\s*/;
  document.querySelectorAll('#write h4').forEach(function (h) {
    const m = h.textContent.trim().match(EG_RE);
    if (!m) return;
    h.classList.add('lec-eg');
    stripPrefix(h, m[0]);
  });

  // 3. Callout 识别：命中前缀 → 上色 + 加标签并吃掉正文前缀；
  //    没命中 → 保持默认淡蓝定义卡，不加标签
  const CALLOUT_RULES = [
    [/^(?:(?:📌)\s*(?:(?:重点|核心|结论|总结)\s*[:：，]?)?|(?:重点|核心|结论|总结)\s*[:：，])\s*/i, "lec-key", "\u603b\u7ed3"],
    [/^(?:(?:💡)\s*(?:(?:提示|技巧|小贴士|tip)\s*[:：，]?)?|(?:提示|技巧|小贴士|tip)\s*[:：，])\s*/i, "lec-tip", "\u63d0\u793a"],
    [/^(?:(?:⚠️|⚠)\s*(?:(?:注意|警告|warn)\s*[:：，]?)?|(?:注意|警告|warn)\s*[:：，])\s*/i, "lec-warn", "\u6ce8\u610f"],
    [/^(?:(?:❌)\s*(?:(?:易错|坑点|误区)\s*[:：，]?)?|(?:易错|坑点|误区)\s*[:：，])\s*/i, "lec-pitfall", "\u6613\u9519"],
    [/^(?:(?:📝)\s*(?:(?:例题|举例|例如|例)\s*[:：，]?)?|(?:例题|举例|例如|例)\s*[:：，])\s*/i, "lec-example", "\u4f8b\u9898"],
    [/^(?:(?:🔍)\s*(?:(?:证明|分析|推导)\s*[:：，]?)?|(?:证明|分析|推导)\s*[:：，])\s*/i, "lec-example", "\u8bc1\u660e"],
    [/^(?:(?:📖)\s*(?:(?:定义|定理|性质)\s*[:：，]?)?|(?:定义|定理|性质)\s*[:：，])\s*/i, "", "\u5b9a\u4e49"]
  ];
  document.querySelectorAll('#write blockquote, .typora-export blockquote').forEach(function (bq) {
    // 引用整体就是一道例题（首个子元素是例题 h4）→ 只上靛蓝色，
    // 标签交给 h4 徽标，避免「例题」出现两次
    const firstEl = bq.firstElementChild;
    if (firstEl && firstEl.tagName === 'H4' && firstEl.classList.contains('lec-eg')) {
      bq.classList.add('lec-example');
      return;
    }
    const text = bq.textContent.trim();
    for (let i = 0; i < CALLOUT_RULES.length; i++) {
      const re = CALLOUT_RULES[i][0], cls = CALLOUT_RULES[i][1], label = CALLOUT_RULES[i][2];
      const m = text.match(re);
      if (!m) continue;
      if (cls) bq.classList.add(cls);
      bq.setAttribute('data-lec-label', label);
      stripPrefix(bq, m[0]);
      return;
    }
  });

  // 4. 代码块：header bar（语言 + 展开 + 复制）
  //
  // 展开策略标记（写在 Markdown 里，导出后都不显示）：
  //   ① 代码块首行注释   // @open        / # @fold  / -- @open 标题
  //   ② 代码块前一行     <!-- @open -->
  //   ③ 文档任意位置     <!-- @open-all -->  改变整篇默认
  // 没有任何标记时：行数 <= AUTO_OPEN_MAX_LINES 自动展开，更长的仍折叠。
  const AUTO_OPEN_MAX_LINES = 18;

  // @open / @fold（含别名）+ 可选标题；前面允许各语言的行注释符
  const MARK_RE = /^\s*(?:\/\/+|#+|--|;+|%|\/\*|<!--)?\s*@(open|expand|show|展开|fold|close|collapse|hide|折叠)(?![A-Za-z0-9_])\s*[:：]?\s*(.*?)\s*(?:\*\/|-->)?\s*$/i;
  const OPEN_WORDS = /^(open|expand|show|展开)$/i;

  function parseMark(text) {
    const m = (text || '').replace(/[​﻿]/g, '').match(MARK_RE);
    if (!m) return null;
    return { open: OPEN_WORDS.test(m[1]), title: m[2] || '' };
  }

  // ③ 文档级默认：扫全文 HTML 注释
  let docDefault = null;
  (function () {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
    let c;
    while ((c = w.nextNode())) {
      const m = c.nodeValue.trim().match(/^@(open|fold|展开|折叠)-all$/i);
      if (m) { docDefault = /^(open|展开)$/i.test(m[1]); break; }
    }
  })();

  // ② 代码块前的 HTML 注释标记；命中就把注释（和只装着它的空段落）一起删掉
  function markFromSiblings(pre) {
    let node = pre.previousSibling, hops = 0;
    while (node && hops++ < 3) {
      if (node.nodeType === 8) {                      // 注释节点
        const mk = parseMark(node.nodeValue);
        if (mk) { node.remove(); return mk; }
      } else if (node.nodeType === 1) {               // 只含注释的 <p>
        if (node.textContent.trim() === '') {
          for (const child of Array.from(node.childNodes)) {
            if (child.nodeType !== 8) continue;
            const mk = parseMark(child.nodeValue);
            if (mk) { node.remove(); return mk; }
          }
        } else break;
      } else if (node.nodeType === 3 && node.nodeValue.trim() !== '') {
        break;
      }
      node = node.previousSibling;
    }
    return null;
  }

  // ① 首行标记：从 CodeMirror 渲染结果里摘掉那一行，并把容器高度收回去
  function stripCMFirstLine(pre, lineEl) {
    const row = lineEl.closest('.CodeMirror-code > div') || lineEl.parentNode;
    const h = row.getBoundingClientRect().height || 0;
    row.remove();
    if (!h) return;
    const shrink = function (el, prop) {
      if (!el) return;
      const v = parseFloat(el.style[prop]);
      if (!isNaN(v)) el.style[prop] = Math.max(0, v - h) + 'px';
    };
    shrink(pre.querySelector('.CodeMirror'), 'height');
    shrink(pre.querySelector('.CodeMirror-gutters'), 'height');
    shrink(pre.querySelector('.CodeMirror-sizer'), 'minHeight');
    const spacer = pre.querySelector('.CodeMirror-sizer > div[style*="top"]');
    shrink(spacer, 'top');
    // 行号重新排一遍，删掉首行后不留空号
    pre.querySelectorAll('.CodeMirror-linenumber').forEach(function (n, i) {
      n.textContent = String(i + 1);
    });
  }

  // 首行标记：<code> 版（非 CodeMirror 导出）直接删掉第一行文本
  function stripCodeFirstLine(code) {
    const walker = document.createTreeWalker(code, NodeFilter.SHOW_TEXT);
    let node;
    while ((node = walker.nextNode())) {
      const i = node.nodeValue.indexOf('\n');
      if (i >= 0) { node.nodeValue = node.nodeValue.slice(i + 1); return; }
      node.nodeValue = '';
    }
  }

  document.querySelectorAll('#write pre, .typora-export pre').forEach(function (pre) {
    if (pre.closest('.CodeMirror')) return;

    const cmLines = pre.querySelectorAll('.CodeMirror-line');
    const cmCodeLines = pre.querySelectorAll('.CodeMirror-code pre');
    const isCM = cmLines.length > 0;
    const code = pre.querySelector('code');
    if (!isCM && !code) return;

    const langAttr = pre.getAttribute('lang');
    const langCls = code && Array.from(code.classList).find(function (c) { return c.startsWith('language-'); });
    const lang = (langAttr || (langCls ? langCls.slice(9) : 'code')).trim().split(/\s+/)[0] || 'code';

    // ── 解析展开策略 ──
    let mark = markFromSiblings(pre);
    if (isCM) {
      const first = cmLines[0];
      const mk = first && parseMark(first.textContent);
      if (mk) { mark = mk; stripCMFirstLine(pre, first); }
    } else {
      const firstLine = code.textContent.split('\n', 1)[0];
      const mk = parseMark(firstLine);
      if (mk) { mark = mk; stripCodeFirstLine(code); }
    }

    const lineCount = isCM
      ? pre.querySelectorAll('.CodeMirror-line').length
      : code.textContent.replace(/\n+$/, '').split('\n').length;

    const shouldOpen = mark ? mark.open
      : docDefault !== null ? docDefault
      : lineCount <= AUTO_OPEN_MAX_LINES;

    // Header bar
    const header = document.createElement('div');
    header.className = 'lec-code-header';

    const langLabel = document.createElement('span');
    langLabel.className = 'lec-lang-name';
    langLabel.textContent = lang;
    header.appendChild(langLabel);

    const titleEl = document.createElement('span');
    titleEl.className = 'lec-code-title';
    titleEl.textContent = mark && mark.title ? mark.title : '';
    header.appendChild(titleEl);

    const linesEl = document.createElement('span');
    linesEl.className = 'lec-code-lines';
    linesEl.textContent = lineCount + ' 行';
    header.appendChild(linesEl);

    const actions = document.createElement('div');
    actions.className = 'lec-header-actions';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'lec-header-btn';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'lec-header-btn';
    copyBtn.textContent = '复制';
    copyBtn.addEventListener('click', function (e) {
      e.stopPropagation();                  // 别连带触发 header 的折叠
      // 首行标记可能已被删掉 → 复制时重新取一次当前 DOM
      const src = isCM ? pre.querySelectorAll('.CodeMirror-code pre') : null;
      const text = src && src.length
        ? Array.from(src).map(function (l) { return l.textContent.replace(/​/g, '').replace(/ /g, ' '); }).join('\n')
        : code ? code.textContent : '';
      navigator.clipboard.writeText(text).then(function () {
        copyBtn.textContent = '已复制';
        copyBtn.classList.add('is-done');
        setTimeout(function () {
          copyBtn.textContent = '复制';
          copyBtn.classList.remove('is-done');
        }, 2000);
      });
    });

    actions.appendChild(toggleBtn);
    actions.appendChild(copyBtn);
    header.appendChild(actions);

    const inner = document.createElement('div');
    inner.className = 'lec-code-inner';

    // 组装：先把 wrap 插入正确位置，再移动 pre
    const wrap = document.createElement('div');
    wrap.className = 'lec-code-wrap';
    wrap.appendChild(header);
    const parent = pre.parentNode;
    parent.insertBefore(wrap, pre); // wrap 占位（pre 仍在 parent 中）
    inner.appendChild(pre);         // pre 从 parent 移入 inner
    wrap.appendChild(inner);

    function setOpen(open, animate) {
      wrap.classList.toggle('is-open', open);
      toggleBtn.textContent = open ? '▲ 收起' : '▼ 展开';
      if (!open) {
        // 收起：先钉住当前高度再回 0，否则 none → 0 不过渡
        inner.classList.remove('is-settled');
        if (animate) {
          inner.style.maxHeight = inner.scrollHeight + 'px';
          void inner.offsetHeight;
        }
        inner.style.maxHeight = '0px';
        return;
      }
      const settle = function () {
        if (!wrap.classList.contains('is-open')) return;
        inner.style.maxHeight = 'none';
        inner.classList.add('is-settled');
      };
      if (!animate) { settle(); return; }
      inner.style.maxHeight = inner.scrollHeight + 'px';
      // 动画结束后解除限制，让内容（长行/公式）自然撑开
      setTimeout(settle, 320);
    }

    // 整条 header 都能点，按钮只是视觉提示
    header.addEventListener('click', function () {
      setOpen(!wrap.classList.contains('is-open'), true);
    });

    setOpen(shouldOpen, false);
  });

  // 4. 动画演示卡片 iframe：撑开内部高度上限并自适应
  document.querySelectorAll('.lec-demo iframe').forEach(function (frame) {
    const fallback = parseInt(frame.getAttribute('data-height'), 10) || 640;
    frame.style.height = fallback + 'px';

    function fit() {
      // 同源才能读 contentDocument；file:// 下 Chrome 会抛错，保持 fallback 高度
      let doc;
      try {
        doc = frame.contentDocument;
        if (!doc || !doc.body) return;
      } catch (e) { return; }

      const app = doc.querySelector('.app') || doc.body;
      // 解除演示页自身的 60vh / max-height 限制，让内容完整展开
      app.style.height = 'auto';
      app.style.maxHeight = 'none';
      app.style.minHeight = '0';
      app.style.overflowY = 'visible';
      doc.documentElement.style.minHeight = '0';
      doc.body.style.minHeight = '0';

      const h = Math.ceil(app.getBoundingClientRect().height) + 24;
      if (Math.abs(h - parseInt(frame.style.height, 10)) > 2) {
        frame.style.height = h + 'px';
      }
    }

    frame.addEventListener('load', function () {
      fit();
      let doc;
      try { doc = frame.contentDocument; } catch (e) { return; }
      if (!doc || !doc.body || typeof ResizeObserver === 'undefined') return;
      // 演示过程中素数列表会变长 → 跟随重算
      new ResizeObserver(fit).observe(doc.querySelector('.app') || doc.body);
    });

    if (frame.contentDocument && frame.contentDocument.readyState === 'complete') fit();
    window.addEventListener('resize', fit);
  });
})();
