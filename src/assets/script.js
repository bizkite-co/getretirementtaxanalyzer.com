/**
 * Telemetry, UTM capture & GTM event listener for getretirementtaxanalyzer.com
 */
(function () {
  "use strict";

  window.dataLayer = window.dataLayer || [];

  function getQueryParams() {
    const params = {};
    const search = window.location.search.substring(1);
    if (!search) return params;
    search.split("&").forEach(function (pair) {
      const parts = pair.split("=");
      if (parts[0]) {
        params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || "");
      }
    });
    return params;
  }

  // Capture UTM parameters from URL query string & persist to sessionStorage
  const query = getQueryParams();
  const utmKeys = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
  const utmPayload = {};

  utmKeys.forEach(function (key) {
    if (query[key]) {
      sessionStorage.setItem(key, query[key]);
      utmPayload[key] = query[key];
    } else if (sessionStorage.getItem(key)) {
      utmPayload[key] = sessionStorage.getItem(key);
    }
  });

  // Push initial page view event with UTM telemetry
  window.dataLayer.push({
    event: "landing_page_view",
    page_path: window.location.pathname,
    page_title: document.title,
    utm: utmPayload,
  });

  // Bind CTA click event listeners
  document.addEventListener("DOMContentLoaded", function () {
    const ctaButtons = document.querySelectorAll("a.btn, button.btn, a[href='/signup'], a[href='/features']");

    ctaButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const href = btn.getAttribute("href") || "";
        const text = (btn.textContent || "").trim();
        const isSignUp = href.includes("signup");

        window.dataLayer.push({
          event: "cta_click",
          category: "conversion",
          action: "click",
          label: isSignUp ? "start_free_trial" : "learn_more",
          commitment_type: isSignUp ? "micro" : "navigation",
          target_url: href,
          button_text: text,
          utm: utmPayload,
        });
      });
    });
  });
})();
