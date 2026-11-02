
"use strict";

/**
 * ============================================================
 * MOHAKTOOLS — ADVANCED RATING NAME MODERATION
 * Version: 2.0.0
 * ============================================================
 *
 * Purpose:
 * - Validate public display names
 * - Detect prohibited language
 * - Detect common obfuscation attempts
 * - Support English, Hindi and Hinglish
 * - Prevent HTML/script characters
 * - Normalize Unicode
 * - Provide reusable validation API
 *
 * IMPORTANT:
 * This is frontend validation.
 * Firebase Cloud Functions must independently
 * enforce the same moderation policy.
 *
 * Public API:
 * MohakRatingFilter.validate(name)
 * MohakRatingFilter.isValid(name)
 * MohakRatingFilter.normalize(name)
 * MohakRatingFilter.addBlockedTerms(terms)
 * MohakRatingFilter.getVersion()
 */

(function (window) {

  if (window.MohakRatingFilter) return;

  // ========================================================
  // 1. CONFIGURATION
  // ========================================================

  const CONFIG = Object.freeze({
    minLength: 2,
    maxLength: 30,
    version: "2.0.0"
  });

  // ========================================================
  // 2. MODERATION DICTIONARIES
  // ========================================================

  const DICTIONARY = {

    // Adult terminology
    adult: [
      "sex",
      "sexy",
      "porn",
      "porno",
      "pornography",
      "xxx",
      "erotic",
      "erotica",
      "sexual",
      "nude",
      "nudes",
      "nudity",
      "nsfw",
      "hentai",
      "fetish",
      "onlyfans",
      "boobs",
      "penis",
      "vagina",
      "masturbation",
      "orgasm",
      "prostitute",
      "prostitution",
      "escort",
      "brothel"
    ],

    // Substance-related terminology
    substances: [
      "alcohol",
      "alchol",
      "liquor",
      "beer",
      "wine",
      "vodka",
      "whiskey",
      "whisky",
      "cigarette",
      "cigarettes",
      "cigrate",
      "cig",
      "smoking",
      "tobacco",
      "nicotine",
      "vape",
      "vaping",
      "cigar",
      "marijuana",
      "cannabis",
      "weed",
      "cocaine",
      "heroin",
      "methamphetamine",
      "drugs",
      "drugdealer"
    ],

    // Abusive and offensive terminology
    abuse: [
      "nigga",
      "nga",
      "motherfucker",
      "fuck",
      "fucking",
      "fucker",
      "shit",
      "bullshit",
      "bitch",
      "bastard",
      "asshole",
      "dickhead",
      "dumbass",
      "jackass",
      "whore",
      "slut",
      "retard"
    ],

    // Hindi / Hinglish offensive terminology
    hindi: [
      "bhosdika",
      "bhosdi",
      "bhosda",
      "chutiya",
      "chutiye",
      "madarchod",
      "behenchod",
      "gaand",
      "gandu",
      "harami",
      "kamina",
      "kamine",
      "randi",
      "lund",
      "lavde",
      "lodu",
      "bsdk",
      "mc",
      "bc"
    ],

    // Political figures and impersonation
    political: [
      "narendra modi",
      "donald trump",
      "rahul gandhi",
      "amit shah",
      "joe biden",
      "barack obama"
    ],

    // Impersonation and misleading identities
    impersonation: [
      "admin",
      "administrator",
      "official",
      "support team",
      "customer support",
      "firebase admin",
      "mohaktools admin",
      "mohaktools support",
      "system administrator",
      "verified account"
    ],

    // Spam and deceptive identities
    spam: [
      "free money",
      "click here",
      "buy followers",
      "fake account",
      "spam account",
      "crypto scam",
      "giveaway winner",
      "password reset"
    ]

  };

  // ========================================================
  // 3. BUILD MODERATION LIST
  // ========================================================

  const blockedTerms = new Set();

  Object.values(DICTIONARY).forEach(category => {

    category.forEach(term => {

      const normalized = normalize(term);

      if (normalized) {
        blockedTerms.add(normalized);
      }

    });

  });

  // ========================================================
  // 4. NORMALIZATION
  // ========================================================

  function normalize(value) {

    if (typeof value !== "string") return "";

    return value

      // Unicode compatibility normalization
      .normalize("NFKD")

      // Remove Unicode combining marks
      .replace(/\p{M}/gu, "")

      // Lowercase
      .toLowerCase()

      // Common character substitutions
      .replace(/@/g, "a")
      .replace(/0/g, "o")
      .replace(/1/g, "i")
      .replace(/3/g, "e")
      .replace(/4/g, "a")
      .replace(/5/g, "s")
      .replace(/7/g, "t")
      .replace(/8/g, "b")
      .replace(/\$/g, "s")
      .replace(/!/g, "i")

      // Convert punctuation and separators to spaces
      .replace(/[^a-z0-9\s]/g, " ")

      // Normalize whitespace
      .replace(/\s+/g, " ")

      .trim();

  }

  // ========================================================
  // 5. COMPACT NORMALIZATION
  // ========================================================

  function compactNormalize(value) {

    return normalize(value).replace(/\s+/g, "");

  }

  // ========================================================
  // 6. BLOCKED TERM DETECTION
  // ========================================================

  function containsBlockedTerm(value) {

    const normalized = normalize(value);

    const words = normalized
      .split(/\s+/)
      .filter(Boolean);

    const compact = compactNormalize(value);

    for (const term of blockedTerms) {

      const termWords = term.split(/\s+/);

      // Single-word exact matching
      if (termWords.length === 1) {

        if (words.includes(term)) {
          return true;
        }

      }

      // Multi-word phrase matching
      else {

        for (
          let i = 0;
          i <= words.length - termWords.length;
          i++
        ) {

          const phrase = words
            .slice(i, i + termWords.length)
            .join(" ");

          if (phrase === term) {
            return true;
          }

        }

      }

      // Detect punctuation/spacing obfuscation
      if (compact === compactNormalize(term)) {
        return true;
      }

    }

    return false;

  }

  // ========================================================
  // 7. DISPLAY NAME VALIDATION
  // ========================================================

  function validate(input) {

    if (typeof input !== "string") {

      return {
        valid: false,
        name: null,
        reason: "Please enter a valid display name."
      };

    }

    // Normalize the original display name
    const name = input

      .normalize("NFKC")

      // Remove invisible control characters
      .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")

      .replace(/[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")

      // Normalize whitespace
      .replace(/\s+/g, " ")

      .trim();

    const length = [...name].length;

    // Minimum length
    if (length < CONFIG.minLength) {

      return {
        valid: false,
        name: null,
        reason: "Name must contain at least 2 characters."
      };

    }

    // Maximum length
    if (length > CONFIG.maxLength) {

      return {
        valid: false,
        name: null,
        reason: "Name cannot exceed 30 characters."
      };

    }

    // Require at least one letter
    if (!/\p{L}/u.test(name)) {

      return {
        valid: false,
        name: null,
        reason: "Please enter a valid name."
      };

    }

    // Permit international names
    // including spaces, apostrophes and hyphens
    if (!/^[\p{L}\p{M}\s.'’-]+$/u.test(name)) {

      return {
        valid: false,
        name: null,
        reason: "Your name contains unsupported characters."
      };

    }

    // Check prohibited terms
    if (containsBlockedTerm(name)) {

      return {
        valid: false,
        name: null,
        reason: "This display name is not allowed. Please choose another name."
      };

    }

    return {
      valid: true,
      name: name,
      normalized: normalize(name),
      reason: null
    };

  }

  // ========================================================
  // 8. CUSTOM MODERATION TERMS
  // ========================================================

  function addBlockedTerms(terms) {

    if (!Array.isArray(terms)) {
      return false;
    }

    terms.forEach(term => {

      if (typeof term !== "string") return;

      const normalized = normalize(term);

      if (normalized.length >= 2) {
        blockedTerms.add(normalized);
      }

    });

    return true;

  }

  // ========================================================
  // 9. PUBLIC API
  // ========================================================

  const API = Object.freeze({

    validate,

    isValid(name) {
      return validate(name).valid;
    },

    normalize,

    compactNormalize,

    containsBlockedTerm,

    addBlockedTerms,

    getVersion() {
      return CONFIG.version;
    },

    getDictionarySize() {
      return blockedTerms.size;
    }

  });

  // ========================================================
  // 10. EXPOSE GLOBAL API
  // ========================================================

  Object.defineProperty(window, "MohakRatingFilter", {

    value: API,

    writable: false,

    configurable: false,

    enumerable: false

  });

})(window);
