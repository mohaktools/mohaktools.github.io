(function () {
  "use strict";

  const publisherId = "ca-pub-YOUR_PUBLISHER_ID";

  function createAdSlot(container) {
    if (!container || container.dataset.adInitialized === "true") {
      return;
    }

    container.dataset.adInitialized = "true";

    const slotId = container.dataset.adSlot;

    if (
      !/^ca-pub-\d+$/.test(publisherId) ||
      !/^\d+$/.test(slotId || "")
    ) {
      container.hidden = true;
      return;
    }

    const ins = document.createElement("ins");
    ins.className = "adsbygoogle";
    ins.style.display = "block";
    ins.style.width = "100%";
    ins.dataset.adClient = publisherId;
    ins.dataset.adSlot = slotId;
    ins.dataset.adFormat = "auto";
    ins.dataset.fullWidthResponsive = "true";

    container.appendChild(ins);

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (error) {
      console.warn("AdSense could not initialize this ad slot.", error);
    }
  }

  function initializeAds() {
    document.querySelectorAll("[data-ad-slot]").forEach(createAdSlot);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializeAds, {
      once: true
    });
  } else {
    initializeAds();
  }
})();