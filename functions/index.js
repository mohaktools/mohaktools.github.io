
"use strict";

/**
 * MOHAKTOOLS — RATING BACKEND
 * Firebase Cloud Functions (2nd Gen)
 *
 * Features:
 * - Anonymous authenticated submissions
 * - Firebase App Check enforcement
 * - One rating per user per tool
 * - Rating updates
 * - Server-side name moderation
 * - Unicode and obfuscation normalization
 * - Rate limiting
 * - Server-generated timestamps
 *
 * Frontend:
 * /assets/js/single.js
 * /assets/js/rating-filteration.js
 */

const admin = require("firebase-admin");

const {
  onCall,
  HttpsError
} = require("firebase-functions/v2/https");

const { logger } = require("firebase-functions");

admin.initializeApp();

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// --------------------------------------------------
// 1. GLOBAL CONFIGURATION
// --------------------------------------------------

const REGION = "asia-south1";

const CONFIG = {
  maxNameLength: 30,
  minNameLength: 2,

  // Minimum delay between submissions/updates
  submissionCooldown: 10 * 1000,

  // Maximum rating writes per tool per browser per UTC day
  dailySubmissionLimit: 5,

  // Only valid rating values
  minStars: 1,
  maxStars: 5
};

// --------------------------------------------------
// 2. BLOCKED WORDS AND PHRASES
// --------------------------------------------------

/**
 * Initial moderation list.
 *
 * This is intentionally kept separate from the frontend
 * filtering logic. The server is always authoritative.
 *
 * Expand this list as the moderation system develops.
 */

const BLOCKED_TERMS = [

  // Abusive or offensive language
  "nigga",
  "nga",

  // Adult content
  "sex",
  "sexy",
  "porn",
  "pornography",

  // Substances
  "alcohol",
  "alchol",
  "cigarette",
  "cigrate",
  "cigarettes",

  // Political names and identities
  "narendra modi",
  "narendra",
  "modi",
  "donald trump",
  "trump"

];

// --------------------------------------------------
// 3. TEXT NORMALIZATION
// --------------------------------------------------

function normalizeText(value) {

  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[@]/g, "a")
    .replace(/[0]/g, "o")
    .replace(/[1!|]/g, "i")
    .replace(/[3]/g, "e")
    .replace(/[4]/g, "a")
    .replace(/[5$]/g, "s")
    .replace(/[7]/g, "t")
    .replace(/[8]/g, "b")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

}

// --------------------------------------------------
// 4. NAME VALIDATION
// --------------------------------------------------

function validateName(input) {

  if (typeof input !== "string") {
    throw new HttpsError(
      "invalid-argument",
      "Please enter a valid name."
    );
  }

  const name = input
    .normalize("NFKC")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const characterCount = [...name].length;

  if (
    characterCount < CONFIG.minNameLength ||
    characterCount > CONFIG.maxNameLength
  ) {
    throw new HttpsError(
      "invalid-argument",
      `Name must be between ${CONFIG.minNameLength} and ${CONFIG.maxNameLength} characters.`
    );
  }

  // At least one actual letter is required.
  if (!/\p{L}/u.test(name)) {
    throw new HttpsError(
      "invalid-argument",
      "Please enter a valid display name."
    );
  }

  // Only letters, combining marks, spaces,
  // apostrophes, periods and hyphens.
  if (!/^[\p{L}\p{M}\s.'’-]+$/u.test(name)) {
    throw new HttpsError(
      "invalid-argument",
      "Your name contains unsupported characters."
    );
  }

  const normalized = normalizeText(name);

  const words = normalized.split(" ").filter(Boolean);

  const compactName = normalized.replace(/\s/g, "");

  // Whole-word and phrase matching.
  for (const term of BLOCKED_TERMS) {

    const normalizedTerm = normalizeText(term);

    const termWords = normalizedTerm.split(" ");

    let matched = false;

    if (termWords.length === 1) {
      matched = words.includes(normalizedTerm);
    } else {
      for (
        let i = 0;
        i <= words.length - termWords.length;
        i++
      ) {
        const phrase = words
          .slice(i, i + termWords.length)
          .join(" ");

        if (phrase === normalizedTerm) {
          matched = true;
          break;
        }
      }
    }

    // Catch separator-based obfuscation when the entire
    // normalized name is the prohibited term.
    if (!matched && compactName === normalizedTerm.replace(/\s/g, "")) {
      matched = true;
    }

    if (matched) {
      throw new HttpsError(
        "invalid-argument",
        "This display name is not allowed. Please choose another name."
      );
    }
  }

  return name;
}

// --------------------------------------------------
// 5. TOOL ID VALIDATION
// --------------------------------------------------

function validateToolId(toolId) {

  if (
    typeof toolId !== "string" ||
    !/^[a-z0-9][a-z0-9-]{0,63}$/.test(toolId)
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Invalid tool identifier."
    );
  }

  return toolId;
}

