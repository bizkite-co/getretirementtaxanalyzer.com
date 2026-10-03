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
      const BACKUP_KEY = "rta_feedback_backups";

      function readBackups() {
        try {
          return JSON.parse(localStorage.getItem(BACKUP_KEY) || "[]");
        } catch (e) {
          return [];
        }
      }

      function saveBackup(payload) {
        try {
          const backups = readBackups();
          backups.push({ timestamp: new Date().toISOString(), payload: payload, delivered: false });
          localStorage.setItem(BACKUP_KEY, JSON.stringify(backups));
          return backups.length - 1;
        } catch (storageErr) {
          console.warn("Could not cache feedback locally:", storageErr);
          return -1;
        }
      }

      // Removing (not just flagging) delivered entries on success avoids
      // ever re-sending the same feedback twice on a future visit, and
      // keeps this from growing unbounded. Everything up to and
      // including `index` is removed - a successful submission (fresh or
      // a recovery resubmit) supersedes any older undelivered draft too,
      // so nothing stale can resurface the recovery flow below again for
      // a draft that's already gone through.
      function removeBackupsThrough(index) {
        if (index < 0) return;
        try {
          const backups = readBackups();
          localStorage.setItem(BACKUP_KEY, JSON.stringify(backups.slice(index + 1)));
        } catch (storageErr) {
          console.warn("Could not clear local feedback backup:", storageErr);
        }
      }

      // Pure network call, no UI/localStorage side effects - shared by
      // both the manual submit handler and the automatic recovery
      // resubmission on page load below.
      //
      // IMPORTANT: fetch() only rejects on network failure - an HTTP
      // error status (4xx/5xx) with a valid JSON body still resolves the
      // promise chain "successfully" unless res.ok is checked explicitly.
      // A prior version of this handler (when this posted to
      // formsubmit.co) skipped that check and showed "Feedback Submitted
      // ✓" on every submission regardless of whether delivery actually
      // succeeded - including on real 500 errors. Never repeat that: only
      // resolving after res.ok AND an explicit {success:true} body may
      // count as delivered.
      function deliverFeedback(payload) {
        return fetch(FEEDBACK_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }).then(function (res) {
          if (!res.ok) {
            throw new Error("Feedback endpoint returned HTTP " + res.status);
          }
          return res.json();
        }).then(function (data) {
          if (!data || data.success !== true) {
            throw new Error("Feedback endpoint reported failure: " + JSON.stringify(data));
          }
          return data;
        });
      }

      // Recover an undelivered submission from a previous visit, if any,
      // and resubmit it automatically - no click required, since this is
      // meant for someone who's told us they already submitted and is
      // just revisiting the link to finish the send. Pre-fills the form
      // too, so if the automatic resubmission also fails, they can review
      // and retry manually without retyping anything.
      (function recoverUndeliveredFeedback() {
        const backups = readBackups();
        let pendingIndex = -1;
        for (let i = backups.length - 1; i >= 0; i--) {
          if (backups[i] && backups[i].delivered === false) {
            pendingIndex = i;
            break;
          }
        }
        if (pendingIndex < 0) return;
        const pending = backups[pendingIndex];

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
        banner.textContent = "We found feedback you wrote on " + when + " that didn't finish sending. Sending it now...";
        feedbackForm.parentNode.insertBefore(banner, feedbackForm);

        deliverFeedback(pending.payload)
          .then(function () {
            removeBackupsThrough(pendingIndex);
            banner.className = "alert alert-success mt-3";
            banner.textContent = "Your earlier feedback from " + when + " has now been sent. Thank you!";
          })
          .catch(function (err) {
            console.error("Automatic recovery resubmission failed:", err);
            banner.className = "alert alert-danger mt-3";
            banner.textContent =
              "We found feedback you wrote on " + when + " but couldn't send it automatically just now. " +
              "It's filled in below - please click Submit Feedback to try again.";
          });
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

        // Local storage backup so input is never lost, in case this
        // delivery attempt fails too - recoverUndeliveredFeedback() above
        // finds and auto-resubmits this on a future visit. This is real:
        // every version of this handler, including the one that posted
        // to the (confirmed broken) formsubmit.co endpoint, has always
        // written here first, before attempting delivery - so submissions
        // from before this endpoint was fixed may still be sitting in a
        // visitor's own browser.
        const backupIndex = saveBackup(payload);

        // Google Tag Manager dataLayer event. GA4 must never receive PII
        // (name/email/message) in event parameters - this previously sent
        // feedback_name/feedback_firm/feedback_email directly; fixed to
        // keep only non-identifying signals. The actual name/email/message
        // still go to the S3-backed Lambda above, which is fine - that's
        // our own infrastructure, not a third-party analytics vendor.
        window.dataLayer.push({
          event: "feedback_submit",
          category: "feedback",
          action: "submit",
          feedback_permission: permission,
          message_length: message.length,
          utm: utmPayload,
        });

        // UI pending state
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

        deliverFeedback(payload)
          .then(function (data) {
            console.log("Feedback delivered successfully:", data);
            removeBackupsThrough(backupIndex);
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
            console.error("Feedback delivery FAILED (" + (err && err.message) + ") - payload was NOT delivered:", payload);
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = "Submit Feedback";
            }
            if (errorMsg) {
              errorMsg.classList.remove("d-none");
            }
          });
      });
    }

    // General signup ("request a callback") form - lead capture only, no
    // password/account creation. See src/signup.html for why: this is the
    // "haven't emailed them yet" audience Mark wants a callback
    // notification for, distinct from a future 30-day-trial signup form
    // for people already emailed.
    const signupForm = document.getElementById("signup-form");
    if (signupForm) {
      // CocliSignupsStack-roadmap's Lambda Function URL (deployed
      // 2026-09-30) - see cdk_scraper_deployment/testimonials_stack.py's
      // FormIntakeStack, reused here for the "signups" queue.
      var SIGNUP_ENDPOINT = "https://j4ase7uaisfod3mrran22do7pm0ftokg.lambda-url.us-east-1.on.aws/";

      signupForm.addEventListener("submit", function (e) {
        e.preventDefault();
        const name = (document.getElementById("signup-name") || {}).value || "";
        const email = (document.getElementById("signup-email") || {}).value || "";

        const payload = {
          name: name,
          email: email,
          utm_source: utmPayload.utm_source || "direct",
          utm_medium: utmPayload.utm_medium || "",
          utm_campaign: utmPayload.utm_campaign || "signup",
          utm_content: utmPayload.utm_content || "",
          utm_term: utmPayload.utm_term || "",
          page_url: window.location.href,
        };

        // GA4 must never receive PII - no name/email here, only that a
        // signup happened and its UTM context (see the feedback_submit
        // fix above for the same rule). name/email go only to our own S3
        // queue via SIGNUP_ENDPOINT below.
        window.dataLayer.push({
          event: "signup_submit",
          category: "conversion",
          action: "submit",
          form_type: "signup",
          utm: utmPayload,
        });

        const successMsg = document.getElementById("signup-success-msg");
        const errorMsg = document.getElementById("signup-error-msg");
        const submitBtn = document.getElementById("signup-submit-btn");
        if (successMsg) successMsg.classList.add("d-none");
        if (errorMsg) errorMsg.classList.add("d-none");
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.textContent = "Submitting...";
        }

        fetch(SIGNUP_ENDPOINT, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        })
          .then(function (res) {
            if (!res.ok) {
              throw new Error("Signup endpoint returned HTTP " + res.status);
            }
            return res.json();
          })
          .then(function (data) {
            if (!data || data.success !== true) {
              throw new Error("Signup endpoint reported failure: " + JSON.stringify(data));
            }
            if (successMsg) successMsg.classList.remove("d-none");
            if (submitBtn) submitBtn.textContent = "Request Sent ✓";
          })
          .catch(function (err) {
            console.error("Signup delivery FAILED (" + (err && err.message) + ") - payload was NOT delivered:", payload);
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = "Request a Callback";
            }
            if (errorMsg) errorMsg.classList.remove("d-none");
          });
      });
    }

    // Unsubscribe - one click, zero typing. The per-send token every
    // outbound email's links now carry (?t=...) is the only identifier
    // this ever needs; there's no form field to re-enter an email that
    // might not even match what we have on file (Mark, 2026-10-03: "they
    // shouldn't have to reenter any information").
    const unsubscribeConfirmBtn = document.getElementById("unsubscribe-confirm-btn");
    if (unsubscribeConfirmBtn) {
      var UNSUBSCRIBE_ENDPOINT = "https://REPLACE-AFTER-CDK-DEPLOY.lambda-url.us-east-1.on.aws/";

      const params = new URLSearchParams(window.location.search);
      const token = params.get("t");

      const confirmSection = document.getElementById("unsubscribe-confirm");
      const noTokenSection = document.getElementById("unsubscribe-no-token");
      const successMsg = document.getElementById("unsubscribe-success-msg");
      const errorMsg = document.getElementById("unsubscribe-error-msg");

      if (!token) {
        if (confirmSection) confirmSection.classList.add("d-none");
        if (noTokenSection) noTokenSection.classList.remove("d-none");
      } else {
        unsubscribeConfirmBtn.addEventListener("click", function () {
          unsubscribeConfirmBtn.disabled = true;
          unsubscribeConfirmBtn.textContent = "Unsubscribing...";
          if (errorMsg) errorMsg.classList.add("d-none");

          fetch(UNSUBSCRIBE_ENDPOINT, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ guid: token, reason: "", page_url: window.location.href }),
          })
            .then(function (res) {
              if (!res.ok) {
                throw new Error("Unsubscribe endpoint returned HTTP " + res.status);
              }
              return res.json();
            })
            .then(function (data) {
              if (!data || data.success !== true) {
                throw new Error("Unsubscribe endpoint reported failure: " + JSON.stringify(data));
              }
              if (confirmSection) confirmSection.classList.add("d-none");
              if (successMsg) successMsg.classList.remove("d-none");
            })
            .catch(function (err) {
              console.error("Unsubscribe FAILED (" + (err && err.message) + "):", token);
              unsubscribeConfirmBtn.disabled = false;
              unsubscribeConfirmBtn.textContent = "Confirm Unsubscribe";
              if (errorMsg) errorMsg.classList.remove("d-none");
            });
        });
      }
    }
  });
})();
