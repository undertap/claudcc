// Claude Code ships some built-in skills; users install more under ~/.claude/skills/
// and plugins can also bundle skills. Each skill is a directory with a SKILL.md file
// whose YAML frontmatter contains `name` and `description`.

const fs = require('fs');
const path = require('path');

const { CLAUDE_HOME, listDirSafe, readTextSafe, statSafe, zeros } = require('../paths');

function parseFrontmatter(md) {
  // Very small YAML-frontmatter parser, just for name/description/allowed-tools.
  const m = md.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!m) return {};
  const out = {};
  for (const line of m[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z0-9_-]+)\s*:\s*(.*)$/);
    if (kv) out[kv[1].trim()] = kv[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function firstParagraph(md) {
  const body = md.replace(/^---[\s\S]*?---\s*/, '').trim();
  const para = body.split(/\n\s*\n/)[0] || '';
  return para.replace(/\s+/g, ' ').trim().slice(0, 400);
}

function scanSkillDir(dir, sourceLabel) {
  const out = [];
  const entries = listDirSafe(dir);
  for (const ent of entries) {
    if (!ent.isDirectory()) continue;
    const skillDir = path.join(dir, ent.name);
    const skillFile = path.join(skillDir, 'SKILL.md');
    const st = statSafe(skillFile);
    if (!st) continue;
    const raw = readTextSafe(skillFile);
    const fm = parseFrontmatter(raw);
    const summary = fm.description || firstParagraph(raw) || 'No description provided.';
    out.push({
      id: `skill:${ent.name}`,
      // Match session events where tool_use.input.skill (or .name) matches.
      // Try both the frontmatter name and the directory name — some skills
      // are invoked by folder name, some by their YAML name.
      _matchKeys: Array.from(new Set([
        `skill:${fm.name || ent.name}`,
        `skill:${ent.name}`,
      ])),
      name: fm.name || ent.name,
      kind: 'skill',
      source: sourceLabel + '/' + ent.name,
      status: 'active',
      installed: st.birthtimeMs || st.ctimeMs,
      summary,
      triggers: fm.description ? [fm.description.split('.')[0]] : [],
      tags: ['skill'],
      tools: fm['allowed-tools'] ? String(fm['allowed-tools']).split(/\s*,\s*/) : [],
      examples: [],
    });
  }
  return out;
}

function scanSkills() {
  const skills = [];
  // User-level skills
  skills.push(...scanSkillDir(path.join(CLAUDE_HOME, 'skills'), '~/.claude/skills'));
  // Project-level skills (cwd at launch)
  skills.push(...scanSkillDir(path.join(process.cwd(), '.claude', 'skills'), './.claude/skills'));
  // Plugin-provided skills
  const pluginsRoot = path.join(CLAUDE_HOME, 'plugins', 'marketplaces');
  for (const mp of listDirSafe(pluginsRoot)) {
    if (!mp.isDirectory()) continue;
    const mpPath = path.join(pluginsRoot, mp.name);
    for (const plug of listDirSafe(mpPath)) {
      if (!plug.isDirectory()) continue;
      const plugSkillDir = path.join(mpPath, plug.name, 'skills');
      if (statSafe(plugSkillDir)) {
        skills.push(
          ...scanSkillDir(plugSkillDir, `plugin:${mp.name}/${plug.name}`)
        );
      }
    }
  }

  // Dedupe by id keeping the first occurrence (user-level wins over plugin).
  const seen = new Set();
  return skills.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

module.exports = { scanSkills };
