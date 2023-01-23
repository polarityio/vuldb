'use strict';

const request = require('postman-request');
const config = require('./config/config');
const async = require('async');
const fs = require('fs');

let Logger;
let requestWithDefaults;

const MAX_PARALLEL_LOOKUPS = 10;

/**
 *
 * @param entities
 * @param options
 * @param cb
 */
function startup(logger) {
  let defaults = {};
  Logger = logger;

  const { cert, key, passphrase, ca, proxy, rejectUnauthorized } = config.request;

  if (typeof cert === 'string' && cert.length > 0) {
    defaults.cert = fs.readFileSync(cert);
  }

  if (typeof key === 'string' && key.length > 0) {
    defaults.key = fs.readFileSync(key);
  }

  if (typeof passphrase === 'string' && passphrase.length > 0) {
    defaults.passphrase = passphrase;
  }

  if (typeof ca === 'string' && ca.length > 0) {
    defaults.ca = fs.readFileSync(ca);
  }

  if (typeof proxy === 'string' && proxy.length > 0) {
    defaults.proxy = proxy;
  }

  if (typeof rejectUnauthorized === 'boolean') {
    defaults.rejectUnauthorized = rejectUnauthorized;
  }

  requestWithDefaults = request.defaults(defaults);
}

function doLookup(entities, options, cb) {
  let lookupResults = [];
  let tasks = [];

  Logger.debug(entities);

  entities.forEach((entity) => {
    let requestOptions = {
      method: 'POST',
      uri: `${options.url}/?api`,
      form: {
        apikey: options.apiKey,
        search: entity.value
      },
      json: true
    };

    Logger.trace({ uri: requestOptions }, 'Request URI');

    tasks.push(function(done) {
      requestWithDefaults(requestOptions, function(httpError, res, body) {
        if (httpError) {
          return done({
            detail: 'HTTP Request Error',
            error: httpError
          });
        }

        let result = {};

        // The VulDB API is unique in that the HTTP status code returned by the server is always 200.  Instead
        // There is a custom status code attached to the `body.response.status` property (which in theory should
        // always be there except when the HTTP status Code is not 200
        let statusCode = 500;
        if (body && body.response && body.response.status) {
          // the status code is a string so we convert to an integer
          statusCode = +body.response.status;
        }

        Logger.trace(requestOptions);
        Logger.trace({ body, statusCode }, 'Result of Lookup');

        if (statusCode === 200) {
          result = {
            entity,
            body
          };
        } else if (statusCode === 404 || statusCode === 202 || statusCode === 204) {
          result = {
            entity,
            body: null
          };
        } else {
          let error = {
            err: 'Unknown Error',
            body,
            detail: 'Integration encountered an unexpected response'
          };
          if (statusCode === 401) {
            error = {
              err: 'Unauthorized',
              detail: 'Authentication required, API key missing or unrecognized'
            };
          } else if (statusCode === 403) {
            error = {
              err: 'API rate exceeded',
              detail: 'API rate exceeded, no further requests allowed until counter reset'
            };
          } else if (statusCode === 405) {
            error = {
              err: 'Unknown request type',
              detail: 'Unknown request type'
            };
          } else if (Math.round(statusCode / 10) * 10 === 500) {
            error = {
              err: 'Server Error',
              detail: 'Unexpected Server Error',
              body
            };
          }

          return done(error);
        }

        done(null, result);
      });
    });
  });

  async.parallelLimit(tasks, MAX_PARALLEL_LOOKUPS, (err, results) => {
    if (err) {
      Logger.error({ err: err }, 'Error');
      cb(err);
      return;
    }

    results.forEach((result) => {
      if (
        result.body === null ||
        (result.body && Array.isArray(result.body.result) && result.body.result.length === 0)
      ) {
        // body.result is an array of result items.  If it is empty or does not exist then there are no results
        // for this lookup
        lookupResults.push({
          entity: result.entity,
          data: null
        });
      } else {
        lookupResults.push({
          entity: result.entity,
          data: {
            summary: [],
            details: result.body
          }
        });
      }
    });

    Logger.debug({ lookupResults }, 'Results');
    cb(null, lookupResults);
  });
}

function validateStringOption(errors, options, optionName, errMessage) {
  if (
    typeof options[optionName].value !== 'string' ||
    (typeof options[optionName].value === 'string' && options[optionName].value.length === 0)
  ) {
    errors.push({
      key: optionName,
      message: errMessage
    });
  }
}

function validateOptions(options, callback) {
  let errors = [];

  validateStringOption(errors, options, 'url', 'You must provide a valid URL');
  validateStringOption(errors, options, 'apiKey', 'You must provide a valid API Key');

  callback(null, errors);
}

module.exports = {
  doLookup,
  startup,
  validateOptions
};
