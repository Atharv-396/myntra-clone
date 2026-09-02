/**
 * validateUserId.js
 * Lightweight request validation middleware.
 *
 * Strategy: since this project issues no JWT tokens, we cannot do
 * cryptographic auth on every route. Instead we add:
 *  1. ObjectId format validation — rejects obviously invalid IDs.
 *  2. A consistent userId source — body, params, or query.
 *
 * For a production system, replace with a proper JWT verify middleware.
 */

const mongoose = require("mongoose");

/**
 * Validates that the userId from body/params/query is a valid MongoDB ObjectId.
 * Use on routes that receive userId in the request body.
 * @param {string} [field="userId"] - the body/query field to validate
 */
function validateBodyUserId(field = "userId") {
  return (req, res, next) => {
    const id = req.body?.[field] || req.query?.[field];
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: `Valid ${field} is required` });
    }
    next();
  };
}

/**
 * Validates that the userId in req.params is a valid MongoDB ObjectId.
 * Use on routes that receive userId as a URL path param.
 * @param {string} [param="userId"] - the param name to validate
 */
function validateParamUserId(param = "userId") {
  return (req, res, next) => {
    const id = req.params?.[param];
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: `Valid ${param} is required in URL` });
    }
    next();
  };
}

module.exports = { validateBodyUserId, validateParamUserId };
