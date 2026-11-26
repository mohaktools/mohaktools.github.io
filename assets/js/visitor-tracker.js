
(() => {
  "use strict";

const ENDPOINT =
  "https://mohaktools.mohakchoubey.workers.dev/";

  // Avoid duplicate initialization.
  if (window.__mohakAnalyticsInitialized) return;
  window.__mohakAnalyticsInitialized = true;

  // Respect browser Do Not Track.
  if (navigator.doNotTrack === "1") return;

  function getDevice() {
    const ua = navigator.userAgent;

    if (/tablet|ipad/i.test(ua)) return "Tablet";
    if (/mobile|android|iphone/i.test(ua)) return "Mobile";
    return "Desktop";
  }

  function getBrowser() {
    const ua = navigator.userAgent;

    if (ua.includes("Edg/")) return "Edge";
    if (ua.includes("Firefox/")) return "Firefox";
    if (ua.includes("Chrome/")) return "Chrome";
    if (ua.includes("Safari/")) return "Safari";

    return "Other";
  }

  function getOS() {
    const ua = navigator.userAgent;

    if (/Android/i.test(ua)) return "Android";
    if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
    if (/Windows/i.test(ua)) return "Windows";
    if (/Mac OS/i.test(ua)) return "macOS";
    if (/Linux/i.test(ua)) return "Linux";

    return "Other";
  }

  async function trackVisit() {
    const payload = {
      page: location.pathname,
      browser: getBrowser(),
      device: getDevice(),
      os: getOS(),
      language: navigator.language || "unknown",
      screen: `${screen.width}x${screen.height}`,
      referrer: document.referrer
        ? new URL(document.referrer).hostname
        : "Direct",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      eventType: "page_view",
      consentVersion: "1"
    };

    try {
      await fetch(ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload),
        keepalive: true
      });
    } catch (error) {
      console.warn("Analytics request failed.");
    }
  }

  // Only track after the visitor has consented.
  function startTracking() {
    if (localStorage.getItem("mohak_analytics_consent") === "yes") {
      trackVisit();
    }
  }

  window.MohakAnalytics = {
    consent() {
      localStorage.setItem("mohak_analytics_consent", "yes");
      trackVisit();
    },
    decline() {
      localStorage.setItem("mohak_analytics_consent", "no");
    }
  };

  startTracking();
})();
