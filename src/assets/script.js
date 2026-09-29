/**
 * Telemetry, UTM capture & GTM event listener for getretirementtaxanalyzer.com
 */
(function () {
  "use strict";

  // Google Apps Script Web App /exec URL (Sheet-backed, owned by
  // bizkitellc@gmail.com) - replaces formsubmit.co, which nobody here has
  // an account with and which returned HTTP 500 for every submission
  // (confirmed - still 500 even after activating the account). Fill this
  // in after deploying apps_script/Code.gs as a Web App.
  var FEEDBACK_ENDPOINT = "REPLACE_WITH_APPS_SCRIPT_EXEC_URL";

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
        const isCall = href.startsWith("tel:");
        const isMail = href.startsWith("mailto:");

        window.dataLayer.push({
          event: isCall ? "phone_click" : isMail ? "email_click" : "cta_click",
          category: "conversion",
          action: "click",
          label: isCall ? "phone_call" : isMail ? "email_inquiry" : (isSignUp ? "start_free_trial" : "learn_more"),
          commitment_type: isCall || isMail ? "contact" : (isSignUp ? "micro" : "navigation"),
          target_url: href,
          button_text: text,
          utm: utmPayload,
        });
      });
    });

    // Feedback form handler with live transmission, local backup & dataLayer telemetry
    const feedbackForm = document.getElementById("feedback-form");
    if (feedbackForm) {
      feedbackForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const name = (document.getElementById("feedback-name") || {}).value || "";
        const firm = (document.getElementById("feedback-firm") || {}).value || "";
        const email = (document.getElementById("feedback-email") || {}).value || "";
        const message = (document.getElementById("feedback-message") || {}).value || "";
        const permission = (document.getElementById("feedback-permission") || {}).checked;

        const payload = {
          name: name,
          firm: firm,
          email: email,
          message: message,
          permission_to_quote: permission ? "Yes" : "No",
          utm_source: utmPayload.utm_source || "direct",
          utm_medium: utmPayload.utm_medium || "",
          utm_campaign: utmPayload.utm_campaign || "testimonials",
          utm_content: utmPayload.utm_content || "",
          utm_term: utmPayload.utm_term || "",
          page_url: window.location.href,
        };

        // 1. Local storage backup so input is never lost
        try {
          const backups = JSON.parse(localStorage.getItem("rta_feedback_backups") || "[]");
          backups.push({ timestamp: new Date().toISOString(), payload: payload });
          localStorage.setItem("rta_feedback_backups", JSON.stringify(backups));
        } catch (storageErr) {
          console.warn("Could not cache feedback locally:", storageErr);
        }

        // 2. Google Tag Manager dataLayer event
        window.dataLayer.push({
          event: "feedback_submit",
          category: "feedback",
          action: "submit",
          feedback_name: name,
          feedback_firm: firm,
          feedback_email: email,
          feedback_permission: permission,
          message_length: message.length,
          utm: utmPayload,
        });

        // 3. UI pending state
        const successMsg = document.getElementById("feedback-success-msg");
        const errorMsg = document.getElementById("feedback-error-msg");
        const mailtoLink = document.getElementById("feedback-mailto-link");
        const submitBtn = document.getElementById("feedback-submit-btn");
        if (successMsg) successMsg.classList.add("d-none");
        if (errorMsg) errorMsg.classList.add("d-none");
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Submitting...";
        }

        // Pre-fill the "email directly" fallback with the actual message
        // right away, before we even know if delivery succeeds - if it
        // fails, the user shouldn't have to retype anything.
        if (mailtoLink) {
          const mailtoSubject = `Retirement Tax Analyzer Feedback from ${name || "(no name given)"}`;
          const mailtoBody = `Firm: ${firm}\nEmail: ${email}\n\n${message}`;
          mailtoLink.href =
            "mailto:mark@bizkite.net?subject=" +
            encodeURIComponent(mailtoSubject) +
            "&body=" +
            encodeURIComponent(mailtoBody);
        }

        function showFailure(reason) {
          console.error("Feedback delivery FAILED (" + reason + ") - payload was NOT delivered:", payload);
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = "Submit Feedback";
          }
          if (errorMsg) {
            errorMsg.classList.remove("d-none");
          }
        }

        // 4. Asynchronous transmission to our own Apps Script Web App
        // (Sheet-backed - see apps_script/Code.gs). Content-Type is
        // deliberately "text/plain" rather than "application/json": Apps
        // Script Web Apps don't implement a doOptions() CORS-preflight
        // handler, so an "application/json" fetch (a "non-simple"
        // request per the CORS spec) would fail the preflight before the
        // real POST is ever sent. "text/plain" is a "simple request" and
        // skips preflight entirely; doPost() still JSON.parses the body
        // itself regardless of the declared content type.
        //
        // IMPORTANT: fetch() only rejects on network failure - an HTTP
        // error status (4xx/5xx) with a valid JSON body still resolves
        // the promise chain "successfully" unless res.ok is checked
        // explicitly. A prior version of this handler (when this posted
        // to formsubmit.co) skipped that check and showed "Feedback
        // Submitted ✓" on every submission regardless of whether delivery
        // actually succeeded - including on real 500 errors. Never repeat
        // that: only the .then(res.ok) branch may claim success.
        fetch(FEEDBACK_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "text/plain;charset=utf-8",
          },
          body: JSON.stringify(payload),
        })
          .then(function (res) {
            if (!res.ok) {
              throw new Error("Feedback endpoint returned HTTP " + res.status);
            }
            return res.json();
          })
          .then(function (data) {
            if (!data || data.success !== true) {
              throw new Error("Feedback endpoint reported failure: " + JSON.stringify(data));
            }
            console.log("Feedback delivered successfully:", data);
            if (successMsg) {
              successMsg.classList.remove("d-none");
            }
            if (submitBtn) {
              submitBtn.textContent = "Feedback Submitted ✓";
            }
          })
          .catch(function (err) {
            showFailure(err && err.message ? err.message : "network error");
          });
      });
    }
  });
})();
