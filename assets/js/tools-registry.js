/* =========================================
   MohakTools — Central Tool Registry
   File: assets/js/tools-registry.js
   Data: assets/data/tools.json

   Loads the tool catalogue from JSON, then exposes a small,
   frozen API on window.MohakToolsRegistry. Everything that needs
   the catalogue (header nav, footer, listings, search) waits on
   `registry.ready` or the "mohaktools:registry-ready" event.
   ========================================= */

(() => {
  "use strict";

  const DATA_URL = "/assets/data/tools.json";

  const state = {
    categories: [],
    tools: [],
    byId: new Map(),
    byCategory: new Map(),
    loaded: false,
    error: null
  };

  /* ---------- text helpers ---------- */

  function normalize(value) {
    return String(value == null ? "" : value)
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // True when every character of `needle` appears in `hay` in order.
  // Lets "alrm" match "alarm" and "cntdwn" match "countdown".
  function isSubsequence(needle, hay) {
    if (!needle) return false;
    let index = 0;
    for (let i = 0; i < hay.length && index < needle.length; i += 1) {
      if (hay[i] === needle[index]) index += 1;
    }
    return index === needle.length;
  }

  function levenshtein(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;

    let previous = new Array(b.length + 1);
    let current = new Array(b.length + 1);

    for (let j = 0; j <= b.length; j += 1) previous[j] = j;

    for (let i = 1; i <= a.length; i += 1) {
      current[0] = i;
      for (let j = 1; j <= b.length; j += 1) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        current[j] = Math.min(
          previous[j] + 1,
          current[j - 1] + 1,
          previous[j - 1] + cost
        );
      }
      const swap = previous;
      previous = current;
      current = swap;
    }

    return previous[b.length];
  }

  /* ---------- build ---------- */

  function buildIndex(data) {
    const categories = Array.isArray(data.categories)
      ? data.categories.map(category => ({
          id: String(category.id),
          name: String(category.name || category.id)
        }))
      : [];

    const categoryNames = new Map(categories.map(c => [c.id, c.name]));

    const tools = (Array.isArray(data.tools) ? data.tools : []).map(tool => {
      const id = String(tool.id);
      const keywords = Array.isArray(tool.keywords)
        ? tool.keywords.map(String)
        : [];

      return {
        id,
        name: String(tool.name || id),
        category: String(tool.category || ""),
        categoryName: categoryNames.get(String(tool.category)) || String(tool.category || ""),
        url: String(tool.url || `/tools/${id}/`),
        description: String(tool.description || ""),
        keywords,
        icon: String(tool.icon || "•"),
        featured: Boolean(tool.featured),
        popularity: Number(tool.popularity) || 0,
        // Pre-normalised search fields (built once, reused on every keystroke).
        _name: normalize(tool.name),
        _id: normalize(id),
        _category: normalize(categoryNames.get(String(tool.category)) || tool.category),
        _description: normalize(tool.description),
        _keywords: keywords.map(normalize)
      };
    });

    state.categories = categories;
    state.tools = tools;
    state.byId = new Map(tools.map(tool => [tool.id, tool]));

    state.byCategory = new Map(categories.map(c => [c.id, []]));
    for (const tool of tools) {
      if (!state.byCategory.has(tool.category)) {
        state.byCategory.set(tool.category, []);
        // Category used by a tool but not declared — surface it anyway.
        state.categories.push({ id: tool.category, name: tool.categoryName });
      }
      state.byCategory.get(tool.category).push(tool);
    }

    state.loaded = true;
  }

  function publicTool(tool) {
    return {
      id: tool.id,
      name: tool.name,
      category: tool.category,
      categoryName: tool.categoryName,
      url: tool.url,
      description: tool.description,
      keywords: tool.keywords.slice(),
      icon: tool.icon,
      featured: tool.featured,
      popularity: tool.popularity
    };
  }

  /* ---------- search scoring ---------- */

  function scoreTerm(term, tool) {
    let score = 0;

    // Name signals (strongest).
    if (tool._name === term) score = Math.max(score, 220);
    else if (tool._name.startsWith(term)) score = Math.max(score, 150);
    else if (new RegExp("(^|\\s)" + escapeRegExp(term)).test(tool._name)) {
      score = Math.max(score, 110);
    } else if (tool._name.includes(term)) score = Math.max(score, 75);

    // Slug / id.
    if (tool._id.includes(term)) score = Math.max(score, 60);

    // Keywords.
    for (const keyword of tool._keywords) {
      if (keyword === term) score = Math.max(score, 95);
      else if (keyword.startsWith(term)) score = Math.max(score, 70);
      else if (keyword.includes(term)) score = Math.max(score, 45);
      else if (term.length >= 4 && levenshtein(keyword, term) <= 1) {
        score = Math.max(score, 35);
      }
    }

    // Category and description (weaker).
    if (tool._category.includes(term)) score = Math.max(score, 30);
    if (tool._description.includes(term)) score = Math.max(score, 20);

    // Fuzzy fallbacks for typos and abbreviations.
    if (score === 0) {
      if (term.length >= 4 && isSubsequence(term, tool._name)) score = 25;
      else if (term.length >= 4 && levenshtein(tool._name, term) <= 1) score = 30;
      else if (term.length >= 4) {
        for (const keyword of tool._keywords) {
          if (levenshtein(keyword, term) <= 1) { score = 22; break; }
        }
      }
    }

    return score;
  }

  function search(query) {
    const terms = normalize(query).split(" ").filter(Boolean);
    if (!terms.length || !state.loaded) return [];

    const scored = [];

    for (const tool of state.tools) {
      let total = 0;
      let missing = false;

      for (const term of terms) {
        const termScore = scoreTerm(term, tool);
        if (termScore === 0) missing = true;
        total += termScore;
      }

      if (total <= 0) continue;

      // Soft AND: a tool that matches every term ranks far above one
      // that only matches some of them.
      if (missing) total *= 0.3;

      total += tool.popularity / 1000; // gentle popularity tie-break
      scored.push({ tool, score: total });
    }

    return scored
      .sort((a, b) => b.score - a.score || b.tool.popularity - a.tool.popularity)
      .map(item => publicTool(item.tool));
  }

  /* ---------- public API ---------- */

  const api = {
    ready: null,

    isReady() {
      return state.loaded;
    },

    getError() {
      return state.error;
    },

    getAll() {
      return state.tools.map(publicTool);
    },

    getById(id) {
      const tool = state.byId.get(String(id));
      return tool ? publicTool(tool) : null;
    },

    getByCategory(categoryId) {
      return (state.byCategory.get(String(categoryId)) || []).map(publicTool);
    },

    getCategories() {
      return state.categories.map(category => ({
        id: category.id,
        name: category.name,
        count: (state.byCategory.get(category.id) || []).length
      }));
    },

    getFeatured(limit = 8) {
      return state.tools
        .filter(tool => tool.featured)
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, limit)
        .map(publicTool);
    },

    getPopular(limit = 8) {
      return state.tools
        .slice()
        .sort((a, b) => b.popularity - a.popularity)
        .slice(0, limit)
        .map(publicTool);
    },

    search,

    get count() {
      return state.tools.length;
    }
  };

  api.ready = fetch(DATA_URL, { cache: "no-cache" })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${DATA_URL}`);
      return response.json();
    })
    .then(data => {
      buildIndex(data);
      document.dispatchEvent(
        new CustomEvent("mohaktools:registry-ready", {
          detail: { count: state.tools.length, categories: state.categories.length }
        })
      );
      return api;
    })
    .catch(error => {
      state.error = error;
      console.error("MohakTools: unable to load tools.json.", error);
      document.dispatchEvent(
        new CustomEvent("mohaktools:registry-error", { detail: { error } })
      );
      return api;
    });

  window.MohakToolsRegistry = Object.freeze(api);
})();
