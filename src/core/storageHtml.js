const { escapeXml, decodeEntities, plainTextOf } = require('./markup');

function cdataToHtml(s) {
  return escapeXml(plainTextOf(s));
}

function attr(tag, name) {
  const m = tag.match(new RegExp(name + '\\s*=\\s*"([^"]*)"'));
  return m ? decodeEntities(m[1]) : '';
}

function storageToHtml(input) {
  let s = String(input);

  s = s.replace(/<ac:structured-macro[^>]*ac:name="code"[^>]*>([\s\S]*?)<\/ac:structured-macro>/g, (m, body) => {
    const lang = (body.match(/<ac:parameter[^>]*ac:name="language"[^>]*>([\s\S]*?)<\/ac:parameter>/) || [])[1] || '';
    const code = body.match(/<ac:plain-text-body>([\s\S]*?)<\/ac:plain-text-body>/);
    return '<pre data-code-language="' + escapeXml(lang.trim()) + '">' +
      (code ? cdataToHtml(code[1]) : '') + '</pre>';
  });
  s = s.replace(/<ac:structured-macro[^>]*ac:name="[^"]*mermaid[^"]*"[^>]*>([\s\S]*?)<\/ac:structured-macro>/gi, (m, body) => {
    const code = body.match(/<ac:plain-text-body>([\s\S]*?)<\/ac:plain-text-body>/);
    return code ? '<pre data-code-language="mermaid">' + cdataToHtml(code[1]) + '</pre>' : '';
  });
  s = s.replace(/<ac:structured-macro[^>]*ac:name="(toc|anchor|children|pagetree)"[^>]*(?:\/>|>[\s\S]*?<\/ac:structured-macro>)/g, '');
  s = s.replace(/<ac:structured-macro[^>]*ac:name="(info|note|warning|tip|panel)"[^>]*>([\s\S]*?)<\/ac:structured-macro>/g,
    (m, kind, body) => {
      const rich = body.match(/<ac:rich-text-body>([\s\S]*?)<\/ac:rich-text-body>/);
      return '<div class="confluence-information-macro confluence-information-macro-' + kind + '">' +
        (rich ? rich[1] : body) + '</div>';
    });
  s = s.replace(/<ac:structured-macro[^>]*ac:name="status"[^>]*>([\s\S]*?)<\/ac:structured-macro>/g, (m, body) => {
    const t = body.match(/<ac:parameter[^>]*ac:name="title"[^>]*>([\s\S]*?)<\/ac:parameter>/);
    return t ? '<code>' + t[1] + '</code>' : '';
  });
  s = s.replace(/<ac:structured-macro[^>]*>([\s\S]*?)<\/ac:structured-macro>/g, (m, body) => {
    const rich = body.match(/<ac:rich-text-body>([\s\S]*?)<\/ac:rich-text-body>/);
    return rich ? rich[1] : '';
  });

  s = s.replace(/<ac:task-list>([\s\S]*?)<\/ac:task-list>/g, (m, body) => {
    const items = [];
    body.replace(/<ac:task>([\s\S]*?)<\/ac:task>/g, (mm, task) => {
      const done = /<ac:task-status>complete<\/ac:task-status>/.test(task);
      const tb = task.match(/<ac:task-body>([\s\S]*?)<\/ac:task-body>/);
      items.push('<li class="' + (done ? 'checked' : '') + '">' + (tb ? tb[1] : '') + '</li>');
      return mm;
    });
    return '<ul class="inline-task-list">' + items.join('') + '</ul>';
  });

  s = s.replace(/<ac:link[^>]*>([\s\S]*?)<\/ac:link>/g, (m, body) => {
    const page = body.match(/<ri:page[^>]*\/?>/);
    const label = body.match(/<ac:(?:plain-text-)?link-body>([\s\S]*?)<\/ac:(?:plain-text-)?link-body>/);
    const labelHtml = label ? cdataToHtml(label[1]) : '';
    if (page) {
      const title = attr(page[0], 'ri:content-title');
      const spaceKey = attr(page[0], 'ri:space-key');
      const target = (spaceKey ? encodeURIComponent(spaceKey) + '/' : '') + encodeURIComponent(title);
      return '<a href="confluence:' + target + '">' + (labelHtml || escapeXml(title)) + '</a>';
    }
    const user = body.match(/<ri:user[^>]*\/?>/);
    if (user) {
      const name = attr(user[0], 'ri:username');
      return name ? '@' + escapeXml(name) : labelHtml;
    }
    return labelHtml;
  });

  s = s.replace(/<ac:image[^>]*>([\s\S]*?)<\/ac:image>/g, (m, body) => {
    const att = body.match(/<ri:attachment[^>]*\/?>/);
    const url = body.match(/<ri:url[^>]*\/?>/);
    const name = att ? attr(att[0], 'ri:filename') : (url ? attr(url[0], 'ri:value') : '');
    return '<img alt="' + escapeXml(name) + '">';
  });

  s = s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (m, t) => escapeXml(t));
  s = s.replace(/<\/?(?:ac|ri):[a-zA-Z-]+[^<>]*>/g, '');
  return s;
}

function stripTags(s) {
  return String(s).replace(/<[^>]*>/g, '');
}

function flattenIssueTable(body) {
  const rows = [];
  String(body).replace(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi, (m, row) => {
    if (/<th\b/i.test(row)) return m;
    const cells = [];
    row.replace(/<td\b[^>]*>([\s\S]*?)<\/td>/gi, (mm, cell) => {
      if (stripTags(cell).trim()) cells.push(cell.trim());
      return mm;
    });
    if (cells.length) rows.push(cells.join(' — '));
    return m;
  });
  return rows.length ? '<span>' + rows.join('; ') + '</span>' : '';
}

function cleanupConfluenceHtml(input) {
  let s = String(input);

  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');

  s = s.replace(/<table\b[^>]*class="[^"]*\bjira-issues\b[^"]*"[^>]*>([\s\S]*?)<\/table>/gi,
    (m, body) => flattenIssueTable(body));

  s = s.replace(/<colgroup\b[^>]*>[\s\S]*?<\/colgroup>/gi, '');
  s = s.replace(/<colgroup\b[^>]*\/>/gi, '');

  s = s.replace(/<span\b([^>]*\bclass="[^"]*\bjira-status\b[^"]*"[^>]*)>/gi, ' <span$1>');

  s = s.replace(/(<t[hd]\b[^>]*>)([\s\S]*?)(<\/t[hd]>)/gi,
    (m, open, body, close) => open + body.replace(/<\/?h[1-6]\b[^>]*>/gi, '') + close);

  return s;
}

module.exports = { storageToHtml, cleanupConfluenceHtml };
