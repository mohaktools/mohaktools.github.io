/* =========================================================
   MOHAKTOOLS SETTINGS
   File: assets/js/settings.js

   Features:
   - Shared theme preference: system / light / dark
   - Accent color customization
   - Font size preference
   - Reduced motion preference
   - Notification preferences
   - Persistent settings using localStorage
   - Reset settings to defaults

   Requires:
   - assets/js/theme.js
   - A settings page containing <div id="settings-app"></div>
   ========================================================= */

(function () {
  "use strict";

  const STORAGE_KEY = "mohaktools-settings";

  const DEFAULT_SETTINGS = {
    accentColor: "#4f46e5",
    fontSize: "medium",
    reducedMotion: false,
    notifications: {
      enabled: true,
      toolUpdates: true,
      tips: true
    }
  };

  const ACCENT_PRESETS = [
    { name: "Indigo", value: "#4f46e5" },
    { name: "Blue", value: "#2563eb" },
    { name: "Cyan", value: "#0891b2" },
    { name: "Green", value: "#16a34a" },
    { name: "Teal", value: "#0d9488" },
    { name: "Orange", value: "#ea580c" },
    { name: "Red", value: "#dc2626" },
    { name: "Pink", value: "#db2777" },
    { name: "Purple", value: "#9333ea" }
  ];

  let settings = loadSettings();

  function cloneDefaults() {
    return JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  }

  function loadSettings() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);

      if (!saved) {
        return cloneDefaults();
      }

      const parsed = JSON.parse(saved);
      const defaults = cloneDefaults();

      return {
        ...defaults,
        ...parsed,
        notifications: {
          ...defaults.notifications,
          ...(parsed.notifications || {})
        }
      };
    } catch (error) {
      console.warn("MohakTools: Could not load settings.", error);
      return cloneDefaults();
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      return true;
    } catch (error) {
      console.warn("MohakTools: Could not save settings.", error);
      showToast("Settings could not be saved in this browser.");
      return false;
    }
  }

  function isValidColor(value) {
    return typeof value === "string" &&
      /^#[0-9a-fA-F]{6}$/.test(value);
  }

  function applySettings() {
    const root = document.documentElement;

    /* Accent color */
    const accent = isValidColor(settings.accentColor)
      ? settings.accentColor
      : DEFAULT_SETTINGS.accentColor;

    root.style.setProperty("--mt-accent", accent);
    root.style.setProperty("--accent-color", accent);
    root.style.setProperty("--color-primary", accent);

    /* Font size */
    const fontSizes = {
      small: "14px",
      medium: "16px",
      large: "18px"
    };

    root.style.setProperty(
      "--mt-base-font-size",
      fontSizes[settings.fontSize] || fontSizes.medium
    );

    root.dataset.fontSize = settings.fontSize;

    /* Reduced motion */
    root.dataset.reducedMotion = String(settings.reducedMotion);

    let motionStyle = document.getElementById("mt-settings-motion-style");

    if (!motionStyle) {
      motionStyle = document.createElement("style");
      motionStyle.id = "mt-settings-motion-style";
      document.head.appendChild(motionStyle);
    }

    motionStyle.textContent = settings.reducedMotion
      ? `
        *,
        *::before,
        *::after {
          scroll-behavior: auto !important;
          animation-duration: 0.01ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.01ms !important;
        }
      `
      : "";

    /* Apply theme using the shared theme controller */
    const savedTheme = getThemePreference();

    if (window.MohakTheme && typeof window.MohakTheme.set === "function") {
      window.MohakTheme.set(savedTheme);
    }

    /* Make notification preferences available to other scripts */
    window.MohakNotificationPreferences = {
      ...settings.notifications
    };

    window.dispatchEvent(
      new CustomEvent("mohaktools:settings-changed", {
        detail: getSettings()
      })
    );
  }

  function getThemePreference() {
    if (window.MohakTheme && typeof window.MohakTheme.get === "function") {
      return window.MohakTheme.get();
    }

    try {
      return localStorage.getItem("mohaktools-theme") || "system";
    } catch (error) {
      return "system";
    }
  }

  function updateSetting(key, value) {
    if (key === "accentColor" && !isValidColor(value)) {
      return;
    }

    if (key === "fontSize" && !["small", "medium", "large"].includes(value)) {
      return;
    }

    if (key === "reducedMotion") {
      settings.reducedMotion = Boolean(value);
    } else {
      settings[key] = value;
    }

    saveSettings();
    applySettings();
  }

  function updateNotificationSetting(key, value) {
    if (!Object.prototype.hasOwnProperty.call(
      settings.notifications,
      key
    )) {
      return;
    }

    settings.notifications[key] = Boolean(value);

    /* Turning off all notifications disables their subcategories. */
    if (key === "enabled" && !value) {
      settings.notifications.toolUpdates = false;
      settings.notifications.tips = false;
    }

    saveSettings();
    applySettings();
    renderSettings();
  }

  function resetSettings() {
    settings = cloneDefaults();

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.warn("MohakTools: Could not clear saved settings.", error);
    }

    if (window.MohakTheme && typeof window.MohakTheme.reset === "function") {
      window.MohakTheme.reset();
    } else {
      try {
        localStorage.removeItem("mohaktools-theme");
      } catch (error) {
        /* Storage may be unavailable. */
      }
    }

    saveSettings();
    applySettings();
    renderSettings();
    showToast("Settings restored to defaults.");
  }

  function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, function (character) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      }[character];
    });
  }

  function getSettingsStyles() {
    return `
      .mt-settings {
        --mt-settings-border: var(--border-color, #e5e7eb);
        --mt-settings-surface: var(--card-background, var(--surface-color, #ffffff));
        --mt-settings-text: var(--text-color, #171717);
        --mt-settings-muted: var(--muted-text-color, #6b7280);
        color: var(--mt-settings-text);
        width: 100%;
        max-width: 960px;
        margin: 0 auto;
        padding: 24px 16px 48px;
        font-size: var(--mt-base-font-size, 16px);
      }

      .mt-settings *,
      .mt-settings *::before,
      .mt-settings *::after {
        box-sizing: border-box;
      }

      .mt-settings-header {
        margin-bottom: 28px;
      }

      .mt-settings-header h1 {
        margin: 0 0 8px;
        font-size: clamp(1.8rem, 4vw, 2.5rem);
        line-height: 1.2;
      }

      .mt-settings-header p {
        margin: 0;
        color: var(--mt-settings-muted);
        line-height: 1.6;
      }

      .mt-settings-section {
        margin: 20px 0;
        padding: 22px;
        border: 1px solid var(--mt-settings-border);
        border-radius: 16px;
        background: var(--mt-settings-surface);
      }

      .mt-settings-section h2 {
        margin: 0 0 6px;
        font-size: 1.2rem;
      }

      .mt-settings-section-description {
        margin: 0 0 18px;
        color: var(--mt-settings-muted);
        font-size: 0.92em;
        line-height: 1.6;
      }

      .mt-setting-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 16px 0;
        border-top: 1px solid var(--mt-settings-border);
      }

      .mt-setting-row:first-of-type {
        border-top: 0;
      }

      .mt-setting-label {
        display: block;
        margin-bottom: 4px;
        font-weight: 600;
      }

      .mt-setting-help {
        display: block;
        color: var(--mt-settings-muted);
        font-size: 0.88em;
        line-height: 1.5;
      }

      .mt-setting-control {
        flex-shrink: 0;
        max-width: 100%;
      }

      .mt-settings select,
      .mt-settings input[type="color"] {
        min-height: 42px;
        border: 1px solid var(--mt-settings-border);
        border-radius: 9px;
        background: var(--background-color, var(--page-background, #ffffff));
        color: var(--mt-settings-text);
        font: inherit;
      }

      .mt-settings select {
        min-width: 145px;
        padding: 8px 30px 8px 10px;
      }

      .mt-settings input[type="color"] {
        width: 56px;
        padding: 4px;
        cursor: pointer;
      }

      .mt-accent-options {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin: 14px 0 4px;
      }

      .mt-accent-swatch {
        width: 34px;
        height: 34px;
        border: 3px solid transparent;
        outline: 1px solid var(--mt-settings-border);
        border-radius: 50%;
        cursor: pointer;
        background: var(--swatch-color);
      }

      .mt-accent-swatch[aria-pressed="true"] {
        border-color: var(--mt-settings-surface);
        outline: 2px solid var(--mt-settings-text);
      }

      .mt-accent-custom {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 16px;
      }

      .mt-settings-toggle {
        position: relative;
        display: inline-flex;
        width: 48px;
        height: 28px;
        flex-shrink: 0;
      }

      .mt-settings-toggle input {
        position: absolute;
        width: 1px;
        height: 1px;
        opacity: 0;
      }

      .mt-settings-toggle-track {
        position: absolute;
        inset: 0;
        border-radius: 999px;
        background: #9ca3af;
        cursor: pointer;
        transition: background 0.2s ease;
      }

      .mt-settings-toggle-track::before {
        position: absolute;
        top: 3px;
        left: 3px;
        width: 22px;
        height: 22px;
        border-radius: 50%;
        background: #ffffff;
        content: "";
        transition: transform 0.2s ease;
      }

      .mt-settings-toggle input:checked + .mt-settings-toggle-track {
        background: var(--mt-accent, #4f46e5);
      }

      .mt-settings-toggle input:checked + .mt-settings-toggle-track::before {
        transform: translateX(20px);
      }

      .mt-settings-toggle input:focus-visible + .mt-settings-toggle-track {
        outline: 3px solid var(--mt-accent, #4f46e5);
        outline-offset: 3px;
      }

      .mt-settings-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 28px;
      }

      .mt-settings-button {
        min-height: 44px;
        padding: 10px 16px;
        border: 1px solid var(--mt-settings-border);
        border-radius: 10px;
        background: var(--mt-settings-surface);
        color: var(--mt-settings-text);
        font: inherit;
        font-weight: 600;
        cursor: pointer;
      }

      .mt-settings-button-primary {
        border-color: var(--mt-accent, #4f46e5);
        background: var(--mt-accent, #4f46e5);
        color: #ffffff;
      }

      .mt-settings-button:focus-visible,
      .mt-accent-swatch:focus-visible {
        outline: 3px solid var(--mt-accent, #4f46e5);
        outline-offset: 3px;
      }

      .mt-settings-toast {
        position: fixed;
        right: 20px;
        bottom: 20px;
        z-index: 9999;
        max-width: min(360px, calc(100vw - 40px));
        padding: 12px 16px;
        border-radius: 10px;
        background: var(--mt-accent, #4f46e5);
        color: #ffffff;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
        font-size: 14px;
      }

      @media (max-width: 600px) {
        .mt-settings {
          padding: 20px 12px 36px;
        }

        .mt-settings-section {
          padding: 16px;
        }

        .mt-setting-row {
          align-items: flex-start;
          gap: 12px;
        }

        .mt-setting-control {
          max-width: 48%;
        }

        .mt-settings select {
          min-width: 120px;
          width: 100%;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .mt-settings *,
        .mt-settings *::before,
        .mt-settings *::after {
          scroll-behavior: auto !important;
          animation-duration: 0.01ms !important;
          transition-duration: 0.01ms !important;
        }
      }
    `;
  }

  function toggleMarkup(id, label, help, checked, notificationKey) {
    const safeId = escapeHTML(id);
    const keyAttribute = notificationKey
      ? `data-notification-key="${escapeHTML(notificationKey)}"`
      : "";

    return `
      <div class="mt-setting-row">
        <div>
          <label class="mt-setting-label" for="${safeId}">
            ${escapeHTML(label)}
          </label>
          <span class="mt-setting-help">${escapeHTML(help)}</span>
        </div>
        <div class="mt-setting-control">
          <label class="mt-settings-toggle">
            <input
              id="${safeId}"
              type="checkbox"
              ${checked ? "checked" : ""}
              ${keyAttribute}
            >
            <span class="mt-settings-toggle-track"></span>
          </label>
        </div>
      </div>
    `;
  }

  function renderSettings() {
    const mount =
      document.getElementById("settings-app") ||
      document.getElementById("settings-content");

    if (!mount) {
      return;
    }

    let style = document.getElementById("mt-settings-styles");

    if (!style) {
      style = document.createElement("style");
      style.id = "mt-settings-styles";
      document.head.appendChild(style);
    }

    style.textContent = getSettingsStyles();

    const currentTheme = getThemePreference();

    mount.innerHTML = `
      <div class="mt-settings">
        <header class="mt-settings-header">
          <h1>Settings</h1>
          <p>Customize how MohakTools looks and behaves on this device.</p>
        </header>

        <section class="mt-settings-section" aria-labelledby="mt-appearance-title">
          <h2 id="mt-appearance-title">Appearance</h2>
          <p class="mt-settings-section-description">
            These preferences apply across the website on this browser.
          </p>

          <div class="mt-setting-row">
            <div>
              <label class="mt-setting-label" for="mt-theme-choice">Theme</label>
              <span class="mt-setting-help">
                Choose a theme or follow your device's appearance.
              </span>
            </div>
            <div class="mt-setting-control">
              <select id="mt-theme-choice" data-theme-selector>
                <option value="system" ${currentTheme === "system" ? "selected" : ""}>System</option>
                <option value="light" ${currentTheme === "light" ? "selected" : ""}>Light</option>
                <option value="dark" ${currentTheme === "dark" ? "selected" : ""}>Dark</option>
              </select>
            </div>
          </div>

          <div class="mt-setting-row">
            <div>
              <span class="mt-setting-label">Accent color</span>
              <span class="mt-setting-help">
                Change the primary color used for buttons and highlights.
              </span>
            </div>
            <div class="mt-setting-control">
              <input
                type="color"
                id="mt-accent-color"
                aria-label="Choose accent color"
                value="${escapeHTML(settings.accentColor)}"
              >
            </div>
          </div>

          <div class="mt-accent-options" aria-label="Preset accent colors">
            ${ACCENT_PRESETS.map(function (preset) {
              const selected = preset.value.toLowerCase() ===
                settings.accentColor.toLowerCase();

              return `
                <button
                  type="button"
                  class="mt-accent-swatch"
                  style="--swatch-color:${preset.value}"
                  data-accent="${preset.value}"
                  aria-label="${preset.name}"
                  aria-pressed="${selected}"
                  title="${preset.name}"
                ></button>
              `;
            }).join("")}
          </div>

          <div class="mt-setting-row">
            <div>
              <label class="mt-setting-label" for="mt-font-size">Text size</label>
              <span class="mt-setting-help">
                Adjust the base text size throughout the site.
              </span>
            </div>
            <div class="mt-setting-control">
              <select id="mt-font-size">
                <option value="small" ${settings.fontSize === "small" ? "selected" : ""}>Small</option>
                <option value="medium" ${settings.fontSize === "medium" ? "selected" : ""}>Medium</option>
                <option value="large" ${settings.fontSize === "large" ? "selected" : ""}>Large</option>
              </select>
            </div>
          </div>

          ${toggleMarkup(
            "mt-reduced-motion",
            "Reduce motion",
            "Minimize animations and transitions.",
            settings.reducedMotion
          )}
        </section>

        <section class="mt-settings-section" aria-labelledby="mt-notifications-title">
          <h2 id="mt-notifications-title">Notifications</h2>
          <p class="mt-settings-section-description">
            Control which optional site notifications are enabled.
            Browser notification permission is separate from these preferences.
          </p>

          ${toggleMarkup(
            "mt-notifications-enabled",
            "Enable notifications",
            "Allow supported site features to show optional notifications.",
            settings.notifications.enabled,
            "enabled"
          )}

          ${toggleMarkup(
            "mt-notifications-updates",
            "Tool updates",
            "Notifications about new tools and tool changes.",
            settings.notifications.toolUpdates,
            "toolUpdates"
          )}

          ${toggleMarkup(
            "mt-notifications-tips",
            "Tips and suggestions",
            "Optional tips for using the website's tools.",
            settings.notifications.tips,
            "tips"
          )}
        </section>

        <section class="mt-settings-section" aria-labelledby="mt-data-title">
          <h2 id="mt-data-title">Preferences and data</h2>
          <p class="mt-settings-section-description">
            Settings are stored locally in this browser. Clearing browser data
            may remove them. This does not clear your browser history or other
            website data.
          </p>

          <div class="mt-settings-actions">
            <button
              type="button"
              class="mt-settings-button mt-settings-button-primary"
              id="mt-settings-reset"
            >
              Reset settings
            </button>
          </div>
        </section>

        <div
          id="mt-settings-toast"
          class="mt-settings-toast"
          role="status"
          aria-live="polite"
          hidden
        ></div>
      </div>
    `;

    bindSettingsEvents(mount);
    applySettings();
  }

  function showToast(message) {
    const toast = document.getElementById("mt-settings-toast");

    if (!toast) {
      return;
    }

    toast.textContent = message;
    toast.hidden = false;

    /* CSS-only display; no timer or browser API needed. */
    toast.dataset.visible = "true";

    if (toast._hideHandler) {
      toast.removeEventListener("click", toast._hideHandler);
    }

    toast._hideHandler = function () {
      toast.hidden = true;
    };

    toast.addEventListener("click", toast._hideHandler, { once: true });
  }

  function bindSettingsEvents(mount) {
    const themeSelect = mount.querySelector("#mt-theme-choice");

    if (themeSelect) {
      themeSelect.addEventListener("change", function () {
        const value = themeSelect.value;

        if (!["system", "light", "dark"].includes(value)) {
          return;
        }

        if (window.MohakTheme && typeof window.MohakTheme.set === "function") {
          window.MohakTheme.set(value);
        } else {
          try {
            localStorage.setItem("mohaktools-theme", value);
            document.documentElement.dataset.theme = value;
          } catch (error) {
            console.warn("MohakTools: Could not save theme.", error);
          }
        }

        showToast("Theme preference updated.");
      });
    }

    const accentInput = mount.querySelector("#mt-accent-color");

    if (accentInput) {
      accentInput.addEventListener("input", function () {
        updateSetting("accentColor", accentInput.value);
        updateAccentSwatches(mount);
      });
    }

    mount.querySelectorAll("[data-accent]").forEach(function (button) {
      button.addEventListener("click", function () {
        updateSetting("accentColor", button.dataset.accent);

        if (accentInput) {
          accentInput.value = button.dataset.accent;
        }

        updateAccentSwatches(mount);
        showToast("Accent color updated.");
      });
    });

    const fontSizeSelect = mount.querySelector("#mt-font-size");

    if (fontSizeSelect) {
      fontSizeSelect.addEventListener("change", function () {
        updateSetting("fontSize", fontSizeSelect.value);
        showToast("Text size updated.");
      });
    }

    const motionToggle = mount.querySelector("#mt-reduced-motion");

    if (motionToggle) {
      motionToggle.addEventListener("change", function () {
        updateSetting("reducedMotion", motionToggle.checked);
        showToast("Motion preference updated.");
      });
    }

    mount.querySelectorAll("[data-notification-key]").forEach(function (input) {
      input.addEventListener("change", function () {
        updateNotificationSetting(
          input.dataset.notificationKey,
          input.checked
        );

        showToast("Notification preferences updated.");
      });
    });

    const resetButton = mount.querySelector("#mt-settings-reset");

    if (resetButton) {
      resetButton.addEventListener("click", function () {
        const confirmed = window.confirm(
          "Reset all MohakTools settings to their defaults?"
        );

        if (confirmed) {
          resetSettings();
        }
      });
    }
  }

  function updateAccentSwatches(mount) {
    mount.querySelectorAll("[data-accent]").forEach(function (button) {
      button.setAttribute(
        "aria-pressed",
        String(
          button.dataset.accent.toLowerCase() ===
          settings.accentColor.toLowerCase()
        )
      );
    });
  }

  /* Public API for other MohakTools scripts */
  window.MohakSettings = {
    get: function (key) {
      if (key === "theme") {
        return getThemePreference();
      }

      if (!key) {
        return getSettings();
      }

      if (key.startsWith("notifications.")) {
        const notificationKey = key.slice("notifications.".length);
        return settings.notifications[notificationKey];
      }

      return settings[key];
    },

    getAll: function () {
      return getSettings();
    },

    set: function (key, value) {
      if (key === "theme") {
        if (["system", "light", "dark"].includes(value)) {
          if (window.MohakTheme) {
            window.MohakTheme.set(value);
          } else {
            localStorage.setItem("mohaktools-theme", value);
          }
        }

        return;
      }

      if (key.startsWith("notifications.")) {
        updateNotificationSetting(
          key.slice("notifications.".length),
          value
        );
        return;
      }

      if (Object.prototype.hasOwnProperty.call(settings, key)) {
        updateSetting(key, value);
      }
    },

    reset: resetSettings,

    render: renderSettings
  };

  function getSettings() {
    return JSON.parse(JSON.stringify({
      ...settings,
      theme: getThemePreference()
    }));
  }

  /* Apply preferences on every page, not only the settings page. */
  applySettings();

  /* Render when the settings page mount exists. */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderSettings, {
      once: true
    });
  } else {
    renderSettings();
  }

  /* Keep settings page controls in sync if the theme changes elsewhere. */
  window.addEventListener("storage", function (event) {
    if (event.key === STORAGE_KEY) {
      settings = loadSettings();
      applySettings();
      renderSettings();
    }
  });

})();
