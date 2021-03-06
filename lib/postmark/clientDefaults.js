var sha = 'unknown revision';
var http = require('http');
var https = require('https');
var version = require('../../package.json').version;
var exec = require('child_process').exec;

exec('git rev-parse HEAD', { cwd: __dirname }, function (err, stdout, stderr) {
  sha = stdout.split('\n').join('') || 'unknown revision';
});

/**
 * The defaults used for the construction of new clients.
 * You can pass options in client constructors to override these options.
 *
 * @typedef ClientDefaults
 * @property {string} [requestHost=api.postmarkapp.com] The host name for whichever server we should use to access the Postmark API.
 * @property {boolean} [ssl=true] Should ssl be used for accessing the API (http/https)?
 * @property {function} [requestFactory] Given the set of options, produce a new function that will be responsible for creating and processing HTTP requests.
 */
var ClientDefaults = {

  requestHost: "api.postmarkapp.com",
  ssl: true,
  requestFactory: function(options) {
    var client = options.ssl === true ? https : http;

    function request(path, type, content, callback) {
      var msg = null;
      if (content) {
        msg = JSON.stringify(content);
      }

      var headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
        "User-Agent": "postmark.js (Package-version: " + version + ";Revision:" + sha + ")"
      };

      headers[options.authorizationHeader] = options.apiKey;

      if (msg) {
        headers["Content-Length"] = Buffer.byteLength(msg);
      }

      var req = client.request({
        host: options.requestHost,
        path: path,
        method: type,
        headers: headers,
        port: (options.ssl ? 443 : 80)
      }, function(response) {

        var body = "";

        response.on("data", function(i) {
          body += i;
        });

        response.on("end", function() {
          if (response.statusCode == 200) {
            if (callback) {
              try {
                var ret = JSON.parse(body);
                callback(null, ret);
              } catch (e) {
                callback(e);
              }
            }
          } else {
            if (callback) {
              var data;
              try {
                data = JSON.parse(body);
                callback({
                  status: response.statusCode,
                  message: data.Message,
                  code: data.ErrorCode
                });
              } catch (e) {
                callback({
                  status: 404,
                  message: "Unsupported Request Method and Protocol",
                  code: -1 // this is a fake error code !
                });
              }

            }
          }
        });
      });

      req.on('error', function(err) {
        if (callback) {
          callback(err);
        }
      });

      if (msg) {
        req.write(msg);
      }
      req.end();
    }

    return function(path, type, content, callback) {
      if (callback || typeof Promise === 'undefined') {
        request(path, type, content, callback);
      }
      else {
        return new Promise(function(resolve, reject) {
          request(path, type, content, function(error, result) {
            if (error) {
              reject(error);
            }
            else{
              resolve(result);
            }
          });
        });
      }
    };
  }
};

module.exports = ClientDefaults;
