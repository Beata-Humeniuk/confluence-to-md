const FENCE = /^[ \t]*(?:```|~~~)/;
const MD_LINK = /(!?)\[([^\]]*)\]\((?:<([^<>]+?\.md)(#[^<>]*)?>|([^()\s<>]+?\.md)(#[^()\s<>]*)?)\)/gi;

function decode(s) {
  try {
    return decodeURIComponent(s);
  } catch (e) {
    return s;
  }
}

function isLocal(target) {
  return !/^[a-z][a-z0-9+.-]*:/i.test(target) && target.charAt(0) !== '/';
}

function eachOutsideFences(markdown, replaceLine) {
  let fenced = false;
  return String(markdown).split('\n').map((line) => {
    if (FENCE.test(line)) {
      fenced = !fenced;
      return line;
    }
    return fenced ? line : replaceLine(line);
  }).join('\n');
}

function mdLinkTargets(markdown) {
  const targets = [];
  eachOutsideFences(markdown, (line) => line.replace(MD_LINK, (whole, bang, label, angled, ah, plain) => {
    const target = decode(angled || plain);
    if (!bang && isLocal(target) && targets.indexOf(target) < 0) targets.push(target);
    return whole;
  }));
  return targets;
}

function linkLocalPages(markdown, urlByTarget) {
  return eachOutsideFences(markdown, (line) => line.replace(MD_LINK, (whole, bang, label, angled, ah, plain) => {
    const target = decode(angled || plain);
    if (bang || !urlByTarget.has(target)) return whole;
    const url = urlByTarget.get(target);
    return url ? '[' + label + '](' + url + ')' : label;
  }));
}

module.exports = { mdLinkTargets, linkLocalPages };
