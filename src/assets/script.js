/**
 * Telemetry, UTM capture & GTM event listener for getretirementtaxanalyzer.com
 */
(function () {
  "use strict";

  // AWS Lambda Function URL (S3-backed queue, cdk_scraper_deployment/
  // cdk_scraper_deployment/testimonials_stack.py in the company-cli repo)
  // - replaces formsubmit.co, which nobody here has an account with and
  // which returned HTTP 500 for every submission (confirmed - still 500
  // even after activating the account, with a broken activation flow and
  // no login to review history). Writes one JSON file per submission to
  // campaigns/roadmap/queues/testimonials/pending/ in the campaign's S3
  // data bucket - the same USV/S3 queue convention the rest of this data
  // stack already uses, not a database. `cocli telemetry
  // process-testimonials` turns each into an engagement-log entry and a
  // company note with the full message.
  var FEEDBACK_ENDPOINT = "https://6jvd5zwhva6oflv2cgdel23ode0wrnyp.lambda-url.us-east-1.on.aws/";

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
      // Recover an undelivered submission from a previous visit, if any -
      // pre-fills the form so nothing has to be retyped, and shows a
      // banner so the visitor knows why it's already filled in and gets
      // to review before re-sending (deliberately not auto-submitted).
      (function restoreUndeliveredFeedback() {
        let backups;
        try {
          backups = JSON.parse(localStorage.getItem("rta_feedback_backups") || "[]");
        } catch (e) {
          return;
        }
        let pending = null;
        for (let i = backups.length - 1; i >= 0; i--) {
          if (backups[i] && backups[i].delivered === false) {
            pending = backups[i];
            break;
          }
        }
        if (!pending) return;

        const nameEl = document.getElementById("feedback-name");
        const firmEl = document.getElementById("feedback-firm");
        const emailEl = document.getElementById("feedback-email");
        const messageEl = document.getElementById("feedback-message");
        if (nameEl) nameEl.value = pending.payload.name || "";
        if (firmEl) firmEl.value = pending.payload.firm || "";
        if (emailEl) emailEl.value = pending.payload.email || "";
        if (messageEl) messageEl.value = pending.payload.message || "";

        const banner = document.createElement("div");
        banner.id = "feedback-recovery-banner";
        banner.className = "alert alert-warning mt-3";
        const when = new Date(pending.timestamp).toLocaleString();
        banner.textContent =
          "We found feedback you wrote on " + when + " that didn't finish sending. " +
          "We've filled it back in below - just click Submit Feedback again to send it.";
        feedbackForm.parentNode.insertBefore(banner, feedbackForm);
      })();

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

        // 1. Local storage backup so input is never lost. Tagged
        // delivered:false up front and flipped to true only after a
        // confirmed successful response below - this is what lets
        // restoreUndeliveredFeedback() (below) find and offer to
        // re-send anything that didn't actually make it, the next time
        // this page loads. This is real: every version of this handler,
        // including the one that posted to the (confirmed broken)
        // formsubmit.co endpoint, has always written here first, before
        // attempting delivery - so submissions from before this endpoint
        // was fixed may still be sitting in a visitor's own browser.
        var backupIndex = -1;
        try {
          const backups = JSON.parse(localStorage.getItem("rta_feedback_backups") || "[]");
          backups.push({
            timestamp: new Date().toISOString(),
            payload: payload,
            delivered: false,
          });
          backupIndex = backups.length - 1;
          localStorage.setItem("rta_feedback_backups", JSON.stringify(backups));
        } catch (storageErr) {
          console.warn("Could not cache feedback locally:", storageErr);
        }

        function markBackupDelivered() {
          if (backupIndex < 0) return;
          try {
            const backups = JSON.parse(localStorage.getItem("rta_feedback_backups") || "[]");
            if (backups[backupIndex]) {
              // Mark every OLDER entry delivered too, not just this one -
              // a successful submission (whether a fresh one or a
              // recovery resubmit) supersedes anything earlier that never
              // went through. Without this, an old failed attempt from
              // before a later successful one would still match
              // restoreUndeliveredFeedback()'s scan on a future visit and
              // resurface a stale recovery banner for a draft that's
              // already been superseded.
              for (let i = 0; i <= backupIndex; i++) {
                if (backups[i]) backups[i].delivered = true;
              }
              localStorage.setItem("rta_feedback_backups", JSON.stringify(backups));
            }
          } catch (storageErr) {
            console.warn("Could not update local feedback backup:", storageErr);
          }
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

        // 4. Asynchronous transmission to our own Lambda Function URL
        // (S3 queue-backed - see cdk_scraper_deployment/
        // testimonials_stack.py). Lambda Function URLs handle the CORS
        // preflight (OPTIONS) natively when configured with `cors=...`
        // in CDK, so a plain "application/json" fetch works fine here -
        // unlike a raw Apps Script Web App, which has no preflight
        // handler at all (that constraint no longer applies to this
        // endpoint; don't reintroduce the text/plain workaround).
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
            "Content-Type": "application/json",
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
            markBackupDelivered();
            const recoveryBanner = document.getElementById("feedback-recovery-banner");
            if (recoveryBanner) recoveryBanner.remove();
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