// --------------------------------------------------
// 6. STAR VALIDATION
// --------------------------------------------------

function validateStars(stars) {

  if (
    !Number.isInteger(stars) ||
    stars < CONFIG.minStars ||
    stars > CONFIG.maxStars
  ) {
    throw new HttpsError(
      "invalid-argument",
      "Please select a rating between 1 and 5 stars."
    );
  }

  return stars;
}

// --------------------------------------------------
// 7. RATE LIMITING
// --------------------------------------------------

async function checkRateLimit(uid, toolId, transaction) {

  const rateLimitId = `${uid}_${toolId}`;

  const rateLimitRef = db
    .collection("_ratingRateLimits")
    .doc(rateLimitId);

  const snapshot = await transaction.get(rateLimitRef);

  const now = Date.now();

  const today = new Date(now)
    .toISOString()
    .slice(0, 10);

  let dailyCount = 0;
  let lastSubmission = 0;

  if (snapshot.exists) {

    const data = snapshot.data();

    lastSubmission = data.lastSubmissionAt
      ? data.lastSubmissionAt.toMillis()
      : 0;

    dailyCount = data.dayKey === today
      ? (data.dailyCount || 0)
      : 0;

  }

  if (now - lastSubmission < CONFIG.submissionCooldown) {
    throw new HttpsError(
      "resource-exhausted",
      "Please wait a few seconds before updating your rating."
    );
  }

  if (dailyCount >= CONFIG.dailySubmissionLimit) {
    throw new HttpsError(
      "resource-exhausted",
      "You have reached today's rating update limit for this tool."
    );
  }

  transaction.set(rateLimitRef, {

    uid,
    toolId,

    dayKey: today,

    dailyCount: dailyCount + 1,

    lastSubmissionAt: FieldValue.serverTimestamp()

  });

}

// --------------------------------------------------
// 8. SUBMIT OR UPDATE RATING
// --------------------------------------------------

exports.submitRating = onCall(
  {
    region: REGION,

    // Require valid Firebase App Check tokens.
    enforceAppCheck: true,

    // Limit backend scaling.
    maxInstances: 10
  },

  async (request) => {

    // ----------------------------------------------
    // Authentication
    // ----------------------------------------------

    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Please authenticate before submitting a rating."
      );
    }

    const uid = request.auth.uid;

    const data = request.data || {};

    // ----------------------------------------------
    // Validate incoming data
    // ----------------------------------------------

    const allowedKeys = ["toolId", "name", "stars"];

    if (
      Object.keys(data).some(
        key => !allowedKeys.includes(key)
      )
    ) {
      throw new HttpsError(
        "invalid-argument",
        "Unexpected rating data."
      );
    }

    const toolId = validateToolId(data.toolId);

    const name = validateName(data.name);

    const stars = validateStars(data.stars);

    // ----------------------------------------------
    // Rating document
    // ----------------------------------------------

    const ratingRef = db
      .collection("tools")
      .doc(toolId)
      .collection("ratings")
      .doc(uid);

    // ----------------------------------------------
    // Atomic transaction
    // ----------------------------------------------

    try {

      const result = await db.runTransaction(
        async (transaction) => {

          const existingRating = await transaction.get(ratingRef);

          // Rate-limit check and update.
          await checkRateLimit(uid, toolId, transaction);

          const ratingData = {

            uid,

            toolId,

            name,

            stars,

            updatedAt: FieldValue.serverTimestamp()

          };

          if (existingRating.exists) {

            // Preserve original creation timestamp.
            transaction.update(ratingRef, ratingData);

          } else {

            // Create first rating.
            transaction.set(ratingRef, {

              ...ratingData,

              createdAt: FieldValue.serverTimestamp()

            });

          }

          return {
            updated: existingRating.exists
          };

        }
      );

      logger.info("Rating successfully saved", {
        toolId,
        uid,
        updated: result.updated
      });

      return {
        success: true,
        updated: result.updated,
        message: result.updated
          ? "Your rating has been updated."
          : "Your rating has been submitted."
      };

    } catch (error) {

      if (error instanceof HttpsError) {
        throw error;
      }

      logger.error("Rating submission failed", {
        toolId,
        uid,
        error: error.message
      });

      throw new HttpsError(
        "internal",
        "Unable to save your rating. Please try again later."
      );

    }

  }
);
