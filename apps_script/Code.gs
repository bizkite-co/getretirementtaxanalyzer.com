/**
 * RTA Testimonials/Feedback intake.
 *
 * Replaces formsubmit.co (a third-party service nobody here has an
 * account with, confirmed unreliable - still returns HTTP 500 even after
 * activating it). This script is bound to a Google Sheet you own and
 * appends one row per submission, plus emails a notification via
 * MailApp (your own Gmail quota, not a third party).
 *
 * Deploy: Extensions > Apps Script (from the Sheet) > paste this in as
 * Code.gs > Deploy > New deployment > type "Web app" > Execute as: Me,
 * Who has access: Anyone > Deploy. Copy the resulting /exec URL into
 * FEEDBACK_ENDPOINT in assets/script.js.
 */

var NOTIFY_EMAIL = "mark@bizkite.net";
var SHEET_NAME = "Submissions";

function doPost(e) {
  var result = { success: false };
  try {
    var data = JSON.parse(e.postData.contents);

    var sheet = getOrCreateSheet_();
    sheet.appendRow([
      new Date(),
      data.name || "",
      data.firm || "",
      data.email || "",
      data.message || "",
      data.permission_to_quote || "",
      data.utm_source || "",
      data.utm_medium || "",
      data.utm_campaign || "",
      data.utm_content || "",
      data.utm_term || "",
      data.page_url || "",
    ]);

    try {
      MailApp.sendEmail({
        to: NOTIFY_EMAIL,
        subject: "[RTA Feedback] " + (data.name || "Someone") + " (" + (data.firm || data.email || "") + ")",
        body:
          "Name: " + (data.name || "") + "\n" +
          "Firm: " + (data.firm || "") + "\n" +
          "Email: " + (data.email || "") + "\n" +
          "Permission to quote: " + (data.permission_to_quote || "") + "\n" +
          "Page: " + (data.page_url || "") + "\n" +
          "UTM: source=" + (data.utm_source || "") + " medium=" + (data.utm_medium || "") +
          " campaign=" + (data.utm_campaign || "") + " content=" + (data.utm_content || "") +
          " term=" + (data.utm_term || "") + "\n\n" +
          (data.message || ""),
      });
    } catch (mailErr) {
      // The Sheet row is the durable record; email is a nice-to-have.
      // Don't fail the whole request just because the notification email
      // couldn't be sent (e.g. daily MailApp quota exhausted).
      Logger.log("MailApp.sendEmail failed: " + mailErr);
    }

    result.success = true;
  } catch (err) {
    result.error = String(err);
    Logger.log("doPost error: " + err);
  }

  return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function getOrCreateSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow([
      "timestamp",
      "name",
      "firm",
      "email",
      "message",
      "permission_to_quote",
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_content",
      "utm_term",
      "page_url",
    ]);
  }
  return sheet;
}

/** Manual smoke test - run this once from the Apps Script editor
 * (Run > testDoPost) before deploying, to confirm the Sheet/email logic
 * works without needing a real HTTP round-trip yet. */
function testDoPost() {
  var fakeEvent = {
    postData: {
      contents: JSON.stringify({
        name: "Smoke Test",
        firm: "Test Firm",
        email: "smoke-test@example.com",
        message: "This is a manual smoke test run from the Apps Script editor.",
        permission_to_quote: "No",
        utm_source: "test",
        utm_medium: "test",
        utm_campaign: "test",
        utm_content: "smoke-test",
        utm_term: "smoke-test",
        page_url: "https://getretirementtaxanalyzer.com/testimonials/",
      }),
    },
  };
  var output = doPost(fakeEvent);
  Logger.log(output.getContent());
}
