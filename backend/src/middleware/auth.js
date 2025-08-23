const { ClerkExpressRequireAuth } = require('@clerk/clerk-sdk-node');

// This middleware authenticates the user using the JWT from the Authorization header.
// If the token is valid, it attaches the `auth` object to the request,
// which contains the userId and session details.
// If the token is invalid or missing, it returns a 401 Unauthorized error.
const authenticate = (req, res, next) => {
  // Using ClerkExpressRequireAuth with custom error handling
  ClerkExpressRequireAuth({
    // You can add options here if needed, e.g., authorizedParties
  })(req, res, (err) => {
    if (err) {
      // The default error handler sends a JSON response, which is good for an API.
      // You could add custom logging here if you wanted.
      return next(err);
    }
    next();
  });
};

module.exports = {
  authenticate,
};
